import BTree from "sorted-btree";

export type PositionType = 'long' | 'short';
export type PositionStatus = 'open' | 'closed'
export type OrderType = 'limit' | 'market';
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'partially_filled'
export type OrderSide = 'buy' | 'sell';

export interface Balance {
    available: number,
    locked: number
}

export interface Position {
    positionId: string,
    userId: string,
    market: string, 
    type: PositionType,
    qty: number,
    margin: number,
    leverage: number,
    unrealizedPnl: number,
    realizedPnl: number,
    averagePrice: number, 
    liquidationPrice: number,
    positionStatus: PositionStatus, 
    createdAt: number,
    closedAt?: number
}

export interface Order {
    orderId: string,
    userId: string,
    market: string,
    side: OrderSide,
    qty: number,
    leverage: number,
    orderType: OrderType,
    price: number,
    status: OrderStatus,
    createdAt: number
}

export interface RestingOrder {
  orderId: string,
  userId: string,
  side: OrderSide,
  qty: number,
  market: string,
  price: number,
  margin: number,
  createdAt: number
}

export interface Orderbook {
  asks: BTree<number, RestingOrder[]>,
  bids: BTree<number, RestingOrder[]>,
  lastTradedPrice: number,
  indexPrice: number
}

export interface Fill {
    fillId: string,
    side: OrderSide,
    maker: string,
    taker: string,
    market: string,
    qty: number,
    price: number,
    long: string,
    short: string,
    createdAt: number
}

export const BALANCES = new Map<string, Balance>();
export const ORDERBOOKS = new Map<string, Orderbook>();
export const POSITIONS = new Map<string, Position[]>();
export const ORDERS = new Map<string, Order[]>();
export const FILLS = new Map<string, Fill[]>();
export const MARK_PRICE = new Map<string, number>();