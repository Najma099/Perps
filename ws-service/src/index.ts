import "dotenv/config";
import { createClient } from "redis";
import { WebSocketServer, type WebSocket } from "ws";
import { env } from "./config";

// ── types ──────────────────────────────────────────────
interface DepthLevel {
  bids: Map<number, number>; // price → qty
  asks: Map<number, number>;
  lastUpdateId: number;
}

interface Subscriptions {
  markets: Set<string>;
}

const orderbooks = new Map<string, DepthLevel>();
const clients = new Map<WebSocket, Subscriptions>();

// ── Redis clients ──────────────────────────────────────
const eventClient = createClient({ url: env.redisUrl }).on(
  "error",
  (err) => console.error("event redis error", err),
);

const commandClient = createClient({ url: env.redisUrl }).on(
  "error",
  (err) => console.error("command redis error", err),
);

const responseClient = createClient({ url: env.redisUrl }).on(
  "error",
  (err) => console.error("response redis error", err),
);

await Promise.all([
  eventClient.connect(),
  commandClient.connect(),
  responseClient.connect(),
]);

// ── request initial snapshot from engine ───────────────
async function requestSnapshot(market: string) {
  const correlationId = crypto.randomUUID();
  await commandClient.xAdd(env.incomingQueue, "*", {
    correlationId,
    responseQueue: env.responseQueue,
    type: "get_orderbook_snapshot",
    payload: JSON.stringify({ market }),
  });

  // read from response queue until we find our correlationId
  const timeout = 10000;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const raw = await responseClient.xReadGroup(
      "ws-service",
      "ws-worker-1",
      [{ key: env.responseQueue, id: ">" }],
      { COUNT: 10, BLOCK: 2000 },
    );
    if (!raw) continue;

    for (const stream of raw) {
      for (const entry of stream.messages) {
        const msg = entry.message;
        if (msg.correlationId === correlationId) {
          await responseClient.xAck(env.responseQueue, "ws-worker-1", entry.id);
          if (msg.ok === "true") {
            return JSON.parse(msg.data);
          }
          throw new Error(msg.error || "snapshot request failed");
        }
        await responseClient.xAck(env.responseQueue, "ws-worker-1", entry.id);
      }
    }
  }
  throw new Error("snapshot request timed out");
}

// ── boot: fetch & build orderbooks for known markets ───
async function bootstrap() {
  try {
    await responseClient.xGroupCreate(env.responseQueue, "ws-service", "$", {
      MKSTREAM: true,
    });
  } catch (err: any) {
    if (!err.message.includes("BUSYGROUP")) throw err;
  }

  // Fetch snapshot for all known markets
  const knownMarkets = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  for (const market of knownMarkets) {
    try {
      const data = await requestSnapshot(market);
      const bids = new Map<number, number>();
      const asks = new Map<number, number>();

      for (const [price, qty] of data.bids ?? []) {
        if (qty > 0) bids.set(price, qty);
      }
      for (const [price, qty] of data.asks ?? []) {
        if (qty > 0) asks.set(price, qty);
      }

      orderbooks.set(market, {
        bids,
        asks,
        lastUpdateId: data.lastUpdateId ?? 0,
      });
      console.log(`Bootstrapped orderbook for ${market}`);
    } catch (err) {
      console.warn(`Failed to bootstrap ${market}:`, err);
      // still create empty book
      orderbooks.set(market, { bids: new Map(), asks: new Map(), lastUpdateId: 0 });
    }
  }
  console.log(`Bootstrapped ${orderbooks.size} orderbooks`);
}

await bootstrap();

// ── subscribe to stream:events ─────────────────────────
try {
  await eventClient.xGroupCreate("stream:events", "ws-service", "$", {
    MKSTREAM: true,
  });
} catch (err: any) {
  if (!err.message.includes("BUSYGROUP")) throw err;
}

// ── WebSocket server ───────────────────────────────────
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
        break;
      }

      case "unsubscribe": {
        const market = msg.market as string;
        if (market) subs.markets.delete(market);
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

// ── broadcast helpers ─────────────────────────────────
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
  };
  broadcastToMarket(fill.market, data);
}

// ── event processing ──────────────────────────────────
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
      const { market, firstUpdateId, lastUpdateId, bids, asks } = payload;
      let book = orderbooks.get(market);
      if (!book) {
        book = { bids: new Map(), asks: new Map(), lastUpdateId: 0 };
        orderbooks.set(market, book);
      }

      // qty = 0 → remove the level (Binance convention)
      for (const [price, qty] of bids ?? []) {
        if (qty === 0) {
          book.bids.delete(price);
        } else {
          book.bids.set(price, qty);
        }
      }
      for (const [price, qty] of asks ?? []) {
        if (qty === 0) {
          book.asks.delete(price);
        } else {
          book.asks.set(price, qty);
        }
      }
      book.lastUpdateId = lastUpdateId;

      broadcastToMarket(market, {
        type: "depthUpdate",
        market,
        firstUpdateId,
        lastUpdateId,
        bids: [...(bids ?? [])],
        asks: [...(asks ?? [])],
      });
      break;
    }

    case "FILL_CREATED":
      broadcastTrade(payload);
      break;
  }
}

// ── event loop ─────────────────────────────────────────
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
