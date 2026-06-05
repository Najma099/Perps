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

export type WSMessage = OrderbookSnapshot | DepthUpdate | Trade;

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

export interface Fill {
  fillId: string;
  market: string;
  price: number;
  qty: number;
  side: 'buy' | 'sell';
  createdAt: string;
}
