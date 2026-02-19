import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function requireDbUser() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const dbUser = await prisma.user.upsert({
    where: { clerkId: userId },
    update: {},
    create: {
      clerkId: userId,
    },
  });

  return dbUser;
}