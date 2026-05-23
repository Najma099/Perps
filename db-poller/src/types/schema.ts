import { z } from "zod";

export const OrderCreatedSchema = z.object({
  orderId: z.string(),
  correlationId: z.string(),
  userId: z.string(),
  market: z.string(),
  side: z.enum(["buy", "sell"]),
  qty: z.number(),
  price: z.number(),
  margin: z.number(),
  orderType: z.enum(["limit", "market"]),
  status: z.enum(["open", "filled", "partially_filled", "cancelled"]),
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
  side: z.enum(["long", "short"]),
  maker: z.string(),
  taker: z.string(),
  market: z.string(),
  qty: z.number(),
  price: z.number(),
  long: z.string(),
  short: z.string(),
  createdAt: z.number(),
});

export const BalanceUpdatedSchema = z.object({
  userId: z.string(),
  balance: z.object({
    available: z.number(),
    locked: z.number(),
  }),
});
