import "dotenv/config";
import { readRequiredEnv } from "@repo/redis-utils";

export const env = {
  redisUrl: readRequiredEnv("REDIS_URL"),
  wsPort: Number(process.env.WS_PORT ?? "8080"),
  incomingQueue: process.env.INCOMING_QUEUE ?? "orders:in",
  responseQueue: process.env.WS_RESPONSE_QUEUE ?? "ws-response-queue-1",
};
