import { useCallback, useRef, useState } from 'react';
import type { DepthLevel, OrderbookSnapshot, DepthUpdate } from '../types';

function levelsToArray(levels: Map<number, number>, side: 'bids' | 'asks'): DepthLevel[] {
  const sorted =
    side === 'bids'
      ? [...levels.entries()].sort((a, b) => b[0] - a[0])
      : [...levels.entries()].sort((a, b) => a[0] - b[0]);

  let running = 0;
  return sorted.map(([price, qty]) => {
    running += qty;
    return { price, qty, total: running };
  });
}

export function useOrderBook() {
  const [bids, setBids] = useState<DepthLevel[]>([]);
  const [asks, setAsks] = useState<DepthLevel[]>([]);
  const [flashedPrices, setFlashedPrices] = useState<Set<number>>(new Set());
  const bookRef = useRef({ bids: new Map<number, number>(), asks: new Map<number, number>() });
  const prevBidsRef = useRef(new Map<number, number>());
  const prevAsksRef = useRef(new Map<number, number>());

  const applySnapshot = useCallback((msg: OrderbookSnapshot) => {
    const bids = new Map<number, number>();
    const asks = new Map<number, number>();
    for (const [p, q] of msg.bids) if (q > 0) bids.set(p, q);
    for (const [p, q] of msg.asks) if (q > 0) asks.set(p, q);
    bookRef.current = { bids, asks };
    prevBidsRef.current = new Map(bids);
    prevAsksRef.current = new Map(asks);
    setBids(levelsToArray(bids, 'bids').slice(0, 20));
    setAsks(levelsToArray(asks, 'asks').slice(0, 20));
  }, []);

  const applyDepthUpdate = useCallback((msg: DepthUpdate) => {
    const book = bookRef.current;
    const flashed = new Set<number>();

    for (const [price, qty] of msg.bids) {
      if (qty === 0) book.bids.delete(price);
      else book.bids.set(price, qty);
      flashed.add(price);
    }
    for (const [price, qty] of msg.asks) {
      if (qty === 0) book.asks.delete(price);
      else book.asks.set(price, qty);
      flashed.add(price);
    }

    setFlashedPrices(flashed);
    setTimeout(() => setFlashedPrices(new Set()), 300);

    setBids(levelsToArray(book.bids, 'bids').slice(0, 20));
    setAsks(levelsToArray(book.asks, 'asks').slice(0, 20));
  }, []);

  const maxBidTotal = bids.length > 0 ? bids[bids.length - 1].total : 1;
  const maxAskTotal = asks.length > 0 ? asks[asks.length - 1].total : 1;

  return {
    bids,
    asks,
    maxBidTotal,
    maxAskTotal,
    flashedPrices,
    spread: asks.length > 0 && bids.length > 0 ? asks[0].price - bids[0].price : 0,
    applySnapshot,
    applyDepthUpdate,
  };
}
