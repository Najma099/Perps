import type { Trade } from '../types';

interface Props {
  trades: Trade[];
  market: string;
}

export default function Fills({ trades, market }: Props) {
  const filtered = trades.filter((t) => t.market === market);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-[1fr_1fr_64px_80px] gap-0 px-3 py-1.5 text-xs text-gray-500 border-b border-dark-600 font-medium">
        <span className="text-left">Price</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Side</span>
        <span className="text-right">Time</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((t) => (
          <div
            key={t.tradeId}
            className="grid grid-cols-[1fr_1fr_64px_80px] gap-0 px-3 py-1 text-xs border-b border-dark-700/40 hover:bg-dark-600/30"
          >
            <span className={`font-mono tabular-nums ${t.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
              {t.price.toFixed(2)}
            </span>
            <span className="font-mono tabular-nums text-gray-400 text-right">
              {t.qty.toFixed(4)}
            </span>
            <span className={`font-mono text-[10px] font-semibold tracking-wide text-right ${t.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
              {t.side === 'buy' ? 'BUY' : 'SELL'}
            </span>
            <span className="font-mono tabular-nums text-gray-500 text-right text-[10px]">
              {t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : '--'}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            No trades yet
          </div>
        )}
      </div>
    </div>
  );
}
