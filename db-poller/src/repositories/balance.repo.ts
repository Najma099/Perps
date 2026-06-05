import { prisma } from "@repo/db";

async function ensureUser(userId: string) {
  const exists = await prisma.user.findUnique({ where: { userId }, select: { userId: true } });
  if (!exists) {
    await prisma.user.create({
      data: { userId, username: `usr-${userId}`, password: "" },
    });
  }
}

export async function upsertBalance(data: {
  userId: string;
  available: number;
  locked: number;
}) {
  await ensureUser(data.userId);
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