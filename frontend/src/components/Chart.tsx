import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Trade } from '../types';
import { candleBucketTime, fetchCandles } from '../lib/candles';

interface Props {
  market: string;
  trades: Trade[];
}

const VISIBLE_BARS = 120;

function showRecentBars(chart: IChartApi, barCount: number) {
  if (barCount <= VISIBLE_BARS) {
    chart.timeScale().fitContent();
    return;
  }
  chart.timeScale().setVisibleLogicalRange({
    from: barCount - VISIBLE_BARS,
    to: barCount - 1,
  });
}

function mergeTradeIntoCandle(
  prev: CandlestickData | undefined,
  price: number,
  time: UTCTimestamp,
): CandlestickData {
  if (!prev) {
    return { time, open: price, high: price, low: price, close: price };
  }
  return {
    time,
    open: prev.open,
    high: Math.max(prev.high, price),
    low: Math.min(prev.low, price),
    close: price,
  };
}

export default function Chart({ market, trades }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lastDataRef = useRef<Map<number, CandlestickData>>(new Map());
  const seenTradeIdsRef = useRef<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

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
        barSpacing: 8,
        minBarSpacing: 3,
        rightOffset: 8,
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
        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(containerRef.current);

    let cancelled = false;
    setLoaded(false);
    lastDataRef.current = new Map();
    seenTradeIdsRef.current = new Set();

    fetchCandles(market).then((candles) => {
      if (cancelled || !seriesRef.current) return;

      if (candles.length > 0) {
        const data: CandlestickData[] = candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        seriesRef.current.setData(data);
        for (const c of data) lastDataRef.current.set(c.time as number, c);
        showRecentBars(chart, data.length);
      }

      setLoaded(true);
    });

    return () => {
      cancelled = true;
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      lastDataRef.current = new Map();
      seenTradeIdsRef.current = new Set();
      setLoaded(false);
    };
  }, [market]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !loaded) return;

    const last = lastDataRef.current;
    const seen = seenTradeIdsRef.current;

    let hasChanges = false;
    for (const t of trades) {
      if (t.market !== market) continue;
      if (seen.has(t.tradeId)) continue;
      seen.add(t.tradeId);

      const bucket = candleBucketTime(t.createdAt ?? Date.now());
      const time = bucket as UTCTimestamp;
      const prev = last.get(bucket);
      const candle = mergeTradeIntoCandle(prev, t.price, time);

      last.set(bucket, candle);
      if (
        !prev ||
        prev.open !== candle.open ||
        prev.high !== candle.high ||
        prev.low !== candle.low ||
        prev.close !== candle.close
      ) {
        hasChanges = true;
      }
    }

    if (hasChanges) {
      try {
        const sorted = Array.from(last.entries())
          .sort(([a], [b]) => a - b)
          .map(([, c]) => c);
        series.setData(sorted);
        if (chartRef.current) {
          showRecentBars(chartRef.current, last.size);
        }
      } catch (err) {
        console.error('Chart update failed:', err);
      }
    }
  }, [trades, market, loaded]);

  return <div ref={containerRef} className="w-full h-full" />;
}
