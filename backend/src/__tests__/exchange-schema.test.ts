import { describe, it, expect } from "bun:test";
import {
  onrampSchema,
  openPositionSchema,
  cancelPositionSchema,
  getEquitySchema,
  getOpenPositionsSchema,
  getClosedPositionsSchema,
  getOpenOrdersSchema,
  getAllOrdersSchema,
  getFillsSchema,
  engineMessageSchema,
} from "../types/exchange-schema";

describe("onrampSchema", () => {
  it("accepts valid input", () => {
    const result = onrampSchema.safeParse({ userId: "user1", amount: "100" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(100); // coerced from string
    }
  });

  it("rejects negative amount", () => {
    const result = onrampSchema.safeParse({ userId: "user1", amount: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = onrampSchema.safeParse({ userId: "user1", amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects missing userId", () => {
    const result = onrampSchema.safeParse({ amount: 100 });
    expect(result.success).toBe(false);
  });
});

describe("openPositionSchema", () => {
  it("accepts valid market order (price optional)", () => {
    const result = openPositionSchema.safeParse({
      userId: "user1",
      market: "BTCUSDT",
      side: "buy",
      positionType: "long",
      qty: 1,
      leverage: 10,
      orderType: "market",
    });
    expect(result.success).toBe(true);
  });

  it("requires price for limit orders", () => {
    const result = openPositionSchema.safeParse({
      userId: "user1",
      market: "BTCUSDT",
      side: "buy",
      positionType: "long",
      qty: 1,
      leverage: 10,
      orderType: "limit",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid limit order with price", () => {
    const result = openPositionSchema.safeParse({
      userId: "user1",
      market: "BTCUSDT",
      side: "sell",
      positionType: "short",
      qty: 0.5,
      leverage: 20,
      orderType: "limit",
      price: 50000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid side", () => {
    const result = openPositionSchema.safeParse({
      userId: "user1",
      market: "BTCUSDT",
      side: "invalid",
      positionType: "long",
      qty: 1,
      leverage: 10,
      orderType: "market",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid orderType", () => {
    const result = openPositionSchema.safeParse({
      userId: "user1",
      market: "BTCUSDT",
      side: "buy",
      positionType: "long",
      qty: 1,
      leverage: 10,
      orderType: "stop",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero qty", () => {
    const result = openPositionSchema.safeParse({
      userId: "user1",
      market: "BTCUSDT",
      side: "buy",
      positionType: "long",
      qty: 0,
      leverage: 10,
      orderType: "market",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative leverage", () => {
    const result = openPositionSchema.safeParse({
      userId: "user1",
      market: "BTCUSDT",
      side: "buy",
      positionType: "long",
      qty: 1,
      leverage: -5,
      orderType: "market",
    });
    expect(result.success).toBe(false);
  });
});

describe("cancelPositionSchema", () => {
  it("accepts valid input", () => {
    const result = cancelPositionSchema.safeParse({
      userId: "user1",
      orderId: "order-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing orderId", () => {
    const result = cancelPositionSchema.safeParse({ userId: "user1" });
    expect(result.success).toBe(false);
  });
});

describe("getEquitySchema", () => {
  it("accepts valid input", () => {
    const result = getEquitySchema.safeParse({ userId: "user1" });
    expect(result.success).toBe(true);
  });

  it("rejects missing userId", () => {
    const result = getEquitySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("getOpenPositionsSchema / getClosedPositionsSchema", () => {
  it("accepts valid input for open positions", () => {
    expect(
      getOpenPositionsSchema.safeParse({ userId: "u1", market: "BTCUSDT" })
        .success,
    ).toBe(true);
  });

  it("accepts valid input for closed positions", () => {
    expect(
      getClosedPositionsSchema.safeParse({ userId: "u1", market: "BTCUSDT" })
        .success,
    ).toBe(true);
  });

  it("rejects missing market", () => {
    expect(
      getOpenPositionsSchema.safeParse({ userId: "u1" }).success,
    ).toBe(false);
  });
});

describe("getOpenOrdersSchema / getAllOrdersSchema", () => {
  it("accepts valid input", () => {
    expect(
      getOpenOrdersSchema.safeParse({ userId: "u1", market: "BTCUSDT" })
        .success,
    ).toBe(true);
    expect(
      getAllOrdersSchema.safeParse({ userId: "u1", market: "ETHUSDT" }).success,
    ).toBe(true);
  });
});

describe("getFillsSchema", () => {
  it("accepts with optional market", () => {
    expect(getFillsSchema.safeParse({ userId: "u1" }).success).toBe(true);
    expect(
      getFillsSchema.safeParse({ userId: "u1", market: "BTCUSDT" }).success,
    ).toBe(true);
  });

  it("rejects missing userId", () => {
    expect(getFillsSchema.safeParse({}).success).toBe(false);
  });
});

describe("engineMessageSchema", () => {
  it("accepts valid onramp message", () => {
    const result = engineMessageSchema.safeParse({
      type: "onramp",
      payload: { userId: "user1", amount: 100 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid open_position message", () => {
    const result = engineMessageSchema.safeParse({
      type: "open_position",
      payload: {
        userId: "user1",
        market: "BTCUSDT",
        side: "buy",
        positionType: "long",
        qty: 1,
        leverage: 10,
        orderType: "market",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown type", () => {
    const result = engineMessageSchema.safeParse({
      type: "unknown_action",
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it("accepts cancel_position", () => {
    const result = engineMessageSchema.safeParse({
      type: "cancel_position",
      payload: { userId: "u1", orderId: "o1" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts get_equity", () => {
    const result = engineMessageSchema.safeParse({
      type: "get_equity",
      payload: { userId: "u1" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts get_fills", () => {
    const result = engineMessageSchema.safeParse({
      type: "get_fills",
      payload: { userId: "u1" },
    });
    expect(result.success).toBe(true);
  });
});
