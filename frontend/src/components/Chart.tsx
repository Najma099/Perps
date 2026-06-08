import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type Time } from 'lightweight-charts';
import type { Trade } from '../types';

interface Props {
  market: string;
  trades: Trade[];
}

function buildCandles(trades: Trade[]): CandlestickData[] {
  if (trades.length === 0) return [];

  const minuteMap = new Map<number, { open: number; high: number; low: number; close: number }>();

  for (const t of trades) {
    const ms = t.createdAt ?? Date.now();
    const minute = Math.floor(ms / 60000) * 60;

    const existing = minuteMap.get(minute);
    if (existing) {
      existing.high = Math.max(existing.high, t.price);
      existing.low = Math.min(existing.low, t.price);
      existing.close = t.price;
    } else {
      minuteMap.set(minute, { open: t.price, high: t.price, low: t.price, close: t.price });
    }
  }

  return Array.from(minuteMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, c]) => ({ time: time as Time, ...c }));
}

export default function Chart({ market, trades }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

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

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const marketTrades = trades.filter((t) => t.market === market);
    const candles = buildCandles(marketTrades);
    if (candles.length === 0) return;

    series.setData(candles);
  }, [trades, market]);

  return <div ref={containerRef} className="w-full h-full" />;
}
