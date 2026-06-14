import "dotenv/config";
import { readRequiredEnv } from "@repo/redis-utils";

export const env = {
  redisUrl: readRequiredEnv("REDIS_URL"),
  incomingQueue: process.env.INCOMING_QUEUE ?? "backend-to-engine-broker",
};
