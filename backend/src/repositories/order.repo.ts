import { prisma } from '@repo/db';
import type { OrderSide, OrderType, OrderStatus } from '@repo/db/prisma/generated/prisma/enums';

export const createOrder = async( data: {
    correlationId: string,
    userId: string,
    market: string,
    side: OrderSide,
    qty: number,
    price: number,
    margin: number,
    orderType: OrderType
}) => {
    return prisma.order.create({ data});
} 

export const updateOrderStatus = (correlationId: string, status: OrderStatus) => {
    return prisma.order.update({
        where: { correlationId },
        data: { status }
    });
}

export const getOrdersByUserId = (userId: string, market?: string) => {
    return prisma.order.findMany({
        where: {
            userId,
            ...(market ? { market } : {})
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
}

export const getOpenOrderByUserId = (userId: string, market?: string) => {
    return prisma.order.findMany({
        where: {
            userId,
            ...(market ? { market } : {}), 
            status:"open"
        },
        orderBy: {
            createdAt: 'desc'
        }
    })
}