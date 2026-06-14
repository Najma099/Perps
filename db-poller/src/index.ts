import "dotenv/config";
import { createClient } from "redis";
import { processEvent } from "./consumers/eventConsumer.js";
import type { RedisStream } from "./types/redisMessage.js";

const REDIS_URL = process.env.REDIS_URL!;
const EVENTS_QUEUE = process.env.EVENTS_QUEUE!;

const eventClient = createClient({ url: REDIS_URL }).on("error", (err) =>
  console.error("eventClient error", err),
);

await eventClient.connect();

try {
  await eventClient.xGroupCreate(EVENTS_QUEUE, "db-writers", "$", {
    MKSTREAM: true,
  });
  console.log("db-writers consumer group created");
} catch (err: any) {
  if (!err.message.includes("BUSYGROUP")) throw err;
  console.log("db-writers consumer group already exists");
}

console.log(`DB poller listening on ${EVENTS_QUEUE}...`);

for (;;) {
  try {
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
  } catch (err) {
    console.error("DB poller read error:", err);
    if (String(err).includes("NOGROUP")) {
      try {
        await eventClient.xGroupCreate(EVENTS_QUEUE, "db-writers", "$", {
          MKSTREAM: true,
        });
        console.log("Recreated db-writers consumer group");
      } catch (e: any) {
        if (!String(e).includes("BUSYGROUP"))
          console.error("Failed to recreate group:", e);
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

export {
  getOrdersByUserId,
  getOpenOrdersByUserId,
} from "./repositories/order.repo.js";
export { getFillsByUserId } from "./repositories/fill.repo.js";
export { getBalance, getAllBalances } from "./repositories/balance.repo.js";
