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
  scope: "full" | "single" | "partial";
  nodeIds?: string[];
  nodes: InputNode[];
  edges: InputEdge[];
}) {
  const selectedNodeSet = new Set(params.scope === "full" ? params.nodes.map((node) => node.id) : params.nodeIds ?? []);
  const executionNodes = params.nodes.filter((node) => selectedNodeSet.has(node.id));
  const executionEdges = params.edges.filter((edge) => selectedNodeSet.has(edge.source) && selectedNodeSet.has(edge.target));

  const topo = topologicalSort(
    executionNodes.map((node) => node.id),
    executionEdges.map((edge) => ({ source: edge.source, target: edge.target })),
  );

  if (topo.hasCycle) {
    await prisma.run.update({ where: { id: params.runId }, data: { status: "failed", finishedAt: new Date(), durationMs: 0, meta: { reason: "Cycle detected" } } });
    return;
  }

  const nodeById = new Map(executionNodes.map((node) => [node.id, node]));
  const executionEdgeMap = new Map<string, InputEdge[]>();
  const incoming = new Map<string, string[]>(executionNodes.map((node) => [node.id, []]));
  const outgoing = new Map<string, string[]>(executionNodes.map((node) => [node.id, []]));
  for (const edge of executionEdges) {
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    executionEdgeMap.set(edge.target, [...(executionEdgeMap.get(edge.target) ?? []), edge]);
  }

  const unresolvedDeps = new Map<string, number>(executionNodes.map((node) => [node.id, (incoming.get(node.id) ?? []).length]));
  const readyQueue = executionNodes.filter((node) => (incoming.get(node.id) ?? []).length === 0).map((node) => node.id);
  const outputMap = new Map<string, unknown>();
  const failedNodeSet = new Set<string>();
  const startedAt = Date.now();

  while (readyQueue.length) {
    const currentBatch = [...readyQueue];
    readyQueue.splice(0, readyQueue.length);

    await Promise.all(
      currentBatch.map(async (nodeId) => {
        const node = nodeById.get(nodeId);
        if (!node) return;

        const dependencyIds = incoming.get(nodeId) ?? [];
        if (dependencyIds.some((dependencyId) => failedNodeSet.has(dependencyId))) {
          failedNodeSet.add(nodeId);
          await prisma.runNode.create({
            data: {
              runId: params.runId,
              nodeId,
              status: "failed",
              inputs: { skipped: true, reason: "Dependency failed" },
              error: "Dependency failed",
              startedAt: new Date(),
              finishedAt: new Date(),
              durationMs: 0,
            },
          });
        } else {
          const nodeStarted = Date.now();
          await prisma.runNode.create({
            data: {
              runId: params.runId,
              nodeId,
              status: "running",
              inputs: {
                dependencies: dependencyIds.map((dependencyId) => ({ nodeId: dependencyId, output: safeJson(outputMap.get(dependencyId)) })),
                data: safeJson(node.data),
              },
            },
          });

          try {
            const output = await executeNodeThroughTrigger({
              runId: params.runId,
              node,
              dependencyIds,
              outputMap,
              incomingEdges: executionEdgeMap.get(nodeId) ?? [],
            });
            outputMap.set(nodeId, output);

            await prisma.runNode.updateMany({
              where: { runId: params.runId, nodeId },
              data: {
                status: "success",
                outputs: { output: safeJson(output) },
                finishedAt: new Date(),
                durationMs: Date.now() - nodeStarted,
              },
            });
          } catch (error) {
            failedNodeSet.add(nodeId);
            await prisma.runNode.updateMany({
              where: { runId: params.runId, nodeId },
              data: {
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
                finishedAt: new Date(),
                durationMs: Date.now() - nodeStarted,
              },
            });
          }
        }

        for (const nextNodeId of outgoing.get(nodeId) ?? []) {
          const left = (unresolvedDeps.get(nextNodeId) ?? 1) - 1;
          unresolvedDeps.set(nextNodeId, left);
          if (left === 0) readyQueue.push(nextNodeId);
        }
      }),
    );
  }

  const hasFailure = failedNodeSet.size > 0;
  await prisma.run.update({
    where: { id: params.runId },
    data: {
      status: hasFailure ? "partial" : "success",
      finishedAt: new Date(),
      durationMs: Date.now() - startedAt,
    },
  });
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

    return triggerAndWait<typeof payload, { url: string }>("crop-image-task", payload);
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
    return triggerAndWait<typeof payload, { url: string }>("extract-frame-task", payload);
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

    return triggerAndWait<typeof payload, { text: string }>("llm-node-task", payload);
  }

  return {};
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (!appUrl) return undefined;
  return `${appUrl.replace(/\/$/, "")}/api/trigger/callback`;
}