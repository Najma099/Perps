import { BALANCES, ORDERBOOKS, ORDERS, FILLS, MARK_PRICE, POSITIONS, type Fill, type OrderSide, type OrderType, type PositionType, type Position, type Order, type RestingOrder } from "../store/perp-store";

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

    const userId = payload.userId as string;
    const market = payload.market as string;
    const side = payload.side as OrderSide;
    const qty = payload.qty as number;
    const margin = payload.margin as number;
    const orderType = payload.orderType as OrderType;
    const price = payload.price as number;
    const positionType = payload.positionType as PositionType;

    seedUserIfNeeded(userId);
    const userBalance = BALANCES.get(userId)!;
    const availBalance = userBalance?.available!;

    if(availBalance < margin) {
        throw new Error('Insufficient funds');
    }

    userBalance.locked += margin;
    userBalance.available -= margin


    const order: Order = {
        orderId: crypto.randomUUID(),
        userId,
        market,
        side,
        qty,
        margin,
        orderType,
        price,
        status: 'open',
        createdAt: Date.now()
    };

    if(!ORDERS.has(userId)) ORDERS.set(userId, []);
    ORDERS.get(userId)!.push(order);
        
    if (!ORDERBOOKS.has(market)) {
        ORDERBOOKS.set(market, {
            asks:            new Map(),
            bids:            new Map(),
            lastTradedPrice: MARK_PRICE.get(market) ?? 0,
            indexPrice:      MARK_PRICE.get(market) ?? 0
        });
    }
    const book = ORDERBOOKS.get(market)!;
    const oppoSite = positionType === 'long' ? book.asks : book.bids;

    let filledQty = 0;

    while(filledQty < qty) {
        const remaining = qty - filledQty;

        const prices = [...oppoSite.keys()];
        if(prices.length == 0) break;

        const bestPrices = positionType === 'long' ? Math.min(...prices) : Math.max(...prices);

        if(orderType == 'limit') {
            if(positionType === 'long' && bestPrices > price) break;
            if(positionType === 'short' && bestPrices < price) break;
        }


        const level = oppoSite.get(bestPrices)!;
        const resting = level[0]!;

        const fillQty = Math.min(resting.qty, remaining);
        const fillPrice = resting.price;

        const fill: Fill = {
            fillId:    crypto.randomUUID(),
            side:      positionType,
            maker:     resting.userId,
            taker:     userId,
            market,
            qty:       fillQty,
            price:     fillPrice,
            long:      positionType === 'long'  ? userId : resting.userId,
            short:     positionType === 'short' ? userId : resting.userId,
            createdAt: Date.now()
        };

        if(!FILLS.has(market)) {
            FILLS.set(market, []);
        }
        FILLS.get(market)!.push(fill);

        resting.qty -= fillQty;
        if(resting.qty === 0) {
            level.shift();
            if(level.length === 0) oppoSite.delete(bestPrices);
        }

        const takerFillMargin = (fillQty/ qty) * margin;

        const takerLiqPrice = positionType === 'long'
            ? fillPrice - (takerFillMargin / fillQty)
            : fillPrice + (takerFillMargin / fillQty);
        
        const takerPosition: Position = {
            positionId: crypto.randomUUID(),
            userId,
            market,
            type: positionType,
            qty: fillQty,
            margin: takerFillMargin,
            unrealizedPnl: 0,
            realizedPnl: 0,
            averagePrice: fillPrice,
            liquidationPrice: takerLiqPrice,
            positionStatus: "open",
            createdAt: Date.now()
        }

        if(!POSITIONS.has(userId)) {
            POSITIONS.set(userId, [])
        }

        POSITIONS.get(userId)?.push(takerPosition);
        userBalance.locked -= takerFillMargin;

        const makerType = positionType === "long" ? "short" : "long";
        const makerMargin = resting.margin;
        const makerLiqPrice = makerType === 'long'
            ? fillPrice - (makerMargin / fillQty)
            : fillPrice + (makerMargin / fillQty)
        
        const makerPosition: Position = {
            positionId: crypto.randomUUID(),
            userId: resting.userId,
            market,
            type: makerType,
            qty: fillQty,
            margin: makerMargin,
            unrealizedPnl: 0,
            realizedPnl: 0,
            averagePrice: fillPrice,
            liquidationPrice: makerLiqPrice,
            positionStatus: 'open',
            createdAt: Date.now()
        }

        if(!POSITIONS.has(resting.userId)) POSITIONS.set(resting.userId, []);
        POSITIONS.get(resting.userId)!.push(makerPosition);

        const makerBalance = BALANCES.get(resting.userId);
        if(makerBalance) {
            makerBalance.locked -= makerMargin;
        }

        filledQty += fillQty;
    }

    if(filledQty < qty && orderType === "limit") {
        const restingOrder: RestingOrder = {
            orderId: order.orderId,
            userId,
            side,
            qty : qty - filledQty,
            market,
            price,
            margin: ((qty - filledQty)/qty) * margin,
            createdAt: Date.now()
        };

        const sideBook = side === 'buy' ? book.bids : book.asks;
        if(!sideBook.has(price)) sideBook.set(price, []);
        sideBook.get(price)?.push(restingOrder);
    }
    order.status = filledQty === 0 ? 'open'
        : filledQty < qty ? 'partially_filled'
        : 'filled';

    return order;
}

export const deletePositin = (payload: Record<string, unknown>) => {

    const userId = payload.userId as string;
    const orderId = payload.orderId as string;

    const userOrders = ORDERS.get(userId);
    const order = userOrders?.find(o => o.orderId === orderId);

    if(!order) throw new Error("Invalid order Id");

    if(order.status === 'filled')    throw new Error('Cannot cancel a filled order');
    if(order.status === 'cancelled') throw new Error('Order already cancelled');

    const book = ORDERBOOKS.get(order.market);
    if(book) {
        const side = order.side === 'buy' ? book.bids : book.asks;
        const level = side.get(order.price!);

        if(level) {
            const filtered = level.filter(o => o.orderId !== order.orderId);
            if(filtered.length === 0) {
                side.delete(order.price!);
            } else {
                side.set(order.price!, filtered);
            }
        }
    }

    const userBalance = BALANCES.get(userId);
    if (userBalance) {
        userBalance.locked    -= order.margin;
        userBalance.available += order.margin;
    }
    
    order.status = "cancelled";
    return {
        orderId,
        status: 'cancelled'
    }

}