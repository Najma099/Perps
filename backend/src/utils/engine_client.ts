import { createClient, type RedisClientType } from "redis";
import { env } from "../config.js";
import {
  resolveEngineResponse,
  waitForEngineResponse,
} from "../store/pending_response.js";
import { parseEngineResponse } from "./redisMessageParser.js";
import {
  ensureConsumerGroup,
  type RedisStream,
  type EngineResponse,
} from "@repo/redis-utils";
import type { EngineCommandType } from "../types/engine.js";

export type { EngineResponse };

const publisher = createClient({ url: env.redisUrl }).on("error", (error) => {
  console.error("Redis publisher error", error);
});

export { publisher };

const subscriber = createClient({ url: env.redisUrl }).on("error", (error) => {
  console.error("Redis subscriber error", error);
});

export async function connectRedis(): Promise<void> {
  await Promise.all([publisher.connect(), subscriber.connect()]);
  await ensureConsumerGroup(
    subscriber as unknown as RedisClientType,
    env.responseQueue,
    "backend",
  );
  console.log("Response consumer group ready");
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
      console.error("Backend response listener error:", err);
      if (String(err).includes("NOGROUP")) {
        await ensureConsumerGroup(
          subscriber as unknown as RedisClientType,
          env.responseQueue,
          "backend",
        );
        console.log("Recreated response consumer group");
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
