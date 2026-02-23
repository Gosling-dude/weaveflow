import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUser } from "@/lib/server-auth";
import { executeRun } from "@/lib/executor";
import { z } from "zod";

const bodySchema = z.object({
  scope: z.enum(["full", "single", "partial"]),
  nodeIds: z.array(z.string()).optional(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const dbUser = await requireDbUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const run = await prisma.run.create({
      data: {
        workflowId: id,
        userId: dbUser.id,
        type: parsed.data.scope,
        status: "running",
        meta: {
          nodeIds: parsed.data.nodeIds,
          nodes: parsed.data.nodes,
          edges: parsed.data.edges,
        },
      },
    });

    void executeRun({
      runId: run.id,
    });

    return NextResponse.json({ runId: run.id });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}