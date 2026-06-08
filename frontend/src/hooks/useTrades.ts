import { useState, useCallback } from 'react';
import type { Trade } from '../types';

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);

  const addTrade = useCallback((trade: Trade) => {
    setTrades((prev) => [trade, ...prev].slice(0, 5000));
  }, []);

  const loadSnapshot = useCallback((snapshot: Trade[]) => {
    setTrades(snapshot);
  }, []);

  return { trades, addTrade, loadSnapshot };
}
