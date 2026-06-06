import "dotenv/config";
import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const MARKET = process.env.MARKET || "BTCUSDT";
const BASE_PRICE = parseInt(process.env.BASE_PRICE || "85000");
const SPREAD = parseInt(process.env.SPREAD || "2000");

const USERS = ["alice", "bob", "carol", "dave", "eve"];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendOrder(
  redis: ReturnType<typeof createClient>,
  side: "buy" | "sell",
  orderType: "limit" | "market",
) {
  const user = pick(USERS);
  const leverage = pick([3, 5, 10, 20]);
  const offset = rand(-SPREAD / 2, SPREAD / 2);
  const price = Math.round(BASE_PRICE + offset);
  const qty = parseFloat(rand(0.1, 2.0).toFixed(3));

  const payload: Record<string, unknown> = {
    userId: user,
    market: MARKET,
    side,
    positionType: side === "buy" ? "long" : "short",
    qty,
    leverage,
    orderType,
  };
  if (orderType === "limit") payload.price = price;

  await redis.xAdd("orders:in", "*", {
    correlationId: crypto.randomUUID(),
    responseQueue: "worker-response",
    type: "open_position",
    payload: JSON.stringify(payload),
  });

  const priceStr = orderType === "limit" ? `$${price}` : "MARKET";
  const icon = side === "buy" ? "\u{1F7E2}" : "\u{1F534}";
  console.log(`[worker] ${icon} ${side.toUpperCase()} ${qty} ${MARKET} @ ${priceStr} x${leverage} (${user})`);
}

async function main() {
  console.log(`[worker] Starting continuous order generator for ${MARKET}`);

  const redis = createClient({ url: REDIS_URL });
  await redis.connect();
  console.log("[worker] Connected to Redis");

  let count = 0;

  while (true) {
    try {
      if (count > 0 && count % 20 === 0) {
        const user = pick(USERS);
        const amount = Math.floor(rand(50000, 200000));
        await redis.xAdd("orders:in", "*", {
          correlationId: crypto.randomUUID(),
          responseQueue: "worker-response",
          type: "onramp",
          payload: JSON.stringify({ userId: user, amount }),
        });
        console.log(`[worker] \u{1F4B0} +$${amount.toLocaleString()} \u2192 ${user}`);
      }

      // Send a matched pair: one buy + one sell to keep book balanced
      await sendOrder(redis, "buy", "limit");
      await sleep(rand(400, 800));
      await sendOrder(redis, "sell", "limit");

      // Occasionally send a market order to create trades
      if (Math.random() < 0.2) {
        await sleep(rand(600, 1200));
        const side = Math.random() < 0.5 ? "buy" : "sell";
        await sendOrder(redis, side, "market");
      }

      count += 2;
      await sleep(rand(1000, 2500));
    } catch (err) {
      console.error("[worker] Error:", err);
      await sleep(3000);
    }
  }
}

main().catch((err) => {
  console.error("[worker] Fatal:", err);
  process.exit(1);
});
