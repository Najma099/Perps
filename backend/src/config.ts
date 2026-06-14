import 'dotenv/config'
import { readRequiredEnv } from "@repo/redis-utils";

export const env = {
    PORT: process.env.PORT ?? '3000',
    JWT_SECRET: readRequiredEnv('JWT_SECRET'),
    incomingQueue: process.env.INCOMING_QUEUE ?? "backend-to-engine-broker",
    responseQueue: `response-queue-${process.env.BACKEND_QUEUE_ID ?? "1" }`,
    engineTimeoutMs: Number(process.env.ENGINE_TIMEOUT_MS ?? "30000"),
    redisUrl: readRequiredEnv("REDIS_URL")
}
