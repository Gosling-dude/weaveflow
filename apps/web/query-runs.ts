import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const stuckRuns = await prisma.run.findMany({
        where: { status: 'running' },
        include: { nodes: true },
        orderBy: { startedAt: 'desc' },
        take: 5
    });
    console.log("Stuck Runs:");
    console.dir(stuckRuns, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
