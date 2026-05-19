import "dotenv/config";
import { createClient } from "redis";
import { env } from "./utils/config.js";
import startBinanceWs from "../src/ws/binance.js";
import {
  onramp,
  getEquity,
  getFills,
  getAllOrders,
  getOpenOrders,
  getOpenPosition,
  getClosePosition,
  openPosition,
  cancelPosition,
} from "../src/handler/perbs.handler.js";

export interface EngineRequest {
  correlationId: string;
  responseQueue: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface EngineResponse {
  correlationId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

const brokerClient = createClient({ url: env.redisUrl }).on("error", (err) =>
  console.error("broker error", err),
);
const responseClient = createClient({ url: env.redisUrl }).on("error", (err) =>
  console.error("response error", err),
);

await Promise.all([brokerClient.connect(), responseClient.connect()]);
startBinanceWs();

async function sendResponse(
  responseQueue: string,
  response: EngineResponse,
): Promise<void> {
  await responseClient.lPush(responseQueue, JSON.stringify(response));
}

function handleEngineRequest(message: EngineRequest): unknown {
  switch (message.type) {
    case "onramp":
      return onramp(message.payload);
    case "get_equity":
      return getEquity(message.payload);
    case "get_fills":
      return getFills(message.payload);
    case "get_open_orders":
      return getOpenOrders(message.payload);
    case "get_all_orders":
      return getAllOrders(message.payload);
    case "get_open_positions":
      return getOpenPosition(message.payload);
    case "get_closed_positions":
      return getClosePosition(message.payload);
    case "open_position":
      return openPosition(message.payload);
    case "cancel_position":
      return cancelPosition(message.payload);
    default:
      throw new Error(`Not implemented: ${message.type}`);
  }
}

console.log(`Perps engine listening on: ${env.incomingQueue}`);

for (;;) {
  const item = await brokerClient.brPop(env.incomingQueue, 0);
  if (!item) continue;

  let message: EngineRequest;
  try {
    message = JSON.parse(item.element) as EngineRequest;
  } catch {
    console.error("Skipping invalid message");
    continue;
  }

  try {
    const data = handleEngineRequest(message);
    await sendResponse(message.responseQueue, {
      correlationId: message.correlationId,
      ok: true,
      data,
    });
  } catch (error) {
    await sendResponse(message.responseQueue, {
      correlationId: message.correlationId,
      ok: false,
      error: error instanceof Error ? error.message : "engine_error",
    });
  }
}
