import "dotenv/config";

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env variable: ${name}`);
  return value;
}

export const env = {
  redisUrl: readRequired("REDIS_URL"),
  wsPort: Number(process.env.WS_PORT ?? "8080"),
  incomingQueue: process.env.INCOMING_QUEUE ?? "orders:in",
  responseQueue: process.env.WS_RESPONSE_QUEUE ?? "ws-response-queue-1",
};
