import type { RedisClientType } from "redis";

export async function ensureConsumerGroup(
  client: RedisClientType,
  stream: string,
  group: string,
  startId = "$",
): Promise<void> {
  try {
    await client.xGroupCreate(stream, group, startId, { MKSTREAM: true });
  } catch (err: any) {
    if (!err.message?.includes("BUSYGROUP")) throw err;
  }
}
