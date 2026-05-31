import "dotenv/config";
import { createClient } from "redis";
import { env } from "./utils/config.js";
import { hydrateEngine } from "./bootstrap/hydrate.js";
import startBinanceWs from "./ws/binance.js";
import {
  onramp,
  getEquity,
  getOpenPosition,
  getClosePosition,
  openPosition,
  cancelPosition,
} from "./handler/perbs.handler.js";
import { parseEngineRequest } from "./utils/redisMessagePaser.js";
import type { RedisStream } from "./types/redisMessage.js";

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

export const responseClient = createClient({ url: env.redisUrl }).on("error", (err) =>
  console.error("response error", err),
);

await Promise.all([brokerClient.connect(), responseClient.connect()]);

await hydrateEngine();

try {
  await brokerClient.xGroupCreate(env.incomingQueue, "engine", "$", {
    MKSTREAM: true,
  });
  console.log("Consumer group created");
} catch (err: any) {
  if (!err.message.includes("BUSYGROUP")) throw err;
  console.log("Consumer group already exists, continuing");
}

startBinanceWs();

async function sendResponse(
  responseQueue: string,
  response: EngineResponse,
): Promise<void> {
  await responseClient.xAdd(responseQueue, "*", {
    correlationId: response.correlationId,
    ok: String(response.ok),
    data: JSON.stringify(response.data ?? null),
    error: response.error ?? "",
  });
}

async function handleEngineRequest(message: EngineRequest): Promise<unknown> {
  switch (message.type) {
    case "onramp":
      return onramp(message.payload);
    case "get_equity":
      return getEquity(message.payload);
    case "get_open_positions":
      return getOpenPosition(message.payload);
    case "get_closed_positions":
      return getClosePosition(message.payload);
    case "open_position":
      return openPosition(message.payload, message.correlationId);
    case "cancel_position":
      return cancelPosition(message.payload);
    default:
      throw new Error(`Not implemented: ${message.type}`);
  }
}

async function processEntry(
  entry: RedisStream["messages"][number],
): Promise<void> {
  const parsed = parseEngineRequest(entry);

  if (!parsed.success) {
    console.error("Invalid engine message", {
      messageId: entry.id,
      error: parsed.error,
    });

    await brokerClient.xAck(env.incomingQueue, "engine", entry.id);
    return;
  }

  const message = parsed.data;
  let response: EngineResponse;

  try {
    const data = await handleEngineRequest(message);
    response = {
      correlationId: message.correlationId,
      ok: true,
      data,
    };
  } catch (error) {
    response = {
      correlationId: message.correlationId,
      ok: false,
      error: error instanceof Error ? error.message : "engine_error",
    };
  }

  try {
    await sendResponse(message.responseQueue, response);
  } catch (err) {
    console.error("Failed to send response", {
      correlationId: message.correlationId,
      err,
    });
  }

  await brokerClient.xAck(env.incomingQueue, "engine", entry.id);
}

console.log(`Perps engine listening on: ${env.incomingQueue}`);

for (;;) {
  const streams = (await brokerClient.xReadGroup(
    "engine",
    "worker-1",
    [{ key: env.incomingQueue, id: ">" }],
    { COUNT: 1, BLOCK: 2000 },
  )) as RedisStream[] | null;

  if (!streams) continue;

  for (const stream of streams) {
    for (const entry of stream.messages) {
      await processEntry(entry);
    }
  }
}


