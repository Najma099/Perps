import { MARKET } from '../lib/constants';

export default function MarketSelector() {
  return (
    <span className="px-3 py-1.5 text-sm rounded-lg font-medium bg-dark-500 text-white">
      {MARKET}
    </span>
  );
}
