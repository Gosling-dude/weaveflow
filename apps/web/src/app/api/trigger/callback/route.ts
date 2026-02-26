import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const callbackSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  status: z.enum(["running", "success", "failed"]),
  output: z.unknown().optional(),
  error: z.string().optional(),
  durationMs: z.number().optional(),
});

function verifySignature(payload: { runId: string, nodeId: string }, signature: string | null): string | null {
  const secret = process.env.TRIGGER_CALLBACK_SECRET || "super_secret_weaveflow_callback_key_2026";
  if (!secret) return "Missing TRIGGER_CALLBACK_SECRET in Vercel environment";
  if (!signature) return "Missing x-weaveflow-signature header";
  const digest = createHmac("sha256", secret)
    .update(`${payload.runId}:${payload.nodeId}`)
    .digest("hex");
  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length) return "Invalid signature length";
  if (!timingSafeEqual(expected, received)) return `Hash mismatch for payload ${payload.runId}:${payload.nodeId}`;
  return null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-weaveflow-signature");
  let parsedBody;
  try {
    parsedBody = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sigError = verifySignature(parsedBody, signature);
  if (sigError) {
    return NextResponse.json({ error: `Signature Error: ${sigError}` }, { status: 401 });
  }

  const parsed = callbackSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const updates = {
    status: payload.status,
    outputs: payload.output ? ({ output: payload.output } as object) : undefined,
    error: payload.error,
    finishedAt: payload.status === "running" ? undefined : new Date(),
    durationMs: payload.durationMs,
  };

  const existing = await prisma.runNode.findFirst({ where: { runId: payload.runId, nodeId: payload.nodeId } });
  if (!existing) {
    await prisma.runNode.create({
      data: {
        runId: payload.runId,
        nodeId: payload.nodeId,
        status: payload.status,
        inputs: {},
        outputs: payload.output ? ({ output: payload.output } as object) : undefined,
        error: payload.error,
        finishedAt: payload.status === "running" ? undefined : new Date(),
        durationMs: payload.durationMs,
      },
    });
  } else {
    await prisma.runNode.updateMany({
      where: { runId: payload.runId, nodeId: payload.nodeId },
      data: updates,
    });
  }

  // Trigger next step of the pipeline if the node actually finished
  if (payload.status !== "running") {
    const { resumeRun } = await import("@/lib/executor");
    await resumeRun(payload.runId);
  }

  return NextResponse.json({ ok: true });
}
