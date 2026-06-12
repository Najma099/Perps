import { z } from "zod";

const orderSideSchema = z.enum(["buy", "sell"]);
const orderTypeSchema = z.enum(["limit", "market"]);
const positionTypeSchema = z.enum(["long", "short"]);

export const onrampSchema = z.object({
    userId: z.string(),
    amount: z.coerce.number().positive(),
});

export const openPositionSchema = z.discriminatedUnion("orderType", [
  z.object({
    userId: z.string(),
    market: z.string(),
    side: orderSideSchema,
    positionType: positionTypeSchema,
    qty: z.number().positive(),
    leverage: z.number().positive(),
    orderType: z.literal("market"),
    price: z.number().positive().optional(),
  }),
  z.object({
    userId: z.string(),
    market: z.string(),
    side: orderSideSchema,
    positionType: positionTypeSchema,
    qty: z.number().positive(),
    leverage: z.number().positive(),
    orderType: z.literal("limit"),
    price: z.number().positive(),
  }),
]);

export const cancelPositionSchema = z.object({
  userId: z.string(),
  orderId: z.string(),
});

export const getEquitySchema = z.object({
  userId: z.string(),
});

export const getOpenPositionsSchema = z.object({
  userId: z.string(),
  market: z.string(),
});

export const getClosedPositionsSchema = z.object({
  userId: z.string(),
  market: z.string(),
});

export const getOpenOrdersSchema = z.object({
  userId: z.string(),
  market: z.string(),
});

export const getAllOrdersSchema = z.object({
  userId: z.string(),
  market: z.string(),
});

export const getFillsSchema = z.object({
  userId: z.string(),
  market: z.string().optional(),
});

export const engineMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("onramp"), payload: onrampSchema }),
  z.object({ type: z.literal("open_position"), payload: openPositionSchema }),
  z.object({
    type: z.literal("cancel_position"),
    payload: cancelPositionSchema,
  }),
  z.object({ type: z.literal("get_equity"), payload: getEquitySchema }),
  z.object({
    type: z.literal("get_open_positions"),
    payload: getOpenPositionsSchema,
  }),
  z.object({
    type: z.literal("get_closed_positions"),
    payload: getClosedPositionsSchema,
  }),
  z.object({
    type: z.literal("get_open_orders"),
    payload: getOpenOrdersSchema,
  }),
  z.object({ type: z.literal("get_all_orders"), payload: getAllOrdersSchema }),
  z.object({ type: z.literal("get_fills"), payload: getFillsSchema }),
]);

export type OnrampPayload = z.infer<typeof onrampSchema>;
export type OpenPositionPayload = z.infer<typeof openPositionSchema>;
export type CancelPositionPayload = z.infer<typeof cancelPositionSchema>;
export type GetEquityPayload = z.infer<typeof getEquitySchema>;
export type GetOpenPositionsPayload = z.infer<typeof getOpenPositionsSchema>;
export type GetClosedPositionsPayload = z.infer<
  typeof getClosedPositionsSchema
>;
export type GetOpenOrdersPayload = z.infer<typeof getOpenOrdersSchema>;
export type GetAllOrdersPayload = z.infer<typeof getAllOrdersSchema>;
export type GetFillsPayload = z.infer<typeof getFillsSchema>;
export type EngineMessage = z.infer<typeof engineMessageSchema>;
