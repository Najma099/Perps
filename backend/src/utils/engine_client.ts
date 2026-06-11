import { createClient } from "redis";
import { env } from "../config.js";
import {
  resolveEngineResponse,
  waitForEngineResponse,
} from "../store/pending_response.js";
import { parseEngineResponse } from "./redisMessageParser.js";
import type { RedisStream } from "../types/redisMessage.js";

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

export type EngineCommandType =
  | "onramp"
  | "get_equity"
  | "get_open_positions"
  | "get_closed_positions"
  | "open_position"
  | "cancel_position";

const publisher = createClient({ url: env.redisUrl }).on("error", (error) => {
  console.error("Redis publisher error", error);
});

const subscriber = createClient({ url: env.redisUrl }).on("error", (error) => {
  console.error("Redis subscriber error", error);
});

export async function connectRedis(): Promise<void> {
  await Promise.all([publisher.connect(), subscriber.connect()]);
  try {
    await subscriber.xGroupCreate(env.responseQueue, "backend", "$", {
      MKSTREAM: true,
    });
    console.log("Response consumer group created");
  } catch (err: any) {
    if (!err.message.includes("BUSYGROUP")) throw err;
    console.log("Response consumer group already exists, continuing");
  }
}

export async function pingRedis(): Promise<string> {
  return publisher.ping();
}

export async function sendToEngine(
  type: EngineCommandType,
  payload: Record<string, unknown>,
): Promise<EngineResponse> {
  const correlationId = crypto.randomUUID();
  const responsePromise = waitForEngineResponse(
    correlationId,
    env.engineTimeoutMs,
  );

  await publisher.xAdd(env.incomingQueue, "*", {
    correlationId,
    responseQueue: env.responseQueue,
    type,
    payload: JSON.stringify(payload),
  });

  return responsePromise;
}

export async function listenForEngineResponses(): Promise<void> {
  console.log(`Listening for engine responses on ${env.responseQueue}`);

  for (;;) {
    try {
      const raw = (await subscriber.xReadGroup(
        "backend",
        "backend-worker-1",
        [{ key: env.responseQueue, id: ">" }],
        { COUNT: 10, BLOCK: 2000 },
      )) as RedisStream[] | null;

      if (!raw) continue;

      for (const stream of raw) {
        for (const entry of stream.messages) {
          const parsed = parseEngineResponse(entry);

          if (!parsed.success) {
            console.error("Invalid engine response", {
              messageId: entry.id,
              error: parsed.error,
            });
            await subscriber.xAck(env.responseQueue, "backend", entry.id);
            continue;
          }

          resolveEngineResponse(parsed.data);
          await subscriber.xAck(env.responseQueue, "backend", entry.id);
        }
      }
    } catch (err) {
      console.error("Backend response listener error, retrying in 3s:", err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
