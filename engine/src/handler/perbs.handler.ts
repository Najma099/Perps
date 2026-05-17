import { BALANCES, ORDERBOOKS, ORDERS, FILLS, MARK_PRICE, POSITIONS, type Fill, type OrderSide, type OrderType, type PositionType, type Position } from "../store/perp-store";

// case "open_position":         return openPosition(message.payload);
// case "cancel_position":       return cancelPosition(message.payload);

const seedUserIfNeeded = (userId: string) => {
    if(!BALANCES.has(userId)) {
        BALANCES.set(userId, {
            available: 10000,
            locked: 0
        });
    }
}

export const onramp = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    const amount = payload.amount as number;

    seedUserIfNeeded(userId);
    BALANCES.get(userId)!.available += amount;

    return BALANCES.get(userId);
}

export const getEquity = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    seedUserIfNeeded(userId);
    const UserBalance = BALANCES.get(userId);

    const available = UserBalance?.available!;
    const locked = UserBalance?.locked!;

    const unrealized = (POSITIONS.get(userId) ?? [])
                        .filter(p => p.positionStatus === 'open')
                        .reduce((sum, o) => sum + o.unrealizedPnl, 0)

    const total = available + locked + unrealized;
    return {
        available,
        locked,
        unrealized,
        total
    }
}

export const getFills = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    const fills: Fill[] = [];

    for(const marketFills of FILLS.values()) {
        for(const fill of marketFills) {
            if(fill.maker == userId || fill.taker == userId) {
                fills.push(fill)
            }
        }
    }
    return fills;
}

export const getAllOrders = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    
    const orders = ORDERS.get(userId);
    return orders;
}

export const getOpenOrders = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;

    const openOrder = ORDERS.get(userId)?.filter( o => o.status == 'open');
    return openOrder;
}

export const getOpenPosition = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;

    const openPosition = POSITIONS.get(userId)?.filter(o => o.positionStatus === 'open');

    return openPosition;
}

export const getClosePosition = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    const closePosition = POSITIONS.get(userId)?.filter(o => o.positionStatus === "closed");
    return closePosition;
}

export const openPosition = (payload: Record<string, unknown>) => {
// try to match against resting orders
//   → if matched: create Fill, update both Positions, release/lock margin
//   → if unmatched (limit): leave in ORDERBOOK as RestingOrder

    //he is trying to create order
    const userId = payload.userId as string;
    const market = payload.market as string;
    const side = payload.side as OrderSide;
    const qty = payload.qty as number;
    const margin = payload.margin as number;
    const orderType = payload.orderType as OrderType;
    const price = payload.price as number;
    const positionType = payload.positionType as PositionType;

    const userBalance = BALANCES.get(userId);
    const availBalance = userBalance?.available!;

    if(availBalance < margin) {
        throw new Error('Insufficient funds');
    }

    userBalance?.locked += margin;
    userBalance?.available -= margin


    const order: Order = {
        orderId: crypto.randomUUID(),
        userId,
        market,
        side,
        qty,
        fillQty: 0,
        orderType,
        price,
        orderStatus: 'open',
        createdAt: Date.now()
    }

    ORDERS.get(userId)?.push(order);
    
    const book = ORDERBOOKS.get(market);
    if(!book) {
        asks: new Map(),
        bids: new Map(),
        indexPrice:  //no idea what to do here
        lastTradedPrice
    }

    const oppoSite = positionType === 'long' ? book?.asks : ORDERBOOKS.bids;
    while(order.qty < order.filledQty) {
        const remaining = order.filledQty - order.qty;

        const prices = [...oppoSite.keys()];
        const bestPrices = positionType === 'long' ? Math.min(...prices) : Math.max(...prices);

        if(orderType == 'limit') {
            //long == buy 
            if(positionType == 'long' && bestPrices > price) break;
            if(positionType == 'short' && bestPrices < price) break;
        }

        // now we can fulfill the qty 
        //if matched: create Fill, update both Positions, release/lock margin

        const level = oppoSite.get(bestPrices);
        const resting = level[0];

        const restingRemaining = resting.qty - resting.filledQty;
        const fillQty = Math.min(restingRemaining, remaining);
    
        const fill: FILL = {
            fillId: crypto.randomUUID(),
            side,
            maker: resting.userId,
            taker: userId,
            market,
            qty: fillQty,
            price: resting.price,
            long: positionType === 'long' ? userId : resting.userId,
            short: positionType === 'short' ? userId : resting.userId,
            createdAt: Date.now()
        };

        //update both Positions
        order.filledQty  += fillQty
        resting.filledQty += fillQty;

        if(resting.filledQty === resting.qty) {
            level.shift();
            if(level.length === 0) {
                oppoSite.delete(bestPrices);
            }
        }

        // if the order is getting executed we need to create a position 
        // export interface Position {
        //     positionId: string,
        //     userId: string,
        //     market: string, //symbol 'USD' | 'BTC'
        //     type: PositionType,
        //     qty: number,
        //     margin: number,
        //     unrealizedPnl: number,
        //     realizedPnl: number
        //     averagePrice: number, 
        //     liquidationPrice: number,
        //     positionStatus: PositionStatus, //long | short
        //     createdAt: number,
        //     closedAt?: number
        // }
        const position: Position = {
            positionId: crypto.randomUUID(),
            userId,
            market,
            type,
            qty:  fillQty,
            margin: (resting.price * qty)/,
        }

    }
}

