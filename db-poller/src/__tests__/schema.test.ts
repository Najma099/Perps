import { describe, it, expect } from "bun:test";
import {
  OrderCreatedSchema,
  OrderUpdatedSchema,
  OrderCancelledSchema,
  FillCreatedSchema,
  PositionOpenedSchema,
  PositionClosedSchema,
  BalanceUpdatedSchema,
} from "../types/schema";

describe("OrderCreatedSchema", () => {
  const valid = {
    orderId: "o1",
    correlationId: "c1",
    userId: "u1",
    market: "BTCUSDT",
    side: "buy" as const,
    qty: 1,
    price: 50000,
    leverage: 10,
    orderType: "limit" as const,
    status: "open",
    createdAt: Date.now(),
  };

  it("accepts valid input", () => {
    expect(OrderCreatedSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid side", () => {
    expect(
      OrderCreatedSchema.safeParse({ ...valid, side: "hold" }).success,
    ).toBe(false);
  });

  it("rejects invalid orderType", () => {
    expect(
      OrderCreatedSchema.safeParse({ ...valid, orderType: "stop" }).success,
    ).toBe(false);
  });

  it("rejects missing orderId", () => {
    const { orderId, ...rest } = valid;
    expect(OrderCreatedSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects non-number qty", () => {
    expect(
      OrderCreatedSchema.safeParse({ ...valid, qty: "one" }).success,
    ).toBe(false);
  });
});

describe("OrderUpdatedSchema", () => {
  it("accepts valid status values", () => {
    for (const status of ["open", "filled", "partially_filled", "cancelled"]) {
      expect(
        OrderUpdatedSchema.safeParse({
          orderId: "o1",
          userId: "u1",
          status,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    expect(
      OrderUpdatedSchema.safeParse({
        orderId: "o1",
        userId: "u1",
        status: "pending",
      }).success,
    ).toBe(false);
  });
});

describe("OrderCancelledSchema", () => {
  it("accepts valid cancelled event", () => {
    expect(
      OrderCancelledSchema.safeParse({
        orderId: "o1",
        userId: "u1",
        market: "BTCUSDT",
        status: "cancelled",
      }).success,
    ).toBe(true);
  });

  it("rejects non-cancelled status", () => {
    expect(
      OrderCancelledSchema.safeParse({
        orderId: "o1",
        userId: "u1",
        market: "BTCUSDT",
        status: "open",
      }).success,
    ).toBe(false);
  });
});

describe("FillCreatedSchema", () => {
  const valid = {
    fillId: "f1",
    side: "buy" as const,
    maker: "u1",
    taker: "u2",
    market: "BTCUSDT",
    qty: 0.5,
    price: 50000,
    long: "order-1",
    short: "order-2",
    createdAt: Date.now(),
  };

  it("accepts valid input", () => {
    expect(FillCreatedSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid side", () => {
    expect(
      FillCreatedSchema.safeParse({ ...valid, side: "hold" }).success,
    ).toBe(false);
  });

  it("rejects missing fillId", () => {
    const { fillId, ...rest } = valid;
    expect(FillCreatedSchema.safeParse(rest).success).toBe(false);
  });
});

describe("PositionOpenedSchema", () => {
  const valid = {
    positionId: "p1",
    userId: "u1",
    market: "BTCUSDT",
    type: "long" as const,
    qty: 1,
    margin: 5000,
    leverage: 10,
    averagePrice: 50000,
    liquidationPrice: 47500,
    positionStatus: "open",
    createdAt: Date.now(),
  };

  it("accepts valid long position", () => {
    expect(PositionOpenedSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts valid short position", () => {
    expect(
      PositionOpenedSchema.safeParse({ ...valid, type: "short" }).success,
    ).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(
      PositionOpenedSchema.safeParse({ ...valid, type: "neutral" }).success,
    ).toBe(false);
  });

  it("rejects missing leverage", () => {
    const { leverage, ...rest } = valid;
    expect(PositionOpenedSchema.safeParse(rest).success).toBe(false);
  });
});

describe("PositionClosedSchema", () => {
  it("accepts valid input", () => {
    expect(
      PositionClosedSchema.safeParse({
        positionId: "p1",
        userId: "u1",
        market: "BTCUSDT",
        realizedPnl: -500,
        closedAt: Date.now(),
      }).success,
    ).toBe(true);
  });

  it("accepts negative realizedPnl", () => {
    const result = PositionClosedSchema.safeParse({
      positionId: "p1",
      userId: "u1",
      market: "BTCUSDT",
      realizedPnl: -1234.56,
      closedAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing positionId", () => {
    expect(
      PositionClosedSchema.safeParse({
        userId: "u1",
        market: "BTCUSDT",
        realizedPnl: 0,
        closedAt: Date.now(),
      }).success,
    ).toBe(false);
  });
});

describe("BalanceUpdatedSchema", () => {
  it("accepts valid input", () => {
    expect(
      BalanceUpdatedSchema.safeParse({
        userId: "u1",
        balance: { available: 95000, locked: 5000 },
      }).success,
    ).toBe(true);
  });

  it("rejects missing balance object", () => {
    expect(
      BalanceUpdatedSchema.safeParse({ userId: "u1" }).success,
    ).toBe(false);
  });

  it("rejects balance without available", () => {
    expect(
      BalanceUpdatedSchema.safeParse({
        userId: "u1",
        balance: { locked: 5000 },
      }).success,
    ).toBe(false);
  });

  it("rejects balance without locked", () => {
    expect(
      BalanceUpdatedSchema.safeParse({
        userId: "u1",
        balance: { available: 95000 },
      }).success,
    ).toBe(false);
  });
});
