import { useState, useCallback } from 'react';
import type { Trade } from '../types';
import { MARKET } from '../lib/constants';

const MAX_TRADES = 500;

function dedupeTrades(trades: Trade[]): Trade[] {
  const seen = new Set<string>();
  const unique: Trade[] = [];
  for (const t of trades) {
    if (seen.has(t.tradeId)) continue;
    seen.add(t.tradeId);
    unique.push(t);
  }
  return unique;
}

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);

  const addTrade = useCallback((trade: Trade) => {
    if (trade.market !== MARKET) return;
    setTrades((prev) => {
      if (prev.some((t) => t.tradeId === trade.tradeId)) return prev;
      return [trade, ...prev].slice(0, MAX_TRADES);
    });
  }, []);

  const loadSnapshot = useCallback((snapshot: Trade[]) => {
    const filtered = snapshot.filter((t) => t.market === MARKET);
    setTrades(dedupeTrades(filtered).slice(0, MAX_TRADES));
  }, []);

  return { trades, addTrade, loadSnapshot };
}
