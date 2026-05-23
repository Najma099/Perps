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

const seedUserIfNeeded = (userId: string) => {
  if (!BALANCES.has(userId)) {
    BALANCES.set(userId, {
      available: 10000,
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
  return (
    POSITIONS.get(userId)?.filter((o) => o.positionStatus === "open") ?? []
  );
};

export const getClosePosition = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  return (
    POSITIONS.get(userId)?.filter((o) => o.positionStatus === "closed") ?? []
  );
};

export const getFills = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  const fills: Fill[] = [];

  for (const marketFills of FILLS.values()) {
    for (const fill of marketFills) {
      if (fill.maker === userId || fill.taker === userId) {
        fills.push(fill);
      }
    }
  }
  return fills;
};

export const getAllOrders = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  return ORDERS.get(userId) ?? [];
};

export const getOpenOrders = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  return ORDERS.get(userId)?.filter((o) => o.status === "open") ?? [];
};

export const openPosition = async (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  const market = payload.market as string;
  const side = payload.side as OrderSide;
  const qty = payload.qty as number;
  const margin = payload.margin as number;
  const orderType = payload.orderType as OrderType;
  const price = payload.price as number;
  const positionType = payload.positionType as PositionType;

  seedUserIfNeeded(userId);
  const userBalance = BALANCES.get(userId)!;
  if (userBalance.available < margin) throw new Error("Insufficient funds");

  userBalance.available -= margin;
  userBalance.locked += margin;

  const order: Order = {
    orderId: crypto.randomUUID(),
    userId,
    market,
    side,
    qty,
    margin,
    orderType,
    price,
    status: "open",
    createdAt: Date.now(),
  };

  if (!ORDERS.has(userId)) ORDERS.set(userId, []);
  ORDERS.get(userId)!.push(order);

  await emitEvent("ORDER_CREATED", {
    orderId: order.orderId,
    userId,
    market,
    side,
    qty,
    price,
    margin,
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
      asks: new Map(),
      bids: new Map(),
      lastTradedPrice: MARK_PRICE.get(market) ?? 0,
      indexPrice: MARK_PRICE.get(market) ?? 0,
    });
  }

  const book = ORDERBOOKS.get(market)!;
  const { filledQty, fills, takerPositions, makerPositions } = matchOrder(
    book,
    positionType,
    orderType,
    price,
    qty,
    margin,
    userId,
    market,
  );

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

   
    await emitEvent("BALANCE_UPDATED", {
      userId: fill.taker,
      balance: BALANCES.get(fill.taker),
    });

    
    await emitEvent("BALANCE_UPDATED", {
      userId: fill.maker,
      balance: BALANCES.get(fill.maker),
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
      averagePrice: position.averagePrice,
      liquidationPrice: position.liquidationPrice,
      positionStatus: position.positionStatus,
      createdAt: position.createdAt,
    });
  }

  // maker positions
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
  }

  order.status =
    filledQty === 0 ? "open" : filledQty < qty ? "partially_filled" : "filled";

  // emit final order status
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
  if (order.status === "filled")
    throw new Error("Cannot cancel a filled order");
  if (order.status === "cancelled") throw new Error("Order already cancelled");

  const book = ORDERBOOKS.get(order.market);
  if (book) {
    const sideBook = order.side === "buy" ? book.bids : book.asks;
    const level = sideBook.get(order.price!);

    if (level) {
      const filtered = level.filter((o) => o.orderId !== order.orderId);
      if (filtered.length === 0) {
        sideBook.delete(order.price!);
      } else {
        sideBook.set(order.price!, filtered);
      }
    }
  }

  const userBalance = BALANCES.get(userId);
  if (userBalance) {
    userBalance.locked -= order.margin;
    userBalance.available += order.margin;
  }

  order.status = "cancelled";

  await emitEvent("ORDER_CANCELLED", {
    orderId: order.orderId,
    userId,
    market: order.market,
    status: "cancelled",
  });

  // balance released back to available
  await emitEvent("BALANCE_UPDATED", {
    userId,
    balance: BALANCES.get(userId),
  });

  return { orderId, status: "cancelled" };
};

export const matchOrder = (
  book: Orderbook,
  positionType: PositionType,
  orderType: OrderType,
  price: number,
  qty: number,
  margin: number,
  userId: string,
  market: string,
): {
  filledQty: number;
  fills: Fill[];
  takerPositions: Position[];
  makerPositions: Position[];
} => {
  const MM = 0.05;
  const opposite = positionType === "long" ? book.asks : book.bids;

  let filledQty = 0;
  const fills: Fill[] = [];
  const takerPos: Position[] = [];
  const makerPos: Position[] = [];

  while (filledQty < qty) {
    const remaining = qty - filledQty;
    const prices = [...opposite.keys()];
    if (prices.length === 0) break;

    const bestPrice =
      positionType === "long" ? Math.min(...prices) : Math.max(...prices);

    if (orderType === "limit") {
      if (positionType === "long" && bestPrice > price) break;
      if (positionType === "short" && bestPrice < price) break;
    }

    const level = opposite.get(bestPrice)!;
    const resting = level[0]!;

    const origQty = resting.qty;
    const origMargin = resting.margin;
    const fillQty = Math.min(resting.qty, remaining);
    const fillPrice = resting.price;

    fills.push({
      fillId: crypto.randomUUID(),
      side: positionType,
      maker: resting.userId,
      taker: userId,
      market,
      qty: fillQty,
      price: fillPrice,
      long: positionType === "long" ? userId : resting.userId,
      short: positionType === "short" ? userId : resting.userId,
      createdAt: Date.now(),
    });

    resting.qty -= fillQty;
    resting.margin -= (fillQty / origQty) * origMargin;
    if (resting.qty === 0) {
      level.shift();
      if (level.length === 0) opposite.delete(bestPrice);
    }

    const tMargin = (fillQty / qty) * margin;
    const tLev = (qty * price) / margin;
    const tLiqPrice =
      positionType === "long"
        ? fillPrice * (1 - 1 / tLev + MM)
        : fillPrice * (1 + 1 / tLev - MM);

    takerPos.push({
      positionId: crypto.randomUUID(),
      userId,
      market,
      type: positionType,
      qty: fillQty,
      margin: tMargin,
      unrealizedPnl: 0,
      realizedPnl: 0,
      averagePrice: fillPrice,
      liquidationPrice: tLiqPrice,
      positionStatus: "open",
      createdAt: Date.now(),
    });

    const mType = positionType === "long" ? "short" : "long";
    const mMargin = (fillQty / origQty) * origMargin;
    const mLev = (origQty * fillPrice) / origMargin;
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
      margin: mMargin,
      unrealizedPnl: 0,
      realizedPnl: 0,
      averagePrice: fillPrice,
      liquidationPrice: mLiqPrice,
      positionStatus: "open",
      createdAt: Date.now(),
    });

    const tBal = BALANCES.get(userId);
    if (tBal) tBal.locked -= tMargin;

    const mBal = BALANCES.get(resting.userId);
    if (mBal) mBal.locked -= mMargin;

    filledQty += fillQty;
    book.lastTradedPrice = fillPrice;
  }

  return {
    filledQty,
    fills,
    takerPositions: takerPos,
    makerPositions: makerPos,
  };
};
