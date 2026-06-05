import type { DepthLevel } from '../types';

export default function PriceTicker({
  bestBid,
  bestAsk,
}: {
  bestBid?: DepthLevel;
  bestAsk?: DepthLevel;
}) {
  const mid = bestBid && bestAsk ? (bestBid.price + bestAsk.price) / 2 : null;
  const direction = bestBid && bestAsk && bestBid.price > bestAsk.price ? 'up' : 'down';

  return (
    <div className="flex items-center gap-2">
      {mid ? (
        <>
          <span className={`text-xl font-bold font-mono tabular-nums ${direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
            ${mid.toFixed(2)}
          </span>
          <div className="flex flex-col text-[10px] leading-tight text-gray-500">
            <span className="font-mono text-green-500">{bestBid!.price.toFixed(2)}</span>
            <span className="font-mono text-red-500">{bestAsk!.price.toFixed(2)}</span>
          </div>
        </>
      ) : (
        <span className="text-gray-600 text-sm font-mono">---</span>
      )}
    </div>
  );
}
