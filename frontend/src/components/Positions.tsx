import type { Position } from '../types';

interface Props {
  positions: Position[];
}

export default function Positions({ positions }: Props) {
  const open = positions.filter((p) => p.qty > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-xs text-gray-500 border-b border-dark-600 font-medium flex items-center justify-between">
        <span>Open Positions ({open.length})</span>
        {open.length > 0 && (
          <span className={`text-xs font-mono ${open.reduce((s, p) => s + p.unrealizedPnl, 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            PnL: {open.reduce((s, p) => s + p.unrealizedPnl, 0) >= 0 ? '+' : ''}
            {open.reduce((s, p) => s + p.unrealizedPnl, 0).toFixed(2)}
          </span>
        )}
      </div>
      {open.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-gray-600 text-xs">
          No open positions
        </div>
      ) : (
        <div className="overflow-y-auto text-xs">
          <div className="flex items-center text-gray-500 px-3 py-1.5 border-b border-dark-700 sticky top-0 bg-dark-800">
            <span className="w-16">Market</span>
            <span className="w-12 text-right">Side</span>
            <span className="w-16 text-right">Size</span>
            <span className="w-20 text-right">Entry / Liq.</span>
            <span className="w-16 text-right">Margin</span>
            <span className="w-16 text-right">PnL</span>
          </div>
          {open.map((p) => (
            <div key={p.positionId} className="flex items-center px-3 py-2 hover:bg-dark-600/50 border-b border-dark-700/50">
              <span className="w-16 font-mono text-gray-300">{p.market}</span>
              <span className={`w-12 text-right font-semibold ${p.type === 'long' ? 'text-green-500' : 'text-red-500'}`}>
                {p.type.toUpperCase()}
              </span>
              <span className="w-16 text-right font-mono text-gray-400">{p.qty.toFixed(4)}</span>
              <div className="w-20 text-right">
                <div className="font-mono text-gray-400">${p.averagePrice.toFixed(2)}</div>
                <div className="font-mono text-gray-600 text-[10px]">${p.liquidationPrice.toFixed(2)}</div>
              </div>
              <span className="w-16 text-right font-mono text-gray-400">${p.margin.toFixed(2)}</span>
              <span className={`w-16 text-right font-mono font-medium ${p.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {p.unrealizedPnl >= 0 ? '+' : ''}{p.unrealizedPnl.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
