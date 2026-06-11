import { useState, useCallback } from 'react';
import type { Trade } from '../types';

const MARKET = 'BTCUSDT';

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);

  const addTrade = useCallback((trade: Trade) => {
    if (trade.market !== MARKET) return;
    setTrades((prev) => [trade, ...prev].slice(0, 200));
  }, []);

  const loadSnapshot = useCallback((snapshot: Trade[]) => {
    setTrades(snapshot.filter((t) => t.market === MARKET));
  }, []);

  return { trades, addTrade, loadSnapshot };
}
