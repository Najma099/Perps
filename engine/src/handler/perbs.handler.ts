import BTree from "sorted-btree";
import {
  BALANCES,
  ORDERBOOKS,
  ORDERS,
  FILLS,
  MARK_PRICE,
  POSITIONS,
  type Orderbook,
  type Fill,
  type OrderSide,
  type OrderType,
  type PositionType,
  type Position,
  type Order,
  type RestingOrder,
} from "../store/perp-store";

import { emitEvent } from "../utils/events";

export interface ModifiedLevel {
  side: "bids" | "asks";
  price: number;
}

let globalUpdateId = 0;

function nextUpdateId(): number {
  return ++globalUpdateId;
}

export async function emitOrderbookUpdate(
  market: string,
  book: Orderbook,
  modifiedLevels: ModifiedLevel[],
) {
  const changedBids: [number, number][] = [];
  const changedAsks: [number, number][] = [];
  const seen = new Set<string>();

  for (const mod of modifiedLevels) {
    const key = `${mod.side}:${mod.price}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const level =
      mod.side === "bids"
        ? book.bids.get(mod.price)
        : book.asks.get(mod.price);
    const qty = level ? level.reduce((sum, o) => sum + o.qty, 0) : 0;

    if (mod.side === "bids") {
      changedBids.push([mod.price, qty]);
    } else {
      changedAsks.push([mod.price, qty]);
    }
  }

  if (changedBids.length === 0 && changedAsks.length === 0) return;

  const id = nextUpdateId();
  await emitEvent("ORDERBOOK_UPDATE", {
    market,
    firstUpdateId: id,
    lastUpdateId: id,
    bids: changedBids,
    asks: changedAsks,
  });
}

const seedUserIfNeeded = (userId: string) => {
  if (!BALANCES.has(userId)) {
    BALANCES.set(userId, {
      available: 100000,
      locked: 0,
    });
  }
};

export const onramp = async (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  const amount = payload.amount as number;

  seedUserIfNeeded(userId);
  BALANCES.get(userId)!.available += amount;

  await emitEvent("BALANCE_UPDATED", {
    userId,
    balance: BALANCES.get(userId),
  });

  return BALANCES.get(userId);
};

export const getEquity = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  seedUserIfNeeded(userId);
  const userBalance = BALANCES.get(userId);

  const available = userBalance?.available ?? 0;
  const locked = userBalance?.locked ?? 0;

  const unrealized = (POSITIONS.get(userId) ?? [])
    .filter((p) => p.positionStatus === "open")
    .reduce((sum, o) => sum + o.unrealizedPnl, 0);

  const total = available + locked + unrealized;
  return { available, locked, unrealized, total };
};

export const getOpenPosition = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  const market = payload.market as string | undefined;
  const positions = POSITIONS.get(userId)?.filter(
    (o) => o.positionStatus === "open" && (!market || o.market === market),
  ) ?? [];
  return positions;
};

export const getClosePosition = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  const market = payload.market as string | undefined;
  const positions = POSITIONS.get(userId)?.filter(
    (o) => o.positionStatus === "closed" && (!market || o.market === market),
  ) ?? [];
  return positions;
};

export const openPosition = async (payload: Record<string, unknown>, correlationId?: string) => {
  const userId = payload.userId as string;
  const market = payload.market as string;
  const side = payload.side as OrderSide;
  const qty = payload.qty as number;
  const leverage = payload.leverage as number;
  const orderType = payload.orderType as OrderType;
  const positionType = payload.positionType as PositionType;
  const price = orderType === "market"
    ? (MARK_PRICE.get(market) ?? 0)
    : (payload.price as number);

  seedUserIfNeeded(userId);
  const userBalance = BALANCES.get(userId)!;
  const margin = (qty * price) / leverage;
  if (userBalance.available < margin) throw new Error("Insufficient funds");

  userBalance.available -= margin;
  userBalance.locked += margin;

  const order: Order = {
    orderId: crypto.randomUUID(),
    userId,
    market,
    side,
    qty,
    leverage,
    orderType, 
    price,
    status: "open",
    createdAt: Date.now(),
  };

  if (!ORDERS.has(userId)) ORDERS.set(userId, []);
  ORDERS.get(userId)!.push(order);

  await emitEvent("ORDER_CREATED", {
    orderId: order.orderId,
    correlationId: correlationId ?? "",
    userId,
    market,
    side,
    qty,
    price,
    leverage,
    orderType,
    status: order.status,
    createdAt: order.createdAt,
  });

  await emitEvent("BALANCE_UPDATED", {
    userId,
    balance: BALANCES.get(userId),
  });

  if (!ORDERBOOKS.has(market)) {
    ORDERBOOKS.set(market, {
      asks: new BTree<number, RestingOrder[]>(),
      bids: new BTree<number, RestingOrder[]>(),
      lastTradedPrice: MARK_PRICE.get(market) ?? 0,
      indexPrice: MARK_PRICE.get(market) ?? 0,
    });
  }

  const book = ORDERBOOKS.get(market)!;
  const { filledQty, fills, takerPositions, makerPositions, modifiedLevels } =
    await matchOrder(
      book,
      positionType,
      orderType,
      price,
      qty,
      leverage,
      userId,
      market,
      order.orderId,
    );

  const filledMargin = (filledQty / qty) * margin;
  userBalance.locked -= filledMargin;

  await emitEvent("BALANCE_UPDATED", {
    userId,
    balance: userBalance,
  });

  if (!FILLS.has(market)) FILLS.set(market, []);
  FILLS.get(market)!.push(...fills);

  for (const fill of fills) {
    await emitEvent("FILL_CREATED", {
      fillId: fill.fillId,
      side: fill.side,
      maker: fill.maker,
      taker: fill.taker,
      market: fill.market,
      qty: fill.qty,
      price: fill.price,
      long: fill.long,
      short: fill.short,
      createdAt: fill.createdAt,
    });

  }


  if (!POSITIONS.has(userId)) POSITIONS.set(userId, []);
  POSITIONS.get(userId)!.push(...takerPositions);

  for (const position of takerPositions) {
    await emitEvent("POSITION_OPENED", {
      positionId: position.positionId,
      userId: position.userId,
      market: position.market,
      type: position.type,
      qty: position.qty,
      margin: position.margin,
      leverage: position.leverage,
      averagePrice: position.averagePrice,
      liquidationPrice: position.liquidationPrice,
      positionStatus: position.positionStatus,
      createdAt: position.createdAt,
    });
  }

   for (const pos of makerPositions) {
    if (!POSITIONS.has(pos.userId)) POSITIONS.set(pos.userId, []);
    POSITIONS.get(pos.userId)!.push(pos);

    await emitEvent("POSITION_OPENED", {
      positionId: pos.positionId,
      userId: pos.userId,
      market: pos.market,
      type: pos.type,
      qty: pos.qty,
      margin: pos.margin,
      leverage: pos.leverage,
      averagePrice: pos.averagePrice,
      liquidationPrice: pos.liquidationPrice,
      positionStatus: pos.positionStatus,
      createdAt: pos.createdAt,
    });
  }

  if (filledQty < qty && orderType === "limit") {
    const restingOrder: RestingOrder = {
      orderId: order.orderId,
      userId,
      side,
      market,
      price,
      qty: qty - filledQty,
      margin: ((qty - filledQty) / qty) * margin,
      createdAt: Date.now(),
    };
    const sideBook = side === "buy" ? book.bids : book.asks;
    if (!sideBook.has(price)) sideBook.set(price, []);
    sideBook.get(price)!.push(restingOrder);

    const limitSide = side === "buy" ? "bids" : "asks";
    modifiedLevels.push({ side: limitSide, price });
  }

  order.status =
    filledQty === 0 ? "open" : filledQty < qty ? "partially_filled" : "filled";

  await emitOrderbookUpdate(market, book, modifiedLevels);

  await emitEvent("ORDER_UPDATED", {
    orderId: order.orderId,
    userId,
    market,
    status: order.status,
    filledQty,
    createdAt: order.createdAt,
  });

  return order;
};

export const cancelPosition = async (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  const orderId = payload.orderId as string;

  const userOrders = ORDERS.get(userId);
  const order = userOrders?.find((o) => o.orderId === orderId);

  if (!order) throw new Error("Invalid order Id");
  if (order.status === "filled") throw new Error("Cannot cancel a filled order");
  if (order.status === "cancelled") throw new Error("Order already cancelled");

  const book = ORDERBOOKS.get(order.market);
  if (!book) throw new Error("Orderbook not found");

  const sideName = order.side === "buy" ? "bids" : "asks";
  const sideBook = order.side === "buy" ? book.bids : book.asks;
  const level = sideBook.get(order.price!);
  const restingOrder = level?.find((o) => o.orderId === orderId);

  const marginToReturn = restingOrder?.margin ?? 0;

  if (level) {
    const filtered = level.filter((o) => o.orderId !== order.orderId);
    if (filtered.length === 0) {
      sideBook.delete(order.price!);
    } else {
      sideBook.set(order.price!, filtered);
    }
  }

  await emitOrderbookUpdate(order.market, book, [
    { side: sideName, price: order.price! },
  ]);

  const userBalance = BALANCES.get(userId);
  if (userBalance) {
    userBalance.locked    -= marginToReturn;
    userBalance.available += marginToReturn;
  }

  order.status = "cancelled";
  await emitEvent("ORDER_CANCELLED", {
    orderId: order.orderId,
    userId,
    market: order.market,
    status: "cancelled",
  });

  if (userBalance) {
    await emitEvent("BALANCE_UPDATED", {
      userId,
      balance: userBalance,
    });
  }


  return { orderId, status: "cancelled" };
};

export const getOrderbookSnapshot = async (
  payload: Record<string, unknown>,
) => {
  const market = payload.market as string;
  const book = ORDERBOOKS.get(market);
  if (!book) {
    return { market, lastUpdateId: globalUpdateId, bids: [], asks: [] };
  }

  const bids: [number, number][] = [];
  const asks: [number, number][] = [];

  for (const [price, orders] of book.bids.entries()) {
    const qty = orders.reduce((sum, o) => sum + o.qty, 0);
    bids.push([price, qty]);
  }

  for (const [price, orders] of book.asks.entries()) {
    const qty = orders.reduce((sum, o) => sum + o.qty, 0);
    asks.push([price, qty]);
  }

  return {
    market,
    lastUpdateId: globalUpdateId,
    bids: bids.reverse(),
    asks,
  };
};

export const matchOrder = async (
  book: Orderbook,
  positionType: PositionType,
  orderType: OrderType,
  price: number,
  qty: number,
  leverage: number,
  userId: string,
  market: string,
  takerOrderId?: string,
): Promise<{
  filledQty: number;
  fills: Fill[];
  takerPositions: Position[];
  makerPositions: Position[];
  modifiedLevels: ModifiedLevel[];
}> => {
  const MM = 0.05;
  const opposite = positionType === "long" ? book.asks : book.bids;

  let filledQty = 0;
  const fills: Fill[] = [];
  const takerPos: Position[] = [];
  const makerPos: Position[] = [];
  const modifiedLevels: ModifiedLevel[] = [];

  const takerMargin = (qty * price) / leverage;

  while (filledQty < qty) {
    const remaining = qty - filledQty;

    const bestPrice =
      positionType === "long" ? opposite.minKey() : opposite.maxKey();

    if (bestPrice === undefined) break;

    if (orderType === "limit") {
      if (positionType === "long" && bestPrice > price) break;
      if (positionType === "short" && bestPrice < price) break;
    }

    const modSide = positionType === "long" ? ("asks" as const) : ("bids" as const);
    modifiedLevels.push({ side: modSide, price: bestPrice });

    const level = opposite.get(bestPrice)!;
    const resting = level[0]!;

    const origQty = resting.qty;
    const origMargin = resting.margin;
    const fillQty = Math.min(resting.qty, remaining);
    const fillPrice = resting.price;

    fills.push({
      fillId: crypto.randomUUID(),
      side: positionType === "long" ? "buy" : "sell",
      maker: resting.userId,
      taker: userId,
      market,
      qty: fillQty,
      price: fillPrice,
      long: positionType === "long" ? (takerOrderId ?? "") : resting.orderId,
      short: positionType === "short" ? (takerOrderId ?? "") : resting.orderId,
      createdAt: Date.now(),
    });

    resting.qty -= fillQty;
    resting.margin -= (fillQty / origQty) * origMargin;
    if (resting.qty === 0) {
      level.shift();
      if (level.length === 0) opposite.delete(bestPrice);
    }

    const makerBalance = BALANCES.get(resting.userId);
    if (makerBalance === undefined) {
      throw new Error(`Balance not found for maker ${resting.userId}`);
    }
    makerBalance.locked -= (fillQty / origQty) * origMargin;

    await emitEvent("BALANCE_UPDATED", {
      userId: resting.userId,
      balance: makerBalance,
    });

    const tMargin = (fillQty / qty) * takerMargin;
    const tLiqPrice =
      positionType === "long"
        ? fillPrice * (1 - 1 / leverage + MM)
        : fillPrice * (1 + 1 / leverage - MM);

    takerPos.push({
      positionId: crypto.randomUUID(),
      userId,
      market,
      type: positionType,
      qty: fillQty,
      margin: isFinite(tMargin) ? tMargin : (fillQty * fillPrice) / leverage,
      leverage,                 
      unrealizedPnl: 0,
      realizedPnl: 0,
      averagePrice: fillPrice,
      liquidationPrice: tLiqPrice,
      positionStatus: "open",
      createdAt: Date.now(),
    });

    const mType: PositionType = positionType === "long" ? "short" : "long";
    const mMargin = (fillQty / origQty) * origMargin;
    const safeMargin = isFinite(mMargin) ? mMargin : (fillQty * fillPrice) / leverage;
    const mLev = origMargin > 0 ? (origQty * fillPrice) / origMargin : leverage;
    const mLiqPrice =
      mType === "long"
        ? fillPrice * (1 - 1 / mLev + MM)
        : fillPrice * (1 + 1 / mLev - MM);

    makerPos.push({
      positionId: crypto.randomUUID(),
      userId: resting.userId,
      market,
      type: mType,
      qty: fillQty,
      margin: safeMargin,
      leverage: mLev,           
      unrealizedPnl: 0,
      realizedPnl: 0,
      averagePrice: fillPrice,
      liquidationPrice: mLiqPrice,
      positionStatus: "open",
      createdAt: Date.now(),
    });

    filledQty += fillQty;
    book.lastTradedPrice = fillPrice;
  }

  return {
    filledQty,
    fills,
    takerPositions: takerPos,
    makerPositions: makerPos,
    modifiedLevels,
  };
};
