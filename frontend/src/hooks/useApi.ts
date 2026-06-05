import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import type { Balance, Position, OrderPayload, Fill } from '../types';

export function useApi() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEquity = useCallback(async () => {
    try {
      const data = await api.getEquity();
      setBalance(data);
    } catch { /* not authed */ }
  }, []);

  const fetchPositions = useCallback(async (market: string) => {
    try {
      const data = await api.getOpenPositions(market);
      setPositions(data.positions);
    } catch { /* not authed */ }
  }, []);

  const fetchFills = useCallback(async (market?: string) => {
    try {
      const data = await api.getFills(market);
      setFills(data.fills);
    } catch { /* not authed */ }
  }, []);

  const placeOrder = useCallback(async (order: OrderPayload) => {
    setLoading(true);
    try {
      const res = await api.placeOrder(order);
      return res;
    } finally {
      setLoading(false);
    }
  }, []);

  const onramp = useCallback(async (amount: number) => {
    const res = await api.onramp(amount);
    setBalance(res);
    return res;
  }, []);

  return {
    balance,
    positions,
    fills,
    loading,
    fetchEquity,
    fetchPositions,
    fetchFills,
    placeOrder,
    onramp,
    login: api.signin,
    signup: api.signup,
  };
}
