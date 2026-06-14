import { prisma } from "@repo/db";

export async function ensureUser(userId: string) {
  const exists = await prisma.user.findUnique({ where: { userId }, select: { userId: true } });
  if (!exists) {
    await prisma.user.create({
      data: { userId, username: `usr-${userId}`, password: "" },
    });
  }
}
