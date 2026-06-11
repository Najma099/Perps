import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import type { Balance, Position, Order, OrderPayload, Fill } from '../types';

export function useApi() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
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

  const fetchOpenOrders = useCallback(async (market: string) => {
    try {
      const data = await api.getOpenOrders(market);
      setOpenOrders(data.orders);
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

  const cancelOrder = useCallback(async (orderId: string) => {
    await api.cancelOrder(orderId);
    setOpenOrders((prev) => prev.filter((o) => o.orderId !== orderId));
  }, []);

  return {
    balance,
    positions,
    openOrders,
    fills,
    loading,
    fetchEquity,
    fetchPositions,
    fetchOpenOrders,
    fetchFills,
    placeOrder,
    cancelOrder,
    onramp,
    login: api.signin,
    signup: api.signup,
  };
}
