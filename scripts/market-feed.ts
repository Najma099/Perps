import "dotenv/config";
import { createClient } from "redis";
import WebSocket from "ws";

const REDIS_URL = process.env.REDIS_URL!;
const MARKETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

const redis = createClient({ url: REDIS_URL }).on("error", (err) =>
  console.error("redis error", err),
);
await redis.connect();

const lastWrite = new Map<string, number>();

function shouldThrottle(market: string): boolean {
  const now = Date.now();
  const last = lastWrite.get(market) ?? 0;
  if (now - last < 1000) return true;
  lastWrite.set(market, now);
  return false;
}

function connectTradeStream(market: string) {
  const stream = `${market.toLowerCase()}@trade`;
  const url = `wss://fstream.binance.com/stream?streams=${stream}`;
  const ws = new WebSocket(url);

  ws.on("open", () => console.log(`[feed] trade connected: ${market}`));

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const trade = msg.data;
      if (!trade) return;
      if (shouldThrottle(market)) return;

      redis.xAdd("stream:events", "*", {
        type: "FILL_CREATED",
        payload: JSON.stringify({
          fillId: String(trade.t),
          market: trade.s,
          price: parseFloat(trade.p),
          qty: parseFloat(trade.q),
          side: trade.m ? "sell" : "buy",
          long: "",
          short: "",
          maker: "binance",
          taker: "binance",
          createdAt: trade.T,
        }),
        createdAt: String(Date.now()),
      }).catch(() => {});
    } catch (err) {
      console.error(`[feed] trade error (${market}):`, err);
    }
  });

  ws.on("close", () => {
    console.log(`[feed] trade disconnected: ${market}, reconnecting in 3s...`);
    setTimeout(() => connectTradeStream(market), 3000);
  });

  ws.on("error", (err) => console.error(`[feed] trade ws error (${market}):`, err.message));
}

for (const m of MARKETS) {
  connectTradeStream(m);
}

console.log("Market feed running. Streaming Binance trades -> Redis stream:events (throttled: 1/sec/market)");

process.on("SIGINT", () => {
  redis.disconnect();
  process.exit(0);
});

await new Promise(() => {});
