import { describe, it, expect, beforeEach, mock } from "bun:test";

// Mock emitEvent and liquidation
mock.module("../utils/events", () => ({
  emitEvent: async () => {},
}));

const liquidateCalls: { position: any; market: string; markPrice: number }[] = [];

mock.module("../handler/liquidation", () => ({
  liquidatePosition: async (position: any, market: string, markPrice: number) => {
    liquidateCalls.push({ position, market, markPrice });
  },
}));

import {
  BALANCES,
  ORDERBOOKS,
  POSITIONS,
  MARK_PRICE,
  type Position,
} from "../store/perp-store";

import { updateMarkPrice } from "../handler/mark-price-sweep";

function clearStores() {
  BALANCES.clear();
  ORDERBOOKS.clear();
  POSITIONS.clear();
  MARK_PRICE.clear();
  liquidateCalls.length = 0;
}

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
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
    liquidationPrice: 47500,
    positionStatus: "open",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("updateMarkPrice", () => {
  beforeEach(clearStores);

  it("updates the MARK_PRICE map", async () => {
    await updateMarkPrice("BTCUSDT", 51000);
    expect(MARK_PRICE.get("BTCUSDT")).toBe(51000);
  });

  it("calculates unrealizedPnl for long positions", async () => {
    const pos = makePosition({ averagePrice: 50000, qty: 2, type: "long" });
    POSITIONS.set("user1", [pos]);

    await updateMarkPrice("BTCUSDT", 51000);
    // (51000 - 50000) * 2 = 2000
    expect(pos.unrealizedPnl).toBe(2000);
  });

  it("calculates unrealizedPnl for short positions", async () => {
    const pos = makePosition({
      averagePrice: 50000,
      qty: 2,
      type: "short",
      liquidationPrice: 52500,
    });
    POSITIONS.set("user1", [pos]);

    await updateMarkPrice("BTCUSDT", 49000);
    // (50000 - 49000) * 2 = 2000
    expect(pos.unrealizedPnl).toBe(2000);
  });

  it("calculates negative unrealizedPnl for losing long", async () => {
    const pos = makePosition({ averagePrice: 50000, qty: 1, type: "long" });
    POSITIONS.set("user1", [pos]);

    await updateMarkPrice("BTCUSDT", 49000);
    // (49000 - 50000) * 1 = -1000
    expect(pos.unrealizedPnl).toBe(-1000);
  });

  it("triggers liquidation when long position breaches liq price", async () => {
    const pos = makePosition({
      type: "long",
      liquidationPrice: 47500,
    });
    POSITIONS.set("user1", [pos]);

    await updateMarkPrice("BTCUSDT", 47000);

    expect(liquidateCalls).toHaveLength(1);
    expect(liquidateCalls[0].market).toBe("BTCUSDT");
    expect(liquidateCalls[0].markPrice).toBe(47000);
  });

  it("triggers liquidation when short position breaches liq price", async () => {
    const pos = makePosition({
      type: "short",
      averagePrice: 50000,
      liquidationPrice: 52500,
    });
    POSITIONS.set("user1", [pos]);

    await updateMarkPrice("BTCUSDT", 53000);

    expect(liquidateCalls).toHaveLength(1);
    expect(liquidateCalls[0].markPrice).toBe(53000);
  });

  it("does not trigger liquidation when price is safe", async () => {
    const pos = makePosition({ type: "long", liquidationPrice: 47500 });
    POSITIONS.set("user1", [pos]);

    await updateMarkPrice("BTCUSDT", 48000);

    expect(liquidateCalls).toHaveLength(0);
  });

  it("skips closed positions", async () => {
    const pos = makePosition({
      positionStatus: "closed",
      closedAt: Date.now(),
    });
    POSITIONS.set("user1", [pos]);

    const origPnl = pos.unrealizedPnl;
    await updateMarkPrice("BTCUSDT", 60000);
    expect(pos.unrealizedPnl).toBe(origPnl);
  });

  it("only processes positions for the specified market", async () => {
    const btcPos = makePosition({ market: "BTCUSDT", averagePrice: 50000 });
    const ethPos = makePosition({
      positionId: "p2",
      market: "ETHUSDT",
      averagePrice: 3000,
    });
    POSITIONS.set("user1", [btcPos, ethPos]);

    await updateMarkPrice("BTCUSDT", 51000);

    expect(btcPos.unrealizedPnl).toBe(1000);
    expect(ethPos.unrealizedPnl).toBe(0);
  });
});
