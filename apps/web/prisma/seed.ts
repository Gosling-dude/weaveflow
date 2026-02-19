import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { clerkId: "seed-clerk-id" },
    update: {},
    create: {
      clerkId: "seed-clerk-id",
      email: "seed@weaveflow.local",
    },
  });

  await prisma.workflow.create({
    data: {
      userId: user.id,
      title: "Product Marketing Kit Generator",
      nodes: [],
      edges: [],
    },
  });
}

void main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });