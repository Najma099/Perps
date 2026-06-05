import { useState } from 'react';

interface Props {
  market: string;
  balance: { available: number } | null;
  onPlaceOrder: (order: {
    market: string;
    side: 'buy' | 'sell';
    positionType: 'long' | 'short';
    qty: number;
    leverage: number;
    orderType: 'limit' | 'market';
    price?: number;
  }) => void;
}

export default function OrderForm({ market, balance, onPlaceOrder }: Props) {
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [leverage, setLeverage] = useState('10');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qty) return;
    onPlaceOrder({
      market,
      side: side === 'long' ? 'buy' : 'sell',
      positionType: side,
      qty: parseFloat(qty),
      leverage: parseFloat(leverage),
      orderType,
      price: orderType === 'limit' ? parseFloat(price) : undefined,
    });
  };

  const notional = (parseFloat(price || '0') * parseFloat(qty || '0')) || 0;
  const margin = notional / parseFloat(leverage || '10');

  return (
    <div className="flex flex-col h-full p-3">
      <div className="flex rounded-lg overflow-hidden text-sm font-medium mb-3">
        <button
          onClick={() => setSide('long')}
          className={`flex-1 py-2 text-center transition-colors ${side === 'long' ? 'bg-green-500 text-white' : 'bg-dark-600 text-gray-400 hover:text-white'}`}
        >
          Long
        </button>
        <button
          onClick={() => setSide('short')}
          className={`flex-1 py-2 text-center transition-colors ${side === 'short' ? 'bg-red-500 text-white' : 'bg-dark-600 text-gray-400 hover:text-white'}`}
        >
          Short
        </button>
      </div>

      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setOrderType('limit')}
          className={`flex-1 py-1.5 text-xs rounded transition-colors ${orderType === 'limit' ? 'bg-dark-500 text-white' : 'bg-dark-700 text-gray-500'}`}
        >
          Limit
        </button>
        <button
          onClick={() => setOrderType('market')}
          className={`flex-1 py-1.5 text-xs rounded transition-colors ${orderType === 'market' ? 'bg-dark-500 text-white' : 'bg-dark-700 text-gray-500'}`}
        >
          Market
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Price</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            disabled={orderType === 'market'}
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-dark-500 disabled:opacity-40"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0.00"
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-dark-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Leverage</label>
          <input
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-dark-500"
          />
        </div>

        <div className="text-xs text-gray-500 space-y-1 pt-1">
          <div className="flex justify-between">
            <span>Notional</span>
            <span className="font-mono text-gray-400">${notional.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Margin</span>
            <span className="font-mono text-gray-400">${margin.toFixed(2)}</span>
          </div>
          {balance && (
            <div className="flex justify-between">
              <span>Available</span>
              <span className="font-mono text-gray-400">${balance.available.toFixed(2)}</span>
            </div>
          )}
        </div>

        <button
          type="submit"
          className={`mt-2 py-3 rounded-lg text-sm font-semibold text-white transition-colors ${side === 'long' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
        >
          {side === 'long' ? 'Buy / Long' : 'Sell / Short'} {market}
        </button>
      </form>
    </div>
  );
}
