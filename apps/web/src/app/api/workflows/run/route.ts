import { NextResponse } from "next/server";
import { after } from "next/server";
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

    after(async () => {
      await executeRun({
        runId: run.id,
      });
    });

    return NextResponse.json({ runId: run.id });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
