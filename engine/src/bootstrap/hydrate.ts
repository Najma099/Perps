import { prisma } from "@repo/db";

import { BALANCES } from "../store/perp-store";

export async function hydrateEngine() {
  console.log("Hydrating balances...");

  const balances = await prisma.balance.findMany({
    select: {
      userId: true,
      available: true,
      locked: true,
    },
  });

  for (const balance of balances) {
    BALANCES.set(balance.userId, {
      available: balance.available,
      locked: balance.locked,
    });
  }

  console.log(`Hydrated ${balances.length} balances`);

  const openOrders = await prisma.order.findMany({
    where: {
      status: { in: ["open", "partially_filled"] },
    }
  });
}