import { prisma } from "@/lib/db";
import { topologicalSort } from "@/lib/dag";
import type { Prisma } from "@prisma/client";
import { triggerAndWait } from "@/lib/trigger-client";

type InputNode = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

type InputEdge = {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export async function executeRun(params: {
  runId: string;
}) {
  const run = await prisma.run.findUnique({
    where: { id: params.runId },
    include: { nodes: true, workflow: true },
  });
  if (!run) return;

  const runMeta = run.meta as { nodeIds?: string[]; nodes?: InputNode[]; edges?: InputEdge[]; nodeId?: string } | null;
  const workflow = run.workflow as any;
  const nodes = workflow ? workflow.nodes as InputNode[] : (runMeta?.nodes ?? []);
  const edges = workflow ? workflow.edges as InputEdge[] : (runMeta?.edges ?? []);

  const selectedNodeSet = new Set(run.type === "full" ? nodes.map((node) => node.id) : runMeta?.nodeIds ?? []);
  const executionNodes = nodes.filter((node) => selectedNodeSet.has(node.id));
  const executionEdges = edges.filter((edge) => selectedNodeSet.has(edge.source) && selectedNodeSet.has(edge.target));

  const topo = topologicalSort(
    executionNodes.map((node) => node.id),
    executionEdges.map((edge) => ({ source: edge.source, target: edge.target })),
  );

  if (topo.hasCycle) {
    await prisma.run.update({ where: { id: params.runId }, data: { status: "failed", finishedAt: new Date(), durationMs: 0, meta: { reason: "Cycle detected" } } });
    return;
  }

  // Initial run kickoff: process the DAG
  await proceedWithRun(params.runId, executionNodes, executionEdges);
}

export async function resumeRun(runId: string) {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { nodes: true, workflow: true },
  });
  if (!run || run.status !== "running") return;

  const runMeta = run.meta as { nodeIds?: string[]; nodes?: InputNode[]; edges?: InputEdge[]; nodeId?: string } | null;
  const workflow = run.workflow as any;
  const nodes = workflow ? workflow.nodes as InputNode[] : (runMeta?.nodes ?? []);
  const edges = workflow ? workflow.edges as InputEdge[] : (runMeta?.edges ?? []);

  const selectedNodeSet = new Set(run.type === "full" ? nodes.map((node) => node.id) : runMeta?.nodeIds ?? []);
  const executionNodes = nodes.filter((node) => selectedNodeSet.has(node.id));
  const executionEdges = edges.filter((edge) => selectedNodeSet.has(edge.source) && selectedNodeSet.has(edge.target));

  await proceedWithRun(runId, executionNodes, executionEdges);
}

async function proceedWithRun(runId: string, executionNodes: InputNode[], executionEdges: InputEdge[]) {
  const existingNodes = await prisma.runNode.findMany({ where: { runId } });
  const completedNodeIds = new Set(existingNodes.filter(n => n.status === "success").map(n => n.nodeId));
  const failedNodeIds = new Set(existingNodes.filter(n => n.status === "failed").map(n => n.nodeId));
  const runningNodeIds = new Set(existingNodes.filter(n => n.status === "running").map(n => n.nodeId));

  const incoming = new Map<string, string[]>(executionNodes.map((node) => [node.id, []]));
  const executionEdgeMap = new Map<string, InputEdge[]>();
  for (const edge of executionEdges) {
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
    executionEdgeMap.set(edge.target, [...(executionEdgeMap.get(edge.target) ?? []), edge]);
  }

  const outputMap = new Map<string, unknown>();
  for (const node of existingNodes) {
    if (node.outputs) {
      outputMap.set(node.nodeId, (node.outputs as any).output);
    }
  }

  const readyQueue: InputNode[] = [];
  const newlyFailedQueue: InputNode[] = [];
  let isDone = true;

  for (const node of executionNodes) {
    if (completedNodeIds.has(node.id) || failedNodeIds.has(node.id)) {
      continue;
    }

    isDone = false; // Still pending nodes
    if (runningNodeIds.has(node.id)) {
      continue;
    }

    const dependencies = incoming.get(node.id) ?? [];
    const isReady = dependencies.every((depId) => completedNodeIds.has(depId));
    const hasFailedDependency = dependencies.some((depId) => failedNodeIds.has(depId));

    if (hasFailedDependency) {
      newlyFailedQueue.push(node);
    } else if (isReady) {
      readyQueue.push(node);
    }
  }

  // Handle cascading failures immediately
  for (const node of newlyFailedQueue) {
    await prisma.runNode.create({
      data: {
        runId,
        nodeId: node.id,
        status: "failed",
        inputs: { skipped: true, reason: "Dependency failed" },
        error: "Dependency failed",
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 0,
      },
    });
    // Recursive check in case this newly failed node cascades to more failures
    return proceedWithRun(runId, executionNodes, executionEdges);
  }

  if (isDone) {
    const hasFailure = failedNodeIds.size > 0;
    const run = await prisma.run.findUnique({ where: { id: runId } });
    if (run) {
      await prisma.run.update({
        where: { id: runId },
        data: {
          status: hasFailure ? "partial" : "success",
          finishedAt: new Date(),
          durationMs: Date.now() - run.startedAt.getTime(),
        },
      });
    }
    return;
  }

  let localFinished = false;

  // Trigger ready nodes
  await Promise.all(
    readyQueue.map(async (node) => {
      const dependencyIds = incoming.get(node.id) ?? [];
      const nodeStarted = Date.now();

      // Basic deduplication for concurrent webhooks
      const existing = await prisma.runNode.findFirst({ where: { runId, nodeId: node.id } });
      if (existing) return;

      await prisma.runNode.create({
        data: {
          runId,
          nodeId: node.id,
          status: "running",
          inputs: {
            dependencies: dependencyIds.map((dependencyId) => ({ nodeId: dependencyId, output: safeJson(outputMap.get(dependencyId)) })),
            data: safeJson(node.data),
          },
        },
      });

      try {
        const output = await executeNodeThroughTrigger({
          runId,
          node,
          dependencyIds,
          outputMap,
          incomingEdges: executionEdgeMap.get(node.id) ?? [],
        });

        // If node was external trigger task, output is just {}, we wait for webhook.
        // If node was pure local execution (text, uploadImage URL resolution, output), it returns actual object.
        const returnedKeys = Object.keys(output).filter((k) => k !== "triggerId");
        if (returnedKeys.length > 0) {
          await prisma.runNode.updateMany({
            where: { runId, nodeId: node.id },
            data: {
              status: "success",
              outputs: { output: safeJson(output) },
              finishedAt: new Date(),
              durationMs: Date.now() - nodeStarted,
            },
          });
          localFinished = true;
        }
      } catch (error) {
        await prisma.runNode.updateMany({
          where: { runId, nodeId: node.id },
          data: {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            finishedAt: new Date(),
            durationMs: Date.now() - nodeStarted,
          },
        });
        localFinished = true;
      }
    }),
  );

  if (localFinished) {
    // Proceed DAG check recursively since one or more local nodes finished immediately
    await proceedWithRun(runId, executionNodes, executionEdges);
  }
}

async function executeNodeThroughTrigger(params: {
  runId: string;
  node: InputNode;
  dependencyIds: string[];
  outputMap: Map<string, unknown>;
  incomingEdges: InputEdge[];
}) {
  const callbackUrl = buildCallbackUrl();
  const outputsBySource = new Map<string, unknown>(params.dependencyIds.map((id) => [id, params.outputMap.get(id)]));

  if (params.node.type === "text") {
    return { text: String(params.node.data.textValue ?? "") };
  }

  if (params.node.type === "uploadImage") {
    return { url: String(params.node.data.imageUrl ?? "") };
  }

  if (params.node.type === "uploadVideo") {
    return { url: String(params.node.data.videoUrl ?? "") };
  }

  if (params.node.type === "output") {
    const outputValue = firstConnectedOutput(params.incomingEdges, outputsBySource, "output");
    return { result: outputValue ?? null };
  }

  if (params.node.type === "cropImage") {
    const crop = parseCropData(params.node.data.crop);
    const imageFromConnection = firstConnectedOutput(params.incomingEdges, outputsBySource, "image_url");
    const imageUrl = asUrl(imageFromConnection ?? params.node.data.imageUrl);
    if (!imageUrl) throw new Error("Crop Image node requires image input");

    const payload = {
      runId: params.runId,
      nodeId: params.node.id,
      callbackUrl,
      imageUrl,
      xPercent: asPercent(firstConnectedOutput(params.incomingEdges, outputsBySource, "x_percent") ?? crop.xPercent, 0),
      yPercent: asPercent(firstConnectedOutput(params.incomingEdges, outputsBySource, "y_percent") ?? crop.yPercent, 0),
      widthPercent: asPercent(firstConnectedOutput(params.incomingEdges, outputsBySource, "width_percent") ?? crop.widthPercent, 100),
      heightPercent: asPercent(firstConnectedOutput(params.incomingEdges, outputsBySource, "height_percent") ?? crop.heightPercent, 100),
    };

    return triggerAndWait<typeof payload>("crop-image-task", payload);
  }

  if (params.node.type === "extractFrame") {
    const videoFromConnection = firstConnectedOutput(params.incomingEdges, outputsBySource, "video_url");
    const videoUrl = asUrl(videoFromConnection ?? params.node.data.videoUrl);
    if (!videoUrl) throw new Error("Extract Frame node requires video input");

    const payload = {
      runId: params.runId,
      nodeId: params.node.id,
      callbackUrl,
      videoUrl,
      timestamp: String(firstConnectedOutput(params.incomingEdges, outputsBySource, "timestamp") ?? params.node.data.timestamp ?? "0"),
    };
    return triggerAndWait<typeof payload>("extract-frame-task", payload);
  }

  if (params.node.type === "llm") {
    const systemPrompt = asText(firstConnectedOutput(params.incomingEdges, outputsBySource, "system_prompt") ?? params.node.data.systemPrompt) ?? undefined;
    const userMessage = asText(firstConnectedOutput(params.incomingEdges, outputsBySource, "user_message") ?? params.node.data.userMessage);
    if (!userMessage) throw new Error("LLM node requires user_message input");

    const imageOutputs = connectedOutputs(params.incomingEdges, outputsBySource, "images")
      .map((value) => asUrl(value))
      .filter((value): value is string => Boolean(value));

    const payload = {
      runId: params.runId,
      nodeId: params.node.id,
      callbackUrl,
      model: String(params.node.data.model ?? "gemini-2.0-flash"),
      systemPrompt,
      userMessage,
      images: imageOutputs,
    };

    return triggerAndWait<typeof payload>("llm-node-task", payload);
  }

  // If we reach here, we have an unsupported node type in the database
  throw new Error(`Execution failed: Unsupported node type '${params.node.type}'`);
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function parseCropData(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return { xPercent: undefined, yPercent: undefined, widthPercent: undefined, heightPercent: undefined };
  }
  const obj = value as Record<string, unknown>;
  return {
    xPercent: obj.xPercent,
    yPercent: obj.yPercent,
    widthPercent: obj.widthPercent,
    heightPercent: obj.heightPercent,
  };
}

function unwrapOutput(value: unknown) {
  if (typeof value === "object" && value !== null && "output" in value) {
    return (value as { output?: unknown }).output;
  }
  return value;
}

function firstConnectedOutput(edges: InputEdge[], outputsBySource: Map<string, unknown>, targetHandle: string) {
  const edge = edges.find((candidate) => candidate.targetHandle === targetHandle);
  if (!edge) return undefined;
  return unwrapOutput(outputsBySource.get(edge.source));
}

function connectedOutputs(edges: InputEdge[], outputsBySource: Map<string, unknown>, targetHandle: string) {
  return edges
    .filter((candidate) => candidate.targetHandle === targetHandle)
    .map((edge) => unwrapOutput(outputsBySource.get(edge.source)));
}

function asText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "text" in value) {
    const text = (value as { text?: unknown }).text;
    return typeof text === "string" ? text : null;
  }
  if (typeof value === "object" && value !== null && "url" in value) {
    const url = (value as { url?: unknown }).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

function asUrl(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "url" in value) {
    const url = (value as { url?: unknown }).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

function asPercent(value: unknown, fallback: number) {
  const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
  const parsed = raw !== null ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
}

function buildCallbackUrl() {
  let appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;

  if (!appUrl && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    appUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  } else if (!appUrl && process.env.VERCEL_URL) {
    appUrl = `https://${process.env.VERCEL_URL}`;
  }

  if (!appUrl) return undefined;
  return `${appUrl.replace(/\/$/, "")}/api/trigger/callback`;
}