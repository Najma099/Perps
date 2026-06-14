import "dotenv/config";
import { createClient, type RedisClientType } from "redis";
import { processEvent } from "./consumers/eventConsumer.js";
import {
  readRequiredEnv,
  ensureConsumerGroup,
  type RedisStream,
} from "@repo/redis-utils";

const REDIS_URL = readRequiredEnv("REDIS_URL");
const EVENTS_QUEUE = readRequiredEnv("EVENTS_QUEUE");

const eventClient = createClient({ url: REDIS_URL }).on("error", (err) =>
  console.error("eventClient error", err),
);

await eventClient.connect();

await ensureConsumerGroup(
  eventClient as unknown as RedisClientType,
  EVENTS_QUEUE,
  "db-writers",
);
console.log("db-writers consumer group ready");

console.log(`DB poller listening on ${EVENTS_QUEUE}...`);

for (;;) {
  const raw = (await eventClient.xReadGroup(
    "db-writers",
    "db-writer-1",
    [{ key: EVENTS_QUEUE, id: ">" }],
    { COUNT: 10, BLOCK: 2000 },
  )) as RedisStream[] | null;

  if (!raw) continue;

  for (const stream of raw) {
    for (const entry of stream.messages) {
      await processEvent(entry, eventClient as any, EVENTS_QUEUE);
    }
  }
}

export {
  getOrdersByUserId,
  getOpenOrdersByUserId,
} from "./repositories/order.repo.js";
export { getFillsByUserId } from "./repositories/fill.repo.js";
export { getBalance, getAllBalances } from "./repositories/balance.repo.js";
