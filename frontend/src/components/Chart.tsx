import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type Time } from 'lightweight-charts';

interface Props {
  market: string;
}

const BINANCE_REST = 'https://fapi.binance.com';

export default function Chart({ market }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Create chart once
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

    seriesRef.current = series as ISeriesApi<'Candlestick'>;

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

  // Load data and connect WS when market changes
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    const sym = market.toLowerCase();
    let mounted = true;

    wsRef.current?.close();

    async function load() {
      try {
        const res = await fetch(`${BINANCE_REST}/fapi/v1/klines?symbol=${market}&interval=1m&limit=200`);
        const data = await res.json();
        if (!mounted) return;

        const candles: CandlestickData[] = data.map((k: any[]) => ({
          time: (k[0] / 1000) as Time,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));

        series.setData(candles);

        const ws = new WebSocket(`wss://fstream.binance.com/ws/${sym}@kline_1m`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const k = msg.k;
            if (!k) return;
            series.update({
              time: (k.t / 1000) as Time,
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
            });
          } catch { /* ignore */ }
        };
      } catch (err) {
        console.error('Chart error:', err);
      }
    }

    load();

    return () => {
      mounted = false;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [market]);

  return <div ref={containerRef} className="w-full h-full" />;
}
