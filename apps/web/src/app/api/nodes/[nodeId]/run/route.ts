import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUser } from "@/lib/server-auth";
import { executeRun } from "@/lib/executor";
import { z } from "zod";

const payloadSchema = z.object({
  nodeIds: z.array(z.string()).optional(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});

export async function POST(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  try {
    const dbUser = await requireDbUser();
    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { nodeId } = await params;
    const run = await prisma.run.create({
      data: {
        userId: dbUser.id,
        type: "single",
        status: "running",
        meta: { nodeId },
      },
    });

    void executeRun({
      runId: run.id,
      scope: "single",
      nodeIds: [nodeId],
      nodes: parsed.data.nodes,
      edges: parsed.data.edges,
    });

    return NextResponse.json({ runId: run.id });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}