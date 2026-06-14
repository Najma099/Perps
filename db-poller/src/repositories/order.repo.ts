import { prisma } from "@repo/db";
import { ensureUser } from "./ensure-user.js";

import type {
  OrderSide,
  OrderType,
  OrderStatus,
} from "@repo/db/prisma/generated/prisma/enums";

export async function createOrder(data: {
  orderId: string;
  correlationId: string;
  userId: string;
  market: string;
  side: OrderSide;
  qty: number;
  price: number;
  leverage: number;
  orderType: OrderType;
}) {
  await ensureUser(data.userId);
  return prisma.order.create({ data });
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  try {
    return await prisma.order.update({
      where: { orderId },
      data: { status },
    });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return;
    }
    throw err;
  }
}

export async function getOrdersByUserId(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOpenOrdersByUserId(userId: string) {
  return prisma.order.findMany({
    where: { userId, status: "open" },
    orderBy: { createdAt: "desc" },
  });
}
