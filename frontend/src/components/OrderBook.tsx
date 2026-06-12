import type { DepthLevel } from '../types';

function OrderBookRow({ level, max, side, flashing }: { level: DepthLevel; max: number; side: 'bid' | 'ask'; flashing: boolean }) {
  const pct = (level.total / max) * 100;
  const barColor = side === 'bid' ? 'bg-green-500/15' : 'bg-red-500/15';

  return (
    <div
      className={`relative flex items-center text-xs h-[22px] px-2 transition-colors duration-150 ${
        flashing
          ? side === 'bid' ? 'bg-green-500/10' : 'bg-red-500/10'
          : 'hover:bg-dark-600/30'
      }`}
    >
      <div
        className={`absolute right-0 top-0 h-full ${barColor} transition-all duration-200`}
        style={{ width: `${pct}%` }}
      />
      <span
        className={`relative w-24 text-right font-mono tabular-nums font-medium ${
          side === 'bid' ? 'text-green-500' : 'text-red-500'
        }`}
      >
        {level.price.toFixed(2)}
      </span>
      <span className="relative w-20 text-right font-mono tabular-nums text-gray-400">
        {level.qty.toFixed(4)}
      </span>
      <span className="relative w-20 text-right font-mono tabular-nums text-gray-500">
        {level.total.toFixed(4)}
      </span>
    </div>
  );
}

interface Props {
  bids: DepthLevel[];
  asks: DepthLevel[];
  spread: number;
  maxBidTotal: number;
  maxAskTotal: number;
  flashedPrices: Set<number>;
}

export default function OrderBook({ bids, asks, spread, maxBidTotal, maxAskTotal, flashedPrices }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-gray-500 border-b border-dark-600 font-medium">
        <span>Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>
      <div className="flex flex-col-reverse flex-1 overflow-y-auto">
        {asks.map((l) => (
          <OrderBookRow key={l.price} level={l} max={maxAskTotal} side="ask" flashing={flashedPrices.has(l.price)} />
        ))}
        {asks.length === 0 && (
          <div className="flex items-center justify-center flex-1 text-gray-600 text-xs">No asks</div>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 py-1.5 border-y border-dark-600 text-sm font-mono bg-dark-700/50">
        <span className="text-green-500 font-semibold">{bids[0]?.price.toFixed(2) ?? '-'}</span>
        <span className="text-gray-500 text-xs">
          Spread <span className="font-semibold text-yellow-400">{spread.toFixed(2)}</span>
        </span>
        <span className="text-red-500 font-semibold">{asks[0]?.price.toFixed(2) ?? '-'}</span>
      </div>
      <div className="flex flex-col flex-1 overflow-y-auto">
        {bids.map((l) => (
          <OrderBookRow key={l.price} level={l} max={maxBidTotal} side="bid" flashing={flashedPrices.has(l.price)} />
        ))}
        {bids.length === 0 && (
          <div className="flex items-center justify-center flex-1 text-gray-600 text-xs">No bids</div>
        )}
      </div>
    </div>
  );
}
