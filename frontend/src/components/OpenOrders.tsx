import type { Order } from '../types';

interface Props {
  orders: Order[];
  onCancel: (orderId: string) => void;
}

function shortId(id: string) {
  return id.slice(0, 8) + '…';
}

export default function OpenOrders({ orders, onCancel }: Props) {
  const open = orders.filter((o) => o.status === 'open' || o.status === 'partially_filled');

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-xs text-gray-500 border-b border-dark-600 font-medium flex items-center justify-between">
        <span>Open Orders ({open.length})</span>
        {open.length > 0 && (
          <button
            onClick={() => {
              open.forEach((o) => onCancel(o.orderId));
            }}
            className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
          >
            Cancel All
          </button>
        )}
      </div>
      {open.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-gray-600 text-xs">
          No open orders
        </div>
      ) : (
        <div className="overflow-y-auto text-xs">
          <div className="flex items-center text-gray-500 px-3 py-1.5 border-b border-dark-700 sticky top-0 bg-dark-800">
            <span className="w-16">Order</span>
            <span className="w-10 text-right">Side</span>
            <span className="w-14 text-right">Qty</span>
            <span className="w-20 text-right">Price</span>
            <span className="w-12 text-center">…</span>
          </div>
          {open.map((o) => (
            <div key={o.orderId} className="flex items-center px-3 py-2 hover:bg-dark-600/50 border-b border-dark-700/50">
              <span className="w-16 font-mono text-gray-400" title={o.orderId}>
                {shortId(o.orderId)}
              </span>
              <span className={`w-10 text-right font-semibold ${o.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                {o.side === 'buy' ? 'BUY' : 'SELL'}
              </span>
              <span className="w-14 text-right font-mono text-gray-400">{o.qty.toFixed(4)}</span>
              <span className="w-20 text-right font-mono text-gray-400">${o.price.toFixed(2)}</span>
              <span className="w-12 text-center">
                <button
                  onClick={() => onCancel(o.orderId)}
                  className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                  title="Cancel order"
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
