import { prisma } from "@repo/db";
import type { OrderSide } from "@repo/db/prisma/generated/prisma/enums";

export async function createFill(data: {
  fillId: string;
  orderId: string;
  market: string;
  side: OrderSide;
  qty: number;
  price: number;
  maker: string;
  taker: string;
}) {
  return prisma.fill.create({ data });
}

export async function getFillsByUserId(userId: string) {
  return prisma.fill.findMany({
    where: {
      OR: [{ maker: userId }, { taker: userId }],
    },
    orderBy: { createdAt: "desc" },
  });
}
