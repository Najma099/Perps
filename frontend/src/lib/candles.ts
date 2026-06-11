import type { Candle } from '../types';
import { api } from './api';

export const CANDLE_INTERVAL_MS = 60_000;
export const CANDLE_BUCKET_SECS = 60;

export function candleBucketTime(ms: number): number {
  return Math.floor(ms / CANDLE_INTERVAL_MS) * CANDLE_BUCKET_SECS;
}

export async function fetchCandles(market: string): Promise<Candle[]> {
  try {
    const { candles } = await api.getCandles(market);
    if (candles.length > 0) return candles;
  } catch {
    // try direct Binance via dev proxy
  }

  try {
    const res = await fetch(
      `/binance/fapi/v1/klines?symbol=${market}&interval=1m&limit=500`,
    );
    if (!res.ok) return [];
    const raw = (await res.json()) as number[][];
    return raw.map((k) => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(String(k[1])),
      high: parseFloat(String(k[2])),
      low: parseFloat(String(k[3])),
      close: parseFloat(String(k[4])),
    }));
  } catch {
    return [];
  }
}
