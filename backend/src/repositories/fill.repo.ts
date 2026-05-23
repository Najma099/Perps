import { prisma } from '@repo/db';
import type { PositionSide } from '@repo/db/prisma/generated/prisma/enums';

export const createFill = ( data: {
    orderId: string,
    market: string,
    side: PositionSide,
    qty: number,
    price: number,
    maker: string,
    taker: string
}) => {
    return prisma.fill.create({
        data
    });
}

export const getFillsByUser = (userId: string, market?: string) => {
    return prisma.fill.findMany({
        where: {
            ...(market ? { market } : {}),
            OR: [{maker: userId, taker: userId}]
        },
        orderBy:{
            createdAt: 'desc'
        }
    });
}