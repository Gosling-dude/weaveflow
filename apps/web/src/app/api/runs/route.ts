import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUser } from "@/lib/server-auth";

export async function GET() {
  try {
    const dbUser = await requireDbUser();
    const runs = await prisma.run.findMany({
      where: { userId: dbUser.id },
      include: { nodes: true },
      orderBy: { startedAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ runs });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}