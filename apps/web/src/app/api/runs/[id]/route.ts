import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUser } from "@/lib/server-auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const dbUser = await requireDbUser();
    const { id } = await params;
    const run = await prisma.run.findFirst({ where: { id, userId: dbUser.id }, include: { nodes: true } });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(run);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}