import { prisma } from "@repo/db";
import type { PositionSide } from "@repo/db/prisma/generated/prisma/enums";

export async function upsertPosition(data: {
  positionId: string;
  userId: string;
  market: string;
  type: PositionSide;
  qty: number;
  margin: number;
  leverage: number;
  averagePrice: number;
  liquidationPrice: number;
  positionStatus: string;
  createdAt: Date;
}) {
  return prisma.position.upsert({
    where: { positionId: data.positionId },
    update: {},
    create: {
      positionId: data.positionId,
      userId: data.userId,
      market: data.market,
      type: data.type,
      qty: data.qty,
      margin: data.margin,
      leverage: data.leverage,
      averagePrice: data.averagePrice,
      liquidationPrice: data.liquidationPrice,
      positionStatus: data.positionStatus,
      realizedPnl: 0,
      createdAt: data.createdAt,
    },
  });
  
}


export async function closePosition(data: {
  positionId: string;
  realizedPnl: number;
  closedAt: Date;
}) {
  return prisma.position.update({
    where: { positionId: data.positionId },
    data: {
      positionStatus: "closed",
      realizedPnl: data.realizedPnl,
      closedAt: data.closedAt,
    },
  });

}

export async function getOpenPositionsByUser(userId: string, market?: string) {
  return prisma.position.findMany({
    where: {
      userId,
      positionStatus: "open",
      ...(market ? { market } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}
