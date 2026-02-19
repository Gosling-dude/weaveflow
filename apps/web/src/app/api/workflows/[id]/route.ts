import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUser } from "@/lib/server-auth";
import { workflowPayloadSchema } from "@/lib/schemas";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const dbUser = await requireDbUser();
    const { id } = await params;
    const workflow = await prisma.workflow.findFirst({ where: { id, userId: dbUser.id } });
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(workflow);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const dbUser = await requireDbUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = workflowPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.workflow.findFirst({ where: { id, userId: dbUser.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const workflow = await prisma.workflow.update({
      where: { id },
      data: {
        title: parsed.data.title,
        nodes: parsed.data.nodes,
        edges: parsed.data.edges,
      },
    });
    return NextResponse.json({ id: workflow.id });
  } catch {
    return NextResponse.json({ error: "Unauthorized or not found" }, { status: 401 });
  }
}