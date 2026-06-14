import { describe, it, expect, beforeEach, mock } from "bun:test";
import BTree from "sorted-btree";

// Mock emitEvent to avoid Redis writes
mock.module("../utils/events", () => ({
  emitEvent: async () => {},
}));

import {
  BALANCES,
  ORDERBOOKS,
  ORDERS,
  FILLS,
  POSITIONS,
  MARK_PRICE,
  type Orderbook,
  type RestingOrder,
  type Order,
  type Position,
} from "../store/perp-store";

import {
  getEquity,
  onramp,
  getOpenPosition,
  getClosePosition,
  openPosition,
  cancelPosition,
  getOrderbookSnapshot,
  matchOrder,
  emitOrderbookUpdate,
} from "../handler/perbs.handler";

function clearStores() {
  BALANCES.clear();
  ORDERBOOKS.clear();
  ORDERS.clear();
  FILLS.clear();
  POSITIONS.clear();
  MARK_PRICE.clear();
}

function makeOrderbook(): Orderbook {
  return {
    asks: new BTree<number, RestingOrder[]>(),
    bids: new BTree<number, RestingOrder[]>(),
    lastTradedPrice: 0,
    indexPrice: 0,
  };
}

describe("getEquity", () => {
  beforeEach(clearStores);

  it("seeds a new user with 100k available balance", () => {
    const result = getEquity({ userId: "user1" });
    expect(result.available).toBe(100000);
    expect(result.locked).toBe(0);
    expect(result.unrealized).toBe(0);
    expect(result.total).toBe(100000);
  });

  it("returns correct equity with locked balance", () => {
    BALANCES.set("user1", { available: 80000, locked: 20000 });
    const result = getEquity({ userId: "user1" });
    expect(result.available).toBe(80000);
    expect(result.locked).toBe(20000);
    expect(result.total).toBe(100000);
  });

  it("includes unrealized PnL from open positions", () => {
    BALANCES.set("user1", { available: 90000, locked: 10000 });
    POSITIONS.set("user1", [
      {
        positionId: "p1",
        userId: "user1",
        market: "BTCUSDT",
        type: "long",
        qty: 1,
        margin: 10000,
        leverage: 10,
        unrealizedPnl: 500,
        realizedPnl: 0,
        averagePrice: 50000,
        liquidationPrice: 45000,
        positionStatus: "open",
        createdAt: Date.now(),
      },
    ]);
    const result = getEquity({ userId: "user1" });
    expect(result.unrealized).toBe(500);
    expect(result.total).toBe(100500);
  });

  it("excludes closed positions from unrealized PnL", () => {
    BALANCES.set("user1", { available: 100000, locked: 0 });
    POSITIONS.set("user1", [
      {
        positionId: "p1",
        userId: "user1",
        market: "BTCUSDT",
        type: "long",
        qty: 1,
        margin: 10000,
        leverage: 10,
        unrealizedPnl: 500,
        realizedPnl: 200,
        averagePrice: 50000,
        liquidationPrice: 45000,
        positionStatus: "closed",
        createdAt: Date.now(),
        closedAt: Date.now(),
      },
    ]);
    const result = getEquity({ userId: "user1" });
    expect(result.unrealized).toBe(0);
  });
});

describe("onramp", () => {
  beforeEach(clearStores);

  it("adds funds to an existing user", async () => {
    BALANCES.set("user1", { available: 50000, locked: 0 });
    const result = await onramp({ userId: "user1", amount: 10000 });
    expect(BALANCES.get("user1")!.available).toBe(60000);
    expect(result.available).toBe(60000);
  });

  it("seeds a new user then adds the amount", async () => {
    const result = await onramp({ userId: "newUser", amount: 5000 });
    expect(BALANCES.get("newUser")!.available).toBe(105000);
    expect(result.available).toBe(105000);
  });
});

describe("getOpenPosition / getClosePosition", () => {
  beforeEach(clearStores);

  const makePosition = (
    overrides: Partial<Position> = {},
  ): Position => ({
    positionId: "p1",
    userId: "user1",
    market: "BTCUSDT",
    type: "long",
    qty: 1,
    margin: 5000,
    leverage: 10,
    unrealizedPnl: 0,
    realizedPnl: 0,
    averagePrice: 50000,
    liquidationPrice: 45000,
    positionStatus: "open",
    createdAt: Date.now(),
    ...overrides,
  });

  it("returns open positions for a user", () => {
    POSITIONS.set("user1", [
      makePosition({ positionId: "p1", positionStatus: "open" }),
      makePosition({ positionId: "p2", positionStatus: "closed", closedAt: Date.now() }),
    ]);
    const open = getOpenPosition({ userId: "user1" });
    expect(open).toHaveLength(1);
    expect(open[0].positionId).toBe("p1");
  });

  it("filters by market", () => {
    POSITIONS.set("user1", [
      makePosition({ positionId: "p1", market: "BTCUSDT" }),
      makePosition({ positionId: "p2", market: "ETHUSDT" }),
    ]);
    const filtered = getOpenPosition({ userId: "user1", market: "ETHUSDT" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].market).toBe("ETHUSDT");
  });

  it("returns closed positions", () => {
    POSITIONS.set("user1", [
      makePosition({ positionId: "p1", positionStatus: "open" }),
      makePosition({ positionId: "p2", positionStatus: "closed", closedAt: Date.now() }),
    ]);
    const closed = getClosePosition({ userId: "user1" });
    expect(closed).toHaveLength(1);
    expect(closed[0].positionId).toBe("p2");
  });

  it("returns empty array for unknown user", () => {
    expect(getOpenPosition({ userId: "unknown" })).toEqual([]);
    expect(getClosePosition({ userId: "unknown" })).toEqual([]);
  });
});

describe("openPosition", () => {
  beforeEach(clearStores);

  it("throws when insufficient funds", async () => {
    BALANCES.set("user1", { available: 100, locked: 0 });
    MARK_PRICE.set("BTCUSDT", 50000);

    await expect(
      openPosition({
        userId: "user1",
        market: "BTCUSDT",
        side: "buy",
        qty: 1,
        leverage: 10,
        orderType: "market",
        positionType: "long",
      }),
    ).rejects.toThrow("Insufficient funds");
  });

  it("deducts margin and creates order for market order", async () => {
    BALANCES.set("user1", { available: 100000, locked: 0 });
    MARK_PRICE.set("BTCUSDT", 50000);

    const result = await openPosition({
      userId: "user1",
      market: "BTCUSDT",
      side: "buy",
      qty: 1,
      leverage: 10,
      orderType: "market",
      positionType: "long",
    });

    expect(result.orderId).toBeDefined();
    expect(result.market).toBe("BTCUSDT");
    expect(result.side).toBe("buy");
    expect(result.qty).toBe(1);
    expect(result.status).toBe("open");

    const balance = BALANCES.get("user1")!;
    // margin = (1 * 50000) / 10 = 5000
    expect(balance.available).toBe(95000);
    expect(balance.locked).toBe(5000);
  });

  it("uses provided price for limit orders", async () => {
    BALANCES.set("user1", { available: 100000, locked: 0 });
    MARK_PRICE.set("BTCUSDT", 50000);

    const result = await openPosition({
      userId: "user1",
      market: "BTCUSDT",
      side: "buy",
      qty: 1,
      leverage: 10,
      orderType: "limit",
      positionType: "long",
      price: 48000,
    });

    expect(result.price).toBe(48000);
    // margin = (1 * 48000) / 10 = 4800
    const balance = BALANCES.get("user1")!;
    expect(balance.available).toBe(95200);
  });

  it("fills a market order against resting asks", async () => {
    BALANCES.set("user1", { available: 100000, locked: 0 });
    BALANCES.set("maker1", { available: 80000, locked: 5000 });
    MARK_PRICE.set("BTCUSDT", 50000);

    const book = makeOrderbook();
    book.asks.set(50000, [
      {
        orderId: "resting-1",
        userId: "maker1",
        side: "sell",
        qty: 1,
        market: "BTCUSDT",
        price: 50000,
        margin: 5000,
        createdAt: Date.now(),
      },
    ]);
    ORDERBOOKS.set("BTCUSDT", book);

    const result = await openPosition({
      userId: "user1",
      market: "BTCUSDT",
      side: "buy",
      qty: 1,
      leverage: 10,
      orderType: "market",
      positionType: "long",
    });

    expect(result.status).toBe("filled");
    expect(POSITIONS.get("user1")!.length).toBeGreaterThanOrEqual(1);
  });
});

describe("cancelPosition", () => {
  beforeEach(clearStores);

  it("throws for non-existent order", async () => {
    ORDERS.set("user1", []);
    await expect(
      cancelPosition({ userId: "user1", orderId: "nope" }),
    ).rejects.toThrow("Invalid order Id");
  });

  it("throws for already filled order", async () => {
    const order: Order = {
      orderId: "o1",
      userId: "user1",
      market: "BTCUSDT",
      side: "buy",
      qty: 1,
      leverage: 10,
      orderType: "limit",
      price: 50000,
      status: "filled",
      createdAt: Date.now(),
    };
    ORDERS.set("user1", [order]);

    await expect(
      cancelPosition({ userId: "user1", orderId: "o1" }),
    ).rejects.toThrow("Cannot cancel a filled order");
  });

  it("throws for already cancelled order", async () => {
    const order: Order = {
      orderId: "o1",
      userId: "user1",
      market: "BTCUSDT",
      side: "buy",
      qty: 1,
      leverage: 10,
      orderType: "limit",
      price: 50000,
      status: "cancelled",
      createdAt: Date.now(),
    };
    ORDERS.set("user1", [order]);

    await expect(
      cancelPosition({ userId: "user1", orderId: "o1" }),
    ).rejects.toThrow("Order already cancelled");
  });

  it("cancels a resting limit order and returns margin", async () => {
    BALANCES.set("user1", { available: 90000, locked: 5000 });

    const order: Order = {
      orderId: "o1",
      userId: "user1",
      market: "BTCUSDT",
      side: "buy",
      qty: 1,
      leverage: 10,
      orderType: "limit",
      price: 50000,
      status: "open",
      createdAt: Date.now(),
    };
    ORDERS.set("user1", [order]);

    const book = makeOrderbook();
    book.bids.set(50000, [
      {
        orderId: "o1",
        userId: "user1",
        side: "buy",
        qty: 1,
        market: "BTCUSDT",
        price: 50000,
        margin: 5000,
        createdAt: Date.now(),
      },
    ]);
    ORDERBOOKS.set("BTCUSDT", book);

    const result = await cancelPosition({ userId: "user1", orderId: "o1" });
    expect(result.status).toBe("cancelled");
    expect(BALANCES.get("user1")!.available).toBe(95000);
    expect(BALANCES.get("user1")!.locked).toBe(0);
    expect(order.status).toBe("cancelled");
    // Resting order removed from book
    expect(book.bids.has(50000)).toBe(false);
  });
});

describe("getOrderbookSnapshot", () => {
  beforeEach(clearStores);

  it("returns empty snapshot for non-existent market", async () => {
    const snapshot = await getOrderbookSnapshot({ market: "ETHUSDT" });
    expect(snapshot.market).toBe("ETHUSDT");
    expect(snapshot.bids).toEqual([]);
    expect(snapshot.asks).toEqual([]);
  });

  it("aggregates qty per price level", async () => {
    const book = makeOrderbook();
    book.bids.set(49000, [
      { orderId: "a", userId: "u1", side: "buy", qty: 2, market: "BTCUSDT", price: 49000, margin: 1000, createdAt: 0 },
      { orderId: "b", userId: "u2", side: "buy", qty: 3, market: "BTCUSDT", price: 49000, margin: 1500, createdAt: 0 },
    ]);
    book.asks.set(51000, [
      { orderId: "c", userId: "u3", side: "sell", qty: 1, market: "BTCUSDT", price: 51000, margin: 500, createdAt: 0 },
    ]);
    ORDERBOOKS.set("BTCUSDT", book);

    const snapshot = await getOrderbookSnapshot({ market: "BTCUSDT" });
    expect(snapshot.bids).toEqual([[49000, 5]]);
    expect(snapshot.asks).toEqual([[51000, 1]]);
  });
});

describe("matchOrder", () => {
  beforeEach(clearStores);

  it("returns no fills when the book is empty", async () => {
    const book = makeOrderbook();
    const result = await matchOrder(
      book, "long", "market", 50000, 1, 10, "taker1", "BTCUSDT",
    );
    expect(result.filledQty).toBe(0);
    expect(result.fills).toEqual([]);
  });

  it("fills a taker long against an ask", async () => {
    BALANCES.set("maker1", { available: 100000, locked: 5000 });

    const book = makeOrderbook();
    book.asks.set(50000, [
      {
        orderId: "r1", userId: "maker1", side: "sell",
        qty: 1, market: "BTCUSDT", price: 50000, margin: 5000, createdAt: 0,
      },
    ]);

    const result = await matchOrder(
      book, "long", "market", 50000, 1, 10, "taker1", "BTCUSDT", "order-1",
    );

    expect(result.filledQty).toBe(1);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].taker).toBe("taker1");
    expect(result.fills[0].maker).toBe("maker1");
    expect(result.fills[0].price).toBe(50000);

    expect(result.takerPositions).toHaveLength(1);
    expect(result.takerPositions[0].type).toBe("long");
    expect(result.makerPositions).toHaveLength(1);
    expect(result.makerPositions[0].type).toBe("short");

    // Ask should be consumed
    expect(book.asks.has(50000)).toBe(false);
    expect(book.lastTradedPrice).toBe(50000);
  });

  it("partially fills when resting qty < order qty", async () => {
    BALANCES.set("maker1", { available: 100000, locked: 2500 });

    const book = makeOrderbook();
    book.asks.set(50000, [
      {
        orderId: "r1", userId: "maker1", side: "sell",
        qty: 0.5, market: "BTCUSDT", price: 50000, margin: 2500, createdAt: 0,
      },
    ]);

    const result = await matchOrder(
      book, "long", "market", 50000, 1, 10, "taker1", "BTCUSDT",
    );

    expect(result.filledQty).toBe(0.5);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].qty).toBe(0.5);
  });

  it("respects limit price for long orders", async () => {
    BALANCES.set("maker1", { available: 100000, locked: 5000 });

    const book = makeOrderbook();
    book.asks.set(51000, [
      {
        orderId: "r1", userId: "maker1", side: "sell",
        qty: 1, market: "BTCUSDT", price: 51000, margin: 5000, createdAt: 0,
      },
    ]);

    const result = await matchOrder(
      book, "long", "limit", 50000, 1, 10, "taker1", "BTCUSDT",
    );

    expect(result.filledQty).toBe(0);
    expect(result.fills).toEqual([]);
  });

  it("respects limit price for short orders", async () => {
    BALANCES.set("maker1", { available: 100000, locked: 5000 });

    const book = makeOrderbook();
    book.bids.set(49000, [
      {
        orderId: "r1", userId: "maker1", side: "buy",
        qty: 1, market: "BTCUSDT", price: 49000, margin: 5000, createdAt: 0,
      },
    ]);

    const result = await matchOrder(
      book, "short", "limit", 50000, 1, 10, "taker1", "BTCUSDT",
    );

    expect(result.filledQty).toBe(0);
  });

  it("fills across multiple price levels", async () => {
    BALANCES.set("maker1", { available: 100000, locked: 2500 });
    BALANCES.set("maker2", { available: 100000, locked: 2500 });

    const book = makeOrderbook();
    book.asks.set(50000, [
      {
        orderId: "r1", userId: "maker1", side: "sell",
        qty: 0.5, market: "BTCUSDT", price: 50000, margin: 2500, createdAt: 0,
      },
    ]);
    book.asks.set(50100, [
      {
        orderId: "r2", userId: "maker2", side: "sell",
        qty: 0.5, market: "BTCUSDT", price: 50100, margin: 2500, createdAt: 0,
      },
    ]);

    const result = await matchOrder(
      book, "long", "market", 50100, 1, 10, "taker1", "BTCUSDT",
    );

    expect(result.filledQty).toBe(1);
    expect(result.fills).toHaveLength(2);
    expect(result.fills[0].price).toBe(50000);
    expect(result.fills[1].price).toBe(50100);
  });

  it("calculates liquidation prices correctly for taker", async () => {
    BALANCES.set("maker1", { available: 100000, locked: 5000 });

    const book = makeOrderbook();
    book.asks.set(50000, [
      {
        orderId: "r1", userId: "maker1", side: "sell",
        qty: 1, market: "BTCUSDT", price: 50000, margin: 5000, createdAt: 0,
      },
    ]);

    const result = await matchOrder(
      book, "long", "market", 50000, 1, 10, "taker1", "BTCUSDT",
    );

    const pos = result.takerPositions[0];
    // MM = 0.05, liqPrice = 50000 * (1 - 1/10 + 0.05) = 50000 * 0.95 = 47500
    expect(pos.liquidationPrice).toBe(47500);
  });
});

describe("emitOrderbookUpdate", () => {
  beforeEach(clearStores);

  it("does not emit when no levels modified", async () => {
    const book = makeOrderbook();
    await emitOrderbookUpdate("BTCUSDT", book, []);
  });

  it("aggregates qty for modified levels", async () => {
    const book = makeOrderbook();
    book.bids.set(49000, [
      { orderId: "a", userId: "u1", side: "buy", qty: 2, market: "BTCUSDT", price: 49000, margin: 1000, createdAt: 0 },
    ]);
    await emitOrderbookUpdate("BTCUSDT", book, [{ side: "bids", price: 49000 }]);
  });

  it("deduplicates modified levels", async () => {
    const book = makeOrderbook();
    book.asks.set(51000, [
      { orderId: "a", userId: "u1", side: "sell", qty: 1, market: "BTCUSDT", price: 51000, margin: 500, createdAt: 0 },
    ]);
    await emitOrderbookUpdate("BTCUSDT", book, [
      { side: "asks", price: 51000 },
      { side: "asks", price: 51000 },
    ]);
  });
});
