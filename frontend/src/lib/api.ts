import { API_URL } from './constants';
import type { Balance, Position, Order, OrderPayload, Fill } from '../types';

async function request<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

export const api = {
  signup: (username: string, password: string) =>
    request<{ token: string; userId: string }>('/signup', { method: 'POST', body: JSON.stringify({ username, password }) }),

  signin: (username: string, password: string) =>
    request<{ token: string }>('/signin', { method: 'POST', body: JSON.stringify({ username, password }) }),

  onramp: (amount: number) =>
    request<Balance>('/perps/onramp', { method: 'POST', body: JSON.stringify({ amount }) }),

  placeOrder: (order: OrderPayload) =>
    request('/perps/order', { method: 'POST', body: JSON.stringify(order) }),

  cancelOrder: (orderId: string) =>
    request('/perps/order', { method: 'DELETE', body: JSON.stringify({ orderId }) }),

  getEquity: () =>
    request<Balance>('/perps/equity'),

  getOpenPositions: (market: string) =>
    request<{ positions: Position[] }>(`/perps/positions/open/${market}`),

  getClosedPositions: (market: string) =>
    request<{ positions: Position[] }>(`/perps/positions/closed/${market}`),

  getFills: (market?: string) =>
    request<{ fills: Fill[] }>(`/perps/fills${market ? `?market=${market}` : ''}`),

  getOpenOrders: (market: string) =>
    request<{ orders: Order[] }>(`/perps/orders/open/${market}`),
};
