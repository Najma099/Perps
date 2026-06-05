import type { Balance, Fill, Position } from '../types';

interface Props {
  balance: Balance;
  positions: Position[];
  fills: Fill[];
  onClose: () => void;
}

export default function ProfileModal({ balance, positions, fills, onClose }: Props) {
  const openPositions = positions.filter((p) => p.unrealizedPnl !== undefined);
  const totalPnl = openPositions.reduce((s, p) => s + p.unrealizedPnl, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-xl w-[480px] max-h-[80vh] overflow-y-auto border border-dark-600">
        <div className="flex items-center justify-between p-4 border-b border-dark-600">
          <h2 className="text-lg font-semibold">Profile</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Balance Summary */}
          <div className="bg-dark-700 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-2">Account Balance</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500">Available</div>
                <div className="font-mono text-white font-semibold">${balance.available.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Locked</div>
                <div className="font-mono text-gray-300">${balance.locked.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Unrealized PnL</div>
                <div className={`font-mono ${balance.unrealized >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {balance.unrealized >= 0 ? '+' : ''}{balance.unrealized.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-dark-600 flex justify-between">
              <span className="text-xs text-gray-500">Total Equity</span>
              <span className="font-mono font-bold text-white">${balance.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Positions Summary */}
          {openPositions.length > 0 && (
            <div className="bg-dark-700 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2">Open Positions ({openPositions.length})</div>
              <div className="text-xs text-gray-500 flex justify-between mb-1">
                <span>Total Unrealized PnL</span>
                <span className={`font-mono ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
                </span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {openPositions.map((p) => (
                  <div key={p.positionId} className="flex justify-between text-xs py-1 border-b border-dark-600/50">
                    <span className="text-gray-400">{p.market} {p.type.toUpperCase()}</span>
                    <span className="font-mono text-gray-300">{p.qty.toFixed(4)} @ ${p.averagePrice.toFixed(2)}</span>
                    <span className={`font-mono ${p.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {p.unrealizedPnl >= 0 ? '+' : ''}{p.unrealizedPnl.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Fills */}
          {fills.length > 0 && (
            <div className="bg-dark-700 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2">Recent Fills</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {fills.slice(0, 20).map((f) => (
                  <div key={f.fillId} className="flex justify-between text-xs py-1 border-b border-dark-600/50">
                    <span className="text-gray-400">{f.market}</span>
                    <span className={`font-mono ${f.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                      {f.side.toUpperCase()}
                    </span>
                    <span className="font-mono text-gray-300">{f.qty.toFixed(4)}</span>
                    <span className="font-mono text-gray-300">${f.price.toFixed(2)}</span>
                    <span className="text-gray-500">{new Date(f.createdAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
