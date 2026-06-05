import type { Trade } from '../types';

export default function Fills({ trades }: { trades: Trade[] }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500 border-b border-dark-600 font-medium">
        <span>Price</span>
        <span>Qty</span>
        <span>Side</span>
        <span>Time</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {trades.map((t) => (
          <div key={t.tradeId} className="flex items-center text-xs h-6 px-2 hover:bg-dark-600/50">
            <span className={`w-24 text-right font-mono tabular-nums ${t.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
              {t.price.toFixed(2)}
            </span>
            <span className="w-20 text-right font-mono tabular-nums text-gray-400">
              {t.qty.toFixed(4)}
            </span>
            <span className={`w-12 text-right font-mono font-medium ${t.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
              {t.side === 'buy' ? 'BUY' : 'SELL'}
            </span>
            <span className="w-16 text-right font-mono tabular-nums text-gray-500">
              {t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : '--'}
            </span>
          </div>
        ))}
        {trades.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            No trades yet
          </div>
        )}
      </div>
    </div>
  );
}
