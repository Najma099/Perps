import type { Balance } from '../types';

interface Props {
  balance: Balance | null;
  onSignOut: () => void;
  onOpenDeposit: () => void;
  onOpenProfile: () => void;
}

export default function AccountSummary({ balance, onSignOut, onOpenDeposit, onOpenProfile }: Props) {
  if (!balance) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-3 pr-3 border-r border-dark-600">
        <div className="text-right">
          <div className="text-xs text-gray-500">Total Equity</div>
          <div className="font-mono font-semibold text-white">
            ${(balance.total ?? (balance.available + balance.locked)).toFixed(2)}
            <span className={`ml-1.5 text-xs ${(balance.unrealized ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {(balance.unrealized ?? 0) >= 0 ? '+' : ''}{(balance.unrealized ?? 0).toFixed(2)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Available</div>
          <div className="font-mono text-gray-300">${balance.available.toFixed(2)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Locked</div>
          <div className="font-mono text-gray-400">${balance.locked.toFixed(2)}</div>
        </div>
      </div>

      <button
        onClick={onOpenDeposit}
        className="px-3 py-1.5 text-xs font-medium bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 transition-colors"
      >
        + Deposit
      </button>

      <button
        onClick={onOpenProfile}
        className="px-3 py-1.5 text-xs font-medium bg-dark-600 text-gray-400 rounded-lg hover:text-white transition-colors"
      >
        Profile
      </button>

      <button
        onClick={onSignOut}
        className="text-xs text-gray-500 hover:text-gray-300 ml-1"
      >
        Sign Out
      </button>
    </div>
  );
}
