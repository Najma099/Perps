import "dotenv/config";
import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const MARKET = process.env.MARKET || "BTCUSDT";
const SPREAD = parseInt(process.env.SPREAD || "2000");

let basePrice = parseInt(process.env.BASE_PRICE || "0");

async function refreshBasePrice(): Promise<number> {
  if (process.env.BASE_PRICE) {
    basePrice = parseInt(process.env.BASE_PRICE, 10);
    return basePrice;
  }
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${MARKET}`,
    );
    if (res.ok) {
      const data = (await res.json()) as { price: string };
      basePrice = Math.round(parseFloat(data.price));
    }
  } catch {
    if (!basePrice) basePrice = 64000;
  }
  return basePrice;
}

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
  const price = Math.round(basePrice + offset);
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

  await refreshBasePrice();
  console.log(`[worker] Base price for ${MARKET}: $${basePrice}`);
  setInterval(() => refreshBasePrice(), 60_000);

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

      await sendOrder(redis, "buy", "limit");
      await sleep(rand(100, 250));
      await sendOrder(redis, "sell", "limit");
      await sleep(rand(100, 250));

      if (Math.random() < 0.35) {
        const side = Math.random() < 0.5 ? "buy" : "sell";
        await sendOrder(redis, side, "market");
      }

      count += 2;
      await sleep(rand(300, 800));
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
