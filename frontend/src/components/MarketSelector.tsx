import { MARKETS } from '../lib/constants';

export default function MarketSelector({ market, onChange }: { market: string; onChange: (m: string) => void }) {
  return (
    <div className="flex gap-1">
      {MARKETS.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
            market === m ? 'bg-dark-500 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
