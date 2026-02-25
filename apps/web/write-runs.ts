import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const stuckRuns = await prisma.run.findMany({
        where: { status: 'running' },
        include: { nodes: true },
        orderBy: { startedAt: 'desc' },
        take: 5
    });

    fs.writeFileSync('runs.json', JSON.stringify(stuckRuns, null, 2), 'utf-8');
    console.log("Wrote runs.json");
}

main().catch(console.error).finally(() => prisma.$disconnect());
