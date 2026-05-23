import { prisma } from "@repo/db";

import type {
  OrderSide,
  OrderType,
  OrderStatus,
} from "@repo/db/prisma/generated/prisma/enums";

export async function createOrder(data: {
  correlationId: string;
  userId: string;
  market: string;
  side: OrderSide;
  qty: number;
  price: number;
  margin: number;
  orderType: OrderType;
}) {
  return prisma.order.create({ data });
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  return prisma.order.update({
    where: { orderId },
    data: { status },
  });
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
