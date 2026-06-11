import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type UTCTimestamp } from 'lightweight-charts';
import type { Trade } from '../types';

interface Props {
  market: string;
  trades: Trade[];
}

function bucketTime(ms: number): UTCTimestamp {
  return Math.floor(ms / 300000) * 300 as UTCTimestamp;
}

function buildCandleMap(trades: Trade[]) {
  const map = new Map<number, { open: number; high: number; low: number; close: number }>();
  for (const t of trades) {
    const ms = t.createdAt ?? Date.now();
    const b = bucketTime(ms);
    const existing = map.get(b);
    if (existing) {
      existing.high = Math.max(existing.high, t.price);
      existing.low = Math.min(existing.low, t.price);
      existing.close = t.price;
    } else {
      map.set(b, { open: t.price, high: t.price, low: t.price, close: t.price });
    }
  }
  return map;
}

function toCandle(time: UTCTimestamp, c: { open: number; high: number; low: number; close: number }): CandlestickData {
  return { time, ...c };
}

export default function Chart({ market, trades }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lastDataRef = useRef<Map<number, CandlestickData>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0b0e' },
        textColor: '#5e6673',
      },
      grid: {
        vertLines: { color: '#1c1c23' },
        horzLines: { color: '#1c1c23' },
      },
      crosshair: {
        vertLine: { color: '#3a3a47', width: 1, style: 2 },
        horzLine: { color: '#3a3a47', width: 1, style: 2 },
      },
      timeScale: {
        borderColor: '#26262f',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#26262f',
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderDownColor: '#f6465d',
      borderUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
      wickUpColor: '#0ecb81',
    });

    seriesRef.current = series;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      lastDataRef.current = new Map();
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const map = buildCandleMap(trades.filter((t) => t.market === market));
    const last = lastDataRef.current;

    const sorted = [...map.entries()].sort(([a], [b]) => a - b);

    if (last.size === 0) {
      const data = sorted.map(([time, c]) => toCandle(time as UTCTimestamp, c));
      series.setData(data);
      for (const d of data) last.set(d.time as number, d);
      return;
    }

    for (const [time, c] of sorted) {
      const candle = toCandle(time as UTCTimestamp, c);
      const prev = last.get(time);
      if (!prev) {
        series.update(candle);
      } else if (
        prev.open !== c.open ||
        prev.high !== c.high ||
        prev.low !== c.low ||
        prev.close !== c.close
      ) {
        series.update(candle);
      }
      last.set(time, candle);
    }
  }, [trades, market]);

  return <div ref={containerRef} className="w-full h-full" />;
}
