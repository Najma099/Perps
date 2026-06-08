import "dotenv/config";
import { createClient } from "redis";
import { WebSocketServer, WebSocket } from "ws";
import { env } from "./config";

interface DepthLevel {
  bids: Map<number, number>;
  asks: Map<number, number>;
  lastUpdateId: number;
}

interface Subscriptions {
  markets: Set<string>;
}

const orderbooks = new Map<string, DepthLevel>();
const clients = new Map<WebSocket, Subscriptions>();

const binanceFeeds = new Map<string, WebSocket>();
const binanceReconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

function startBinanceDepth(market: string) {
  if (binanceFeeds.has(market)) return;

  const stream = `${market.toLowerCase()}@depth20@100ms`;
  const url = `wss://fstream.binance.com/stream?streams=${stream}`;
  const ws = new WebSocket(url);

  ws.on("open", () => {
    console.log(`Binance depth connected: ${market}`);
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const data = msg.data;
      if (!data?.bids || !data?.asks) return;

      let book = orderbooks.get(market);
      if (!book) {
        book = { bids: new Map(), asks: new Map(), lastUpdateId: 0 };
        orderbooks.set(market, book);
      }

      const newBids = new Map<number, number>();
      const newAsks = new Map<number, number>();
      for (const [p, q] of data.bids) newBids.set(parseFloat(p), parseFloat(q));
      for (const [p, q] of data.asks) newAsks.set(parseFloat(p), parseFloat(q));

      const bidDiff: [number, number][] = [];
      const askDiff: [number, number][] = [];

      for (const [price, qty] of newBids) {
        const prev = book.bids.get(price);
        if (prev !== qty) bidDiff.push([price, qty]);
      }
      for (const [price] of book.bids) {
        if (!newBids.has(price)) bidDiff.push([price, 0]);
      }
      for (const [price, qty] of newAsks) {
        const prev = book.asks.get(price);
        if (prev !== qty) askDiff.push([price, qty]);
      }
      for (const [price] of book.asks) {
        if (!newAsks.has(price)) askDiff.push([price, 0]);
      }

      book.bids = newBids;
      book.asks = newAsks;
      book.lastUpdateId++;

      if (bidDiff.length > 0 || askDiff.length > 0) {
        broadcastToMarket(market, {
          type: "depthUpdate",
          market,
          firstUpdateId: book.lastUpdateId,
          lastUpdateId: book.lastUpdateId,
          bids: bidDiff,
          asks: askDiff,
        });
      }
    } catch (err) {
      console.error(`Binance depth error (${market}):`, err);
    }
  });

  ws.on("close", () => {
    console.log(`Binance depth disconnected: ${market}, reconnecting in 3s...`);
    binanceFeeds.delete(market);
    const timer = setTimeout(() => startBinanceDepth(market), 3000);
    binanceReconnectTimers.set(market, timer);
  });

  ws.on("error", (err) => {
    console.error(`Binance depth ws error (${market}):`, err.message);
  });

  binanceFeeds.set(market, ws);
}

function stopBinanceDepth(market: string) {
  const ws = binanceFeeds.get(market);
  if (ws) {
    ws.close();
    binanceFeeds.delete(market);
  }
  const timer = binanceReconnectTimers.get(market);
  if (timer) {
    clearTimeout(timer);
    binanceReconnectTimers.delete(market);
  }
}

const eventClient = createClient({ url: env.redisUrl }).on(
  "error",
  (err) => console.error("event redis error", err),
);

await eventClient.connect();

try {
  await eventClient.xGroupCreate("stream:events", "ws-service", "$", {
    MKSTREAM: true,
  });
} catch (err: any) {
  if (!err.message.includes("BUSYGROUP")) throw err;
}

const wss = new WebSocketServer({ port: env.wsPort });
console.log(`WebSocket server on port ${env.wsPort}`);

wss.on("connection", (ws) => {
  const subs: Subscriptions = { markets: new Set() };
  clients.set(ws, subs);

  ws.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "invalid JSON" }));
      return;
    }

    switch (msg.type) {
      case "subscribe": {
        const market = msg.market as string;
        if (!market) break;
        subs.markets.add(market);

        startBinanceDepth(market);

        const book = orderbooks.get(market);
        if (book) {
          const bids = [...book.bids.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([p, q]) => [p, q] as [number, number]);
          const asks = [...book.asks.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([p, q]) => [p, q] as [number, number]);

          ws.send(
            JSON.stringify({
              type: "depthSnapshot",
              market,
              lastUpdateId: book.lastUpdateId,
              bids,
              asks,
            }),
          );
        } else {
          ws.send(
            JSON.stringify({
              type: "depthSnapshot",
              market,
              lastUpdateId: 0,
              bids: [],
              asks: [],
            }),
          );
        }
        break;
      }

      case "unsubscribe": {
        const market = msg.market as string;
        if (market) {
          subs.markets.delete(market);
          const hasOther = [...clients.values()].some((c) =>
            c.markets.has(market),
          );
          if (!hasOther) stopBinanceDepth(market);
        }
        break;
      }

      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    for (const market of subs.markets) {
      const hasOther = [...clients.values()].some((c) =>
        c.markets.has(market),
      );
      if (!hasOther) stopBinanceDepth(market);
    }
  });
});

function broadcastToMarket(market: string, data: object) {
  const payload = JSON.stringify(data);
  for (const [ws, subs] of clients) {
    if (ws.readyState === 1 && subs.markets.has(market)) {
      ws.send(payload);
    }
  }
}

function broadcastTrade(fill: any) {
  const data = {
    type: "trade",
    market: fill.market,
    price: fill.price,
    qty: fill.qty,
    side: fill.side,
    tradeId: fill.fillId,
    createdAt: fill.createdAt ?? Date.now(),
  };
  broadcastToMarket(fill.market, data);
}

async function processEvent(entry: {
  id: string;
  message: Record<string, string>;
}) {
  const { type, payload: rawPayload } = entry.message;
  if (!type || !rawPayload) return;

  let payload: any;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return;
  }

  switch (type) {
    case "ORDERBOOK_UPDATE":
      break;

    case "FILL_CREATED":
      broadcastTrade(payload);
      break;
  }
}

console.log("Listening for events on stream:events");
for (;;) {
  const raw = (await eventClient.xReadGroup(
    "ws-service",
    "ws-worker-1",
    [{ key: "stream:events", id: ">" }],
    { COUNT: 10, BLOCK: 2000 },
  )) as any;

  if (!raw) continue;

  for (const stream of raw) {
    for (const entry of stream.messages) {
      await processEvent(entry);
      await eventClient.xAck("stream:events", "ws-service", entry.id);
    }
  }
}
