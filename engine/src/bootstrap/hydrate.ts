import { prisma } from "@repo/db";
import BTree from "sorted-btree";
import {
  BALANCES,
  ORDERS,
  POSITIONS,
  ORDERBOOKS,
  type RestingOrder,
  type OrderSide,
  type OrderType,
  type OrderStatus,
  type PositionType,
} from "../store/perp-store";

async function connectWithRetry(maxRetries = 5, delayMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await prisma.$connect();
      return;
    } catch (err) {
      if (i < maxRetries - 1) {
        console.warn(`DB connection attempt ${i + 1}/${maxRetries} failed, retrying in ${delayMs}ms`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
}

export async function hydrateEngine() {
  try {
    await connectWithRetry();

    const balances = await prisma.balance.findMany();
    for (const b of balances) {
      BALANCES.set(b.userId, {
        available: b.available ?? 0,
        locked: b.locked ?? 0,
      });
    }
    console.log(`Hydrated ${balances.length} balances`);

    const staleOrders = await prisma.order.findMany({
      where: {
        market: "BTCUSDT",
        status: { in: ["open", "partially_filled"] },
        OR: [{ price: { gt: 70000 } }, { price: { lt: 50000 } }],
      },
    });
    if (staleOrders.length > 0) {
      await prisma.order.updateMany({
        where: { orderId: { in: staleOrders.map((o) => o.orderId) } },
        data: { status: "cancelled" },
      });
      console.log(`Marked ${staleOrders.length} stale orders as cancelled`);
    }

    const openOrders = await prisma.order.findMany({
      where: {
        status: { in: ["open", "partially_filled"] },
        market: "BTCUSDT",
        price: { gte: 50000, lte: 70000 },
      },
    });

    for (const order of openOrders) {
      if (!BALANCES.has(order.userId)) {
        BALANCES.set(order.userId, {
          available: 100000,
          locked: 0,
        });
      }
      if (!ORDERS.has(order.userId)) ORDERS.set(order.userId, []);
      ORDERS.get(order.userId)!.push({
        orderId: order.orderId,
        userId: order.userId,
        market: order.market,
        side: order.side as OrderSide,
        qty: order.qty,
        leverage: order.leverage,
        orderType: order.orderType as OrderType,
        price: order.price,
        status: order.status as OrderStatus,
        createdAt: order.createdAt.getTime(),
      });

      if (!ORDERBOOKS.has(order.market)) {
        ORDERBOOKS.set(order.market, {
          asks: new BTree(),
          bids: new BTree(),
          lastTradedPrice: 0,
          indexPrice: 0,
        });
      }

      const book = ORDERBOOKS.get(order.market)!;
      const sideBook = order.side === "buy" ? book.bids : book.asks;
      const margin = (order.qty * order.price) / order.leverage;

      const restingOrder: RestingOrder = {
        orderId: order.orderId,
        userId: order.userId,
        side: order.side as OrderSide,
        qty: order.qty,
        market: order.market,
        price: order.price,
        margin,
        createdAt: order.createdAt.getTime(),
      };

      if (!sideBook.has(order.price)) sideBook.set(order.price, []);
      sideBook.get(order.price)!.push(restingOrder);
    }
    console.log(`Hydrated ${openOrders.length} open orders`);

    const openPositions = await prisma.position.findMany({
      where: { positionStatus: "open" },
    });

    for (const p of openPositions) {
      if (!POSITIONS.has(p.userId)) POSITIONS.set(p.userId, []);
      POSITIONS.get(p.userId)!.push({
        positionId: p.positionId,
        userId: p.userId,
        market: p.market,
        type: p.type as PositionType,
        qty: p.qty,
        margin: p.margin,
        leverage: p.leverage,
        unrealizedPnl: 0,
        realizedPnl: p.realizedPnl,
        averagePrice: p.averagePrice,
        liquidationPrice: p.liquidationPrice,
        positionStatus: "open",
        createdAt: p.createdAt.getTime(),
      });
    }
    console.log(`Hydrated ${openPositions.length} open positions`);
  } catch (err) {
    console.warn(err);
    console.warn("DB unavailable - starting with empty state (hydrate skipped)");
  }
}
