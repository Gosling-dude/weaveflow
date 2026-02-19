import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUser } from "@/lib/server-auth";
import { workflowPayloadSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const dbUser = await requireDbUser();
    const body = await request.json();
    const parsed = workflowPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const workflow = await prisma.workflow.create({
      data: {
        userId: dbUser.id,
        title: parsed.data.title,
        nodes: parsed.data.nodes,
        edges: parsed.data.edges,
      },
    });

    return NextResponse.json({ id: workflow.id });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}