import "dotenv/config";
import { createClient } from "redis";
import { prisma } from "@repo/db";

const MARKET = "BTCUSDT";
const BASE_PRICE = 45000;
const BID_COUNT = 10;
const ASK_COUNT = 10;
const USER_COUNT = 5;
const QTY_PER_ORDER = 0.5;
const LEVERAGE = 10;

const USERS = [
  { username: "alice", password: "pass123" },
  { username: "bob", password: "pass123" },
  { username: "carol", password: "pass123" },
  { username: "dave", password: "pass123" },
  { username: "eve", password: "pass123" },
];

async function main() {
  console.log("🌱 Seeding test data...\n");

  // 1. Create users in DB
  console.log("Creating users...");
  const createdUsers: { userId: string; username: string }[] = [];
  for (const u of USERS) {
    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (existing) {
      console.log(`  ${u.username} already exists (${existing.userId})`);
      createdUsers.push({ userId: existing.userId, username: existing.username });
      continue;
    }
    const user = await prisma.user.create({
      data: {
        username: u.username,
        password: u.password,
      },
    });
    console.log(`  Created ${user.username} (${user.userId})`);
    createdUsers.push({ userId: user.userId, username: user.username });
  }

  // 2. Seed balances in DB
  console.log("\nSeeding balances...");
  for (const u of createdUsers) {
    await prisma.balance.upsert({
      where: { userId: u.userId },
      create: { userId: u.userId, available: 100000, locked: 0 },
      update: { available: 100000 },
    });
    console.log(`  Balance set for ${u.username}: 100000`);
  }

  // 3. Send limit orders to engine via Redis
  console.log("\nSending limit orders to engine...");
  const redis = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
  await redis.connect();

  const priceSpread = 2000;
  const priceStep = 100;

  // Bids — below base price
  for (let i = 0; i < BID_COUNT; i++) {
    const price = BASE_PRICE - (priceSpread / 2) + i * priceStep;
    const user = createdUsers[i % createdUsers.length];
    const correlationId = crypto.randomUUID();
    await redis.xAdd("orders:in", "*", {
      correlationId,
      responseQueue: "seed-response",
      type: "open_position",
      payload: JSON.stringify({
        userId: user.userId,
        market: MARKET,
        side: "buy",
        positionType: "long",
        qty: QTY_PER_ORDER,
        leverage: LEVERAGE,
        orderType: "limit",
        price,
      }),
    });
    console.log(`  Bid #${i + 1}: ${user.username} — ${price} x ${QTY_PER_ORDER}`);
  }

  // Asks — above base price
  for (let i = 0; i < ASK_COUNT; i++) {
    const price = BASE_PRICE + (priceSpread / 2) + i * priceStep;
    const user = createdUsers[i % createdUsers.length];
    const correlationId = crypto.randomUUID();
    await redis.xAdd("orders:in", "*", {
      correlationId,
      responseQueue: "seed-response",
      type: "open_position",
      payload: JSON.stringify({
        userId: user.userId,
        market: MARKET,
        side: "sell",
        positionType: "short",
        qty: QTY_PER_ORDER,
        leverage: LEVERAGE,
        orderType: "limit",
        price,
      }),
    });
    console.log(`  Ask #${i + 1}: ${user.username} — ${price} x ${QTY_PER_ORDER}`);
  }

  await redis.disconnect();

  console.log(`\n✅ Done! Sent ${BID_COUNT} bids + ${ASK_COUNT} asks to ${MARKET}`);
  console.log("   The engine will process them and the DB poller will persist.");
  console.log("   Run `bun run dev` in the engine & db-poller first!\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
