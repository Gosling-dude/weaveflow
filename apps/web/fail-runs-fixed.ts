import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const updatedRuns = await prisma.run.updateMany({
        where: { status: 'running' },
        data: { status: 'failed', finishedAt: new Date() } as any
    });

    const updatedNodes = await prisma.runNode.updateMany({
        where: { status: 'running' },
        data: { status: 'failed', finishedAt: new Date(), error: 'Stuck in running state (Trigger worker not responding or webhook failed)' } as any
    });

    console.log(`Updated ${updatedRuns.count} runs and ${updatedNodes.count} nodes to failed.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
