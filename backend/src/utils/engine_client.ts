import { createClient } from "redis";
import { env } from "../config.js";
import {
  resolveEngineResponse,
  waitForEngineResponse,
} from "../store/pending_response.js";
import type {
  EngineCommandType,
  EngineRequest,
  EngineResponse,
} from "../types/engine.js";

const publisher = createClient({ url: env.redisUrl }).on("error", (error) => {
  console.error("Redis publisher error", error);
});

const subscriber = createClient({ url: env.redisUrl }).on("error", (error) => {
  console.error("Redis subscriber error", error);
});

export async function connectRedis(): Promise<void> {
  await Promise.all([publisher.connect(), subscriber.connect()]);
}

export async function pingRedis(): Promise<string> {
  return publisher.ping();
}

export async function sendToEngine(
  type: EngineCommandType,
  payload: Record<string, unknown>,
): Promise<EngineResponse> {
  const correlationId = crypto.randomUUID();
  const responsePromise = waitForEngineResponse(correlationId, env.engineTimeoutMs);

  const message: EngineRequest = {
    correlationId,
    responseQueue: env.responseQueue,
    type,
    payload,
  };

  //await publisher.lPush(env.incomingQueue, JSON.stringify(message));
  await publisher.xAdd(env.incomingQueue, "*", { data: JSON.stringify(message)});
  return responsePromise;
}

export async function listenForEngineResponses(): Promise<void> {
  console.log(`Listening for engine responses on ${env.responseQueue}`);

  for (;;) {
    //const response = await subscriber.brPop(env.responseQueue, 0);
    const entries = await subscriber.xReadGroup(env.responseQueue, 0);
    const response = JSON.parse(entries[0].messages[0].message.data);
    if (!response) continue;

    try {
      const parsedResponse = JSON.parse(response.element) as EngineResponse;
      resolveEngineResponse(parsedResponse);
    } catch (error) {
      console.error("Invalid engine response", error);
    }
  }
}