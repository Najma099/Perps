import { prisma } from "@repo/db";

export async function getBalance(userId: string) {
  return prisma.balance.findUnique({
    where: { userId },
  });
}
