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

function isPublicMarketTrade(payload: Record<string, unknown>): boolean {
  if (payload.source === "market") return true;
  return payload.maker === "binance" && payload.taker === "binance";
}

async function sendTradeSnapshot(ws: WebSocket, market: string) {
  try {
    const raw = await eventClient.xRevRange("stream:events", "+", "-", { COUNT: 10000 });
    if (!raw) return;

    const seen = new Set<string>();
    const trades: any[] = [];
    for (const entry of raw) {
      if (entry.message.type !== "FILL_CREATED") continue;
      let payload: any;
      try {
        payload = JSON.parse(entry.message.payload);
      } catch { continue; }
      if (payload.market !== market) continue;
      if (!isPublicMarketTrade(payload)) continue;
      if (seen.has(payload.fillId)) continue;
      seen.add(payload.fillId);

      trades.push({
        type: "trade",
        market: payload.market,
        price: payload.price,
        qty: payload.qty,
        side: payload.side,
        tradeId: payload.fillId,
        createdAt: payload.createdAt,
      });
    }

    if (trades.length > 0) {
      trades.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      ws.send(JSON.stringify({ type: "tradeSnapshot", market, trades: trades.slice(0, 500) }));
    }
  } catch (err) {
    console.error(`Error sending trade snapshot for ${market}:`, err);
  }
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

        sendTradeSnapshot(ws, market);
        break;
      }

      case "unsubscribe": {
        const market = msg.market as string;
        if (market) {
          subs.markets.delete(market);
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
  if (!isPublicMarketTrade(fill)) return;

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
    case "ORDERBOOK_UPDATE": {
      const { market, bids, asks, lastUpdateId } = payload;

      let book = orderbooks.get(market);
      if (!book) {
        book = { bids: new Map(), asks: new Map(), lastUpdateId: 0 };
        orderbooks.set(market, book);
      }

      for (const [price, qty] of bids) {
        if (qty === 0) book.bids.delete(price);
        else book.bids.set(price, qty);
      }
      for (const [price, qty] of asks) {
        if (qty === 0) book.asks.delete(price);
        else book.asks.set(price, qty);
      }
      book.lastUpdateId = lastUpdateId;

      broadcastToMarket(market, {
        type: "depthUpdate",
        market,
        firstUpdateId: lastUpdateId,
        lastUpdateId: lastUpdateId,
        bids,
        asks,
      });
      break;
    }

    case "FILL_CREATED":
      broadcastTrade(payload);
      break;
  }
}

console.log("Listening for events on stream:events");
for (;;) {
  try {
    const raw = (await eventClient.xReadGroup(
      "ws-service",
      "ws-worker-1",
      [{ key: "stream:events", id: ">" }],
      { COUNT: 10, BLOCK: 2000 },
    )) as any;

    if (!raw) continue;

    for (const stream of raw) {
      for (const entry of stream.messages) {
        try {
          await processEvent(entry);
        } catch (err) {
          console.error("Failed to process event:", { id: entry.id, err });
        }
        await eventClient.xAck("stream:events", "ws-service", entry.id);
      }
    }
  } catch (err) {
    console.error("WS event loop error:", err);
    if (String(err).includes("NOGROUP")) {
      try {
        await eventClient.xGroupCreate("stream:events", "ws-service", "$", {
          MKSTREAM: true,
        });
        console.log("Recreated ws-service consumer group");
      } catch (e: any) {
        if (!String(e).includes("BUSYGROUP"))
          console.error("Failed to recreate group:", e);
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}
