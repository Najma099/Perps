import { prisma } from "@repo/db";

export async function getBalance(userId: string) {
  return prisma.balance.findUnique({
    where: { userId },
  });
}

export async function deductBalance(userId: string, amount: number) {
  return prisma.balance.update({
    where: { userId },
    data: {
      available: { decrement: amount },
      locked: { increment: amount },
    },
  });
}

export async function releaseBalance(userId: string, amount: number) {
  return prisma.balance.update({
    where: { userId },
    data: {
      locked: { decrement: amount },
      available: { increment: amount },
    },
  });
}

export async function settleBalance(userId: string, amount: number) {
  return prisma.balance.update({
    where: { userId },
    data: {
      locked: { decrement: amount },
    },
  });
}
