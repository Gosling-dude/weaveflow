import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUser } from "@/lib/server-auth";
import { runRequestSchema } from "@/lib/schemas";
import { executeRun } from "@/lib/executor";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const dbUser = await requireDbUser();
    const body = await request.json();
    const parsed = runRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const run = await prisma.run.create({
      data: {
        workflowId: parsed.data.workflowId,
        userId: dbUser.id,
        type: parsed.data.scope,
        status: "running",
        meta: {
          nodeIds: parsed.data.nodeIds ?? [],
          nodes: parsed.data.nodes,
          edges: parsed.data.edges,
        },
      },
    });

    await executeRun({
      runId: run.id,
    });

    return NextResponse.json({ runId: run.id });
  } catch (err) {
    console.error("Run workflow error:", err);
    return NextResponse.json({ error: "Unauthorized or Internal Error" }, { status: 500 });
  }
}
