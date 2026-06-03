// Quick seed — sends orders directly to engine via Redis.
// No DB needed. Engine creates users in-memory via seedUserIfNeeded.

import { createClient } from "redis";

const MARKET = "BTCUSDT";
const BASE_PRICE = 45000;
const USERS = ["user-alice", "user-bob", "user-carol", "user-dave", "user-eve"];

async function main() {
  console.log("🌱 Seeding orderbook via Redis (no DB required)...\n");

  const redis = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
  await redis.connect();

const count = { bids: 12, asks: 12 };
const step = 80;
const DEFAULT_BALANCE = 100000; // must match engine's seedUserIfNeeded

  // Bids below base price
  for (let i = 0; i < count.bids; i++) {
    const price = BASE_PRICE - (count.bids - i) * step;
    const user = USERS[i % USERS.length];
    await redis.xAdd("orders:in", "*", {
      correlationId: crypto.randomUUID(),
      responseQueue: "seed-response",
      type: "open_position",
      payload: JSON.stringify({
        userId: user,
        market: MARKET,
        side: "buy",
        positionType: "long",
        qty: 0.5 + Math.random() * 0.5,
        leverage: 10,
        orderType: "limit",
        price,
      }),
    });
    console.log(`  Bid  ${price} x ${(0.5 + Math.random() * 0.5).toFixed(2)} ← ${user}`);
  }

  // Asks above base price
  for (let i = 0; i < count.asks; i++) {
    const price = BASE_PRICE + (i + 1) * step;
    const user = USERS[i % USERS.length];
    await redis.xAdd("orders:in", "*", {
      correlationId: crypto.randomUUID(),
      responseQueue: "seed-response",
      type: "open_position",
      payload: JSON.stringify({
        userId: user,
        market: MARKET,
        side: "sell",
        positionType: "short",
        qty: 0.5 + Math.random() * 0.5,
        leverage: 10,
        orderType: "limit",
        price,
      }),
    });
    console.log(`  Ask  ${price} x ${(0.5 + Math.random() * 0.5).toFixed(2)} → ${user}`);
  }

  console.log(`\n✅ Sent ${count.bids + count.asks} limit orders to ${MARKET}`);
  console.log("   Engine will process them and ws-service will broadcast depthUpdate.\n");

  await redis.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
