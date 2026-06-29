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
    return candles;
  } catch {
    return [];
  }
}
