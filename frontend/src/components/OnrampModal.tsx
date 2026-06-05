import { useState } from 'react';

interface Props {
  onDeposit: (amount: number) => Promise<void>;
  onClose: () => void;
}

const PRESETS = [500, 1000, 5000, 10000, 50000];

export default function OnrampModal({ onDeposit, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      await onDeposit(num);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-xl p-6 w-80 border border-dark-600">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Deposit Funds</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount (USD)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div className="flex gap-1 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className="px-2 py-1 text-xs bg-dark-700 text-gray-400 rounded hover:bg-dark-500 transition-colors"
              >
                ${p.toLocaleString()}
              </button>
            ))}
          </div>

          {error && <div className="text-red-500 text-xs">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="py-2.5 bg-yellow-500 text-dark-900 rounded-lg font-semibold text-sm hover:bg-yellow-400 transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Deposit'}
          </button>
        </form>
      </div>
    </div>
  );
}
