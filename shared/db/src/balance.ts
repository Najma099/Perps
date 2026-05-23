import { prisma } from "./index";

export async function getAllUserBalance() {
  return prisma.balance.findMany();
}