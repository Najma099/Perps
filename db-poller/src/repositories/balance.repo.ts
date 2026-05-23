import { prisma } from "@repo/db";

export async function upsertBalance(data: {
  userId: string;
  available: number;
  locked: number;
}) {
  return prisma.balance.upsert({
    where: { userId: data.userId },
    update: { available: data.available, locked: data.locked },
    create: {
      userId: data.userId,
      available: data.available,
      locked: data.locked,
    },
  });
}

export async function getBalance(userId: string) {
  return prisma.balance.findUnique({
    where: { userId },
  });
}

export async function getAllBalances() {
  return prisma.balance.findMany();
}