import "dotenv/config";
import { createClient } from "redis";
import WebSocket from "ws";

const REDIS_URL = process.env.REDIS_URL!;
const MARKETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

type OrderbookState = Map<number, number>;

const depthBooks = new Map<string, { bids: OrderbookState; asks: OrderbookState }>();
let updateId = 0;

const redis = createClient({ url: REDIS_URL }).on("error", (err) =>
  console.error("redis error", err),
);
await redis.connect();

function nextUpdateId() {
  return ++updateId;
}

function computeDiff(
  prev: OrderbookState,
  curr: OrderbookState,
): [number, number][] {
  const diff: [number, number][] = [];
  for (const [price, qty] of curr) {
    const prevQty = prev.get(price);
    if (prevQty !== qty) {
      diff.push([price, qty]);
    }
  }
  for (const [price] of prev) {
    if (!curr.has(price)) {
      diff.push([price, 0]);
    }
  }
  return diff;
}

function connectDepthStream(market: string) {
  const stream = `${market.toLowerCase()}@depth20@100ms`;
  const url = `wss://fstream.binance.com/stream?streams=${stream}`;
  const ws = new WebSocket(url);

  ws.on("open", () => console.log(`[feed] depth connected: ${market}`));

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const data = msg.data;
      if (!data?.bids || !data?.asks) return;

      const newBids = new Map<number, number>();
      const newAsks = new Map<number, number>();

      for (const [p, q] of data.bids) newBids.set(parseFloat(p), parseFloat(q));
      for (const [p, q] of data.asks) newAsks.set(parseFloat(p), parseFloat(q));

      const prev = depthBooks.get(market);
      if (!prev) {
        depthBooks.set(market, { bids: newBids, asks: newAsks });
        return;
      }

      const bidDiff = computeDiff(prev.bids, newBids);
      const askDiff = computeDiff(prev.asks, newAsks);

      prev.bids = newBids;
      prev.asks = newAsks;

      if (bidDiff.length === 0 && askDiff.length === 0) return;

      const id = nextUpdateId();
      await redis.xAdd("stream:events", "*", {
        type: "ORDERBOOK_UPDATE",
        payload: JSON.stringify({
          market,
          firstUpdateId: id,
          lastUpdateId: id,
          bids: bidDiff,
          asks: askDiff,
        }),
        createdAt: String(Date.now()),
      });
    } catch (err) {
      console.error(`[feed] depth error (${market}):`, err);
    }
  });

  ws.on("close", () => {
    console.log(`[feed] depth disconnected: ${market}, reconnecting in 3s...`);
    setTimeout(() => connectDepthStream(market), 3000);
  });

  ws.on("error", (err) => console.error(`[feed] depth ws error (${market}):`, err.message));
}

function connectTradeStream(market: string) {
  const stream = `${market.toLowerCase()}@trade`;
  const url = `wss://fstream.binance.com/stream?streams=${stream}`;
  const ws = new WebSocket(url);

  ws.on("open", () => console.log(`[feed] trade connected: ${market}`));

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const trade = msg.data;
      if (!trade) return;

      await redis.xAdd("stream:events", "*", {
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
      });
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
  connectDepthStream(m);
  connectTradeStream(m);
}

console.log("Market feed running. Streaming Binance depth + trades -> Redis stream:events");

process.on("SIGINT", () => {
  redis.disconnect();
  process.exit(0);
});

await new Promise(() => {});
