import type { RedisClientType } from "redis";
import type { RedisStreamMessage } from "../types/redisMessage.js";
import { createOrder, updateOrderStatus } from "../repositories/order.repo.js";
import { createFill } from "../repositories/fill.repo.js";
import { upsertBalance } from "../repositories/balance.repo.js";
import {
  BalanceUpdatedSchema,
  FillCreatedSchema,
  OrderCancelledSchema,
  OrderCreatedSchema,
  OrderUpdatedSchema,
  PositionOpenedSchema,
  PositionClosedSchema,
} from "../types/schema.js";
import {
  upsertPosition,
  closePosition,
} from "../repositories/position.repo.js";

export async function processEvent(
  entry: RedisStreamMessage,
  client: RedisClientType,
  queue: string,
): Promise<void> {
  const { type, payload: rawPayload } = entry.message;

  if (!type || !rawPayload) {
    console.error("Malformed event — missing type or payload", entry.id);
    await client.xAck(queue, "db-writers", entry.id);
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    console.error("Invalid JSON payload", entry.id);
    await client.xAck(queue, "db-writers", entry.id);
    return;
  }

  try {
    switch (type) {
      case "ORDER_CREATED": {
        const parsed = OrderCreatedSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("ORDER_CREATED invalid", parsed.error.message);
          break;
        }
        await createOrder({
          orderId: parsed.data.orderId,
          correlationId: parsed.data.correlationId,
          userId: parsed.data.userId,
          market: parsed.data.market,
          side: parsed.data.side,
          qty: parsed.data.qty,
          price: parsed.data.price,
          leverage: parsed.data.leverage,
          orderType: parsed.data.orderType,
        });
        console.log("ORDER_CREATED persisted", parsed.data.orderId);
        break;
      }

      case "ORDER_UPDATED": {
        const parsed = OrderUpdatedSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("ORDER_UPDATED invalid", parsed.error.message);
          break;
        }
        await updateOrderStatus(parsed.data.orderId, parsed.data.status);
        console.log(
          "ORDER_UPDATED persisted",
          parsed.data.orderId,
          parsed.data.status,
        );
        break;
      }

      case "ORDER_CANCELLED": {
        const parsed = OrderCancelledSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("ORDER_CANCELLED invalid", parsed.error.message);
          break;
        }
        await updateOrderStatus(parsed.data.orderId, "cancelled");
        console.log("ORDER_CANCELLED persisted", parsed.data.orderId);
        break;
      }

      case "FILL_CREATED": {
        const parsed = FillCreatedSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("FILL_CREATED invalid", parsed.error.message);
          break;
        }
        const orderId =
          parsed.data.side === "buy" ? parsed.data.long : parsed.data.short;
        if (!orderId) break;
        await createFill({
          fillId: parsed.data.fillId,
          orderId,
          market: parsed.data.market,
          side: parsed.data.side,
          qty: parsed.data.qty,
          price: parsed.data.price,
          maker: parsed.data.maker,
          taker: parsed.data.taker,
        });
        console.log("FILL_CREATED persisted", parsed.data.fillId);
        break;
      }

      case "POSITION_OPENED": {
        const parsed = PositionOpenedSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("POSITION_OPENED invalid", parsed.error.message);
          break;
        }
        await upsertPosition({
          positionId: parsed.data.positionId,
          userId: parsed.data.userId,
          market: parsed.data.market,
          type: parsed.data.type,
          qty: parsed.data.qty,
          margin: parsed.data.margin,
          leverage: parsed.data.leverage,
          averagePrice: parsed.data.averagePrice,
          liquidationPrice: parsed.data.liquidationPrice,
          positionStatus: parsed.data.positionStatus,
          createdAt: new Date(parsed.data.createdAt),
        });
        console.log("POSITION_OPENED persisted", parsed.data.positionId);
        break;
      }

      case "POSITION_CLOSED": {
        const parsed = PositionClosedSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("POSITION_CLOSED invalid", parsed.error.message);
          break;
        }
        await closePosition({
          positionId: parsed.data.positionId,
          realizedPnl: parsed.data.realizedPnl,
          closedAt: new Date(parsed.data.closedAt),
        });
        console.log("POSITION_CLOSED persisted", parsed.data.positionId);
        break;
      }

      case "BALANCE_UPDATED": {
        const parsed = BalanceUpdatedSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("BALANCE_UPDATED invalid", parsed.error.message);
          break;
        }
        await upsertBalance({
          userId: parsed.data.userId,
          available: parsed.data.balance.available,
          locked: parsed.data.balance.locked,
        });
        console.log("BALANCE_UPDATED persisted", parsed.data.userId);
        break;
      }

      default:
        console.warn("Unknown event type, skipping", type);
    }
  } catch (err) {
    console.error("Failed to process event", { type, id: entry.id, err });
  }

  await client.xAck(queue, "db-writers", entry.id);
}
