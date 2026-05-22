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

const seedUserIfNeeded = (userId: string) => {
  if (!BALANCES.has(userId)) {
    BALANCES.set(userId, {
      available: 10000,
      locked: 0,
    });
  }
};

export const onramp = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  const amount = payload.amount as number;

  seedUserIfNeeded(userId);
  BALANCES.get(userId)!.available += amount;

  return BALANCES.get(userId);
};

export const getEquity = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  seedUserIfNeeded(userId);
  const UserBalance = BALANCES.get(userId);

  const available = UserBalance?.available!;
  const locked = UserBalance?.locked!;

  const unrealized = (POSITIONS.get(userId) ?? [])
    .filter((p) => p.positionStatus === "open")
    .reduce((sum, o) => sum + o.unrealizedPnl, 0);

  const total = available + locked + unrealized;
  return {
    available,
    locked,
    unrealized,
    total,
  };
};

export const getFills = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  const fills: Fill[] = [];

  for (const marketFills of FILLS.values()) {
    for (const fill of marketFills) {
      if (fill.maker == userId || fill.taker == userId) {
        fills.push(fill);
      }
    }
  }
  return fills;
};

export const getAllOrders = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;

  const orders = ORDERS.get(userId);
  return orders;
};

export const getOpenOrders = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;

  const openOrder = ORDERS.get(userId)?.filter((o) => o.status == "open");
  return openOrder;
};

export const getOpenPosition = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;

  const openPosition = POSITIONS.get(userId)?.filter(
    (o) => o.positionStatus === "open",
  );

  return openPosition;
};

export const getClosePosition = (payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  const closePosition = POSITIONS.get(userId)?.filter(
    (o) => o.positionStatus === "closed",
  );
  return closePosition;
};

export const openPosition = (payload: Record<string, unknown>) => {
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

  if (!POSITIONS.has(userId)) POSITIONS.set(userId, []);
  POSITIONS.get(userId)!.push(...takerPositions);

  for (const pos of makerPositions) {
    if (!POSITIONS.has(pos.userId)) POSITIONS.set(pos.userId, []);
    POSITIONS.get(pos.userId)!.push(pos);
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

  return order;
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

  return { filledQty, fills, takerPositions: takerPos, makerPositions: makerPos };
};

export const cancelPosition = (payload: Record<string, unknown>) => {
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
    const side = order.side === "buy" ? book.bids : book.asks;
    const level = side.get(order.price!);

    if (level) {
      const filtered = level.filter((o) => o.orderId !== order.orderId);
      if (filtered.length === 0) {
        side.delete(order.price!);
      } else {
        side.set(order.price!, filtered);
      }
    }
  }

  const userBalance = BALANCES.get(userId);
  if (userBalance) {
    userBalance.locked -= order.margin;
    userBalance.available += order.margin;
  }

  order.status = "cancelled";
  return {
    orderId,
    status: "cancelled",
  };
};
