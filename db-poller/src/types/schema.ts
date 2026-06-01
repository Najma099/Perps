import { z } from "zod";

export const OrderCreatedSchema = z.object({
  orderId: z.string(),
  correlationId: z.string(),
  userId: z.string(),
  market: z.string(),
  side: z.enum(["buy", "sell"]),
  qty: z.number(),
  price: z.number(),
  leverage: z.number(),
  orderType: z.enum(["limit", "market"]),
  status: z.string(),
  createdAt: z.number(),
});

export const OrderUpdatedSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  status: z.enum(["open", "filled", "partially_filled", "cancelled"]),
});

export const OrderCancelledSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  market: z.string(),
  status: z.literal("cancelled"),
});

export const FillCreatedSchema = z.object({
  fillId: z.string(),
  side: z.enum(["buy", "sell"]),
  maker: z.string(),
  taker: z.string(),
  market: z.string(),
  qty: z.number(),
  price: z.number(),
  long: z.string(),
  short: z.string(),
  createdAt: z.number(),
});

export const PositionOpenedSchema = z.object({
  positionId: z.string(),
  userId: z.string(),
  market: z.string(),
  type: z.enum(["long", "short"]),
  qty: z.number(),
  margin: z.number(),
  leverage: z.number(),          
  averagePrice: z.number(),
  liquidationPrice: z.number(),
  positionStatus: z.string(),
  createdAt: z.number(),
});

export const PositionClosedSchema = z.object({
  positionId: z.string(),
  userId: z.string(),
  market: z.string(),
  realizedPnl: z.number(),
  closedAt: z.number(),
});

export const BalanceUpdatedSchema = z.object({
  userId: z.string(),
  balance: z.object({
    available: z.number(),
    locked: z.number(),
  }),
});
