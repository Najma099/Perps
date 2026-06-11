export interface DepthLevel {
  price: number;
  qty: number;
  total: number;
}

export interface OrderbookSnapshot {
  type: 'depthSnapshot';
  market: string;
  lastUpdateId: number;
  bids: [number, number][];
  asks: [number, number][];
}

export interface DepthUpdate {
  type: 'depthUpdate';
  market: string;
  firstUpdateId: number;
  lastUpdateId: number;
  bids: [number, number][];
  asks: [number, number][];
}

export interface Trade {
  type: 'trade';
  market: string;
  price: number;
  qty: number;
  side: 'buy' | 'sell';
  tradeId: string;
  createdAt?: number;
}

export interface TradeSnapshot {
  type: 'tradeSnapshot';
  market: string;
  trades: Trade[];
}

export type WSMessage = OrderbookSnapshot | DepthUpdate | Trade | TradeSnapshot;

export interface OrderPayload {
  userId: string;
  market: string;
  side: 'buy' | 'sell';
  positionType: 'long' | 'short';
  qty: number;
  leverage: number;
  orderType: 'limit' | 'market';
  price?: number;
}

export interface Position {
  positionId: string;
  market: string;
  type: 'long' | 'short';
  qty: number;
  margin: number;
  leverage: number;
  unrealizedPnl: number;
  realizedPnl: number;
  averagePrice: number;
  liquidationPrice: number;
}

export interface Balance {
  available: number;
  locked: number;
  unrealized: number;
  total: number;
}

export interface Order {
  orderId: string;
  market: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  leverage: number;
  orderType: 'limit' | 'market';
  status: string;
  createdAt: string;
}

export interface Fill {
  fillId: string;
  market: string;
  price: number;
  qty: number;
  side: 'buy' | 'sell';
  createdAt: string;
}
