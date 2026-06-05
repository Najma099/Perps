import { useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '../lib/constants';
import type { WSMessage } from '../types';

export function useWebSocket(market: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const cbRef = useRef<((msg: WSMessage) => void) | null>(null);
  const marketRef = useRef(market);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  marketRef.current = market;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', market: marketRef.current }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        cbRef.current?.(msg);
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect, market]);

  const onMessage = useCallback((cb: (msg: WSMessage) => void) => {
    cbRef.current = cb;
  }, []);

  return { onMessage };
}
