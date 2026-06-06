import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useOrderBook } from './hooks/useOrderBook';
import { useTrades } from './hooks/useTrades';
import { useApi } from './hooks/useApi';
import { ToastProvider, useToast } from './components/Toast';
import OrderBook from './components/OrderBook';
import Fills from './components/Fills';
import OrderForm from './components/OrderForm';
import Positions from './components/Positions';
import AccountSummary from './components/AccountSummary';
import MarketSelector from './components/MarketSelector';
import PriceTicker from './components/PriceTicker';
import AuthModal from './components/AuthModal';
import OnrampModal from './components/OnrampModal';
import ProfileModal from './components/ProfileModal';
import Chart from './components/Chart';

function AppInner() {
  const [market, setMarket] = useState('BTCUSDT');
  const [showAuth, setShowAuth] = useState(!localStorage.getItem('token'));
  const [showDeposit, setShowDeposit] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const { onMessage } = useWebSocket(market);
  const orderBook = useOrderBook();
  const { trades, addTrade } = useTrades();
  const { balance, positions, fills, fetchEquity, fetchPositions, fetchFills, placeOrder, onramp } = useApi();
  const { toast } = useToast();

  const handleAuth = useCallback(() => {
    setShowAuth(false);
    fetchEquity();
    fetchPositions(market);
    fetchFills(market);
  }, [fetchEquity, fetchPositions, fetchFills, market]);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    setShowAuth(true);
    setShowProfile(false);
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    fetchEquity();
    fetchPositions(market);
    fetchFills(market);
  }, [market, fetchEquity, fetchPositions, fetchFills]);

  useEffect(() => {
    onMessage((msg) => {
      if (msg.type === 'depthSnapshot') orderBook.applySnapshot(msg);
      else if (msg.type === 'depthUpdate') orderBook.applyDepthUpdate(msg);
      else if (msg.type === 'trade') addTrade(msg);
    });
  }, [onMessage, orderBook, addTrade]);

  const handlePlaceOrder = async (order: any) => {
    try {
      await placeOrder(order);
      toast(
        `Order placed: ${order.positionType.toUpperCase()} ${order.qty} ${order.market}`,
        'success',
      );
      setTimeout(() => fetchPositions(market), 500);
      setTimeout(() => fetchEquity(), 500);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDeposit = async (amount: number) => {
    await onramp(amount);
    toast(`Deposited $${amount.toLocaleString()}`, 'success');
  };

  const isAuthed = !!localStorage.getItem('token');

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-dark-600 bg-dark-800/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-yellow-500 tracking-tight">PerpEx</h1>
          <MarketSelector market={market} onChange={setMarket} />
          <PriceTicker bestBid={orderBook.bids[0]} bestAsk={orderBook.asks[0]} />
        </div>
        <div className="flex items-center gap-4">
          {!isAuthed ? (
            <button
              onClick={() => setShowAuth(true)}
              className="text-sm text-yellow-500 hover:text-yellow-400 font-medium transition-colors"
            >
              Connect
            </button>
          ) : (
            <AccountSummary
              balance={balance}
              onSignOut={handleSignOut}
              onOpenDeposit={() => setShowDeposit(true)}
              onOpenProfile={() => {
                fetchFills(market);
                setShowProfile(true);
              }}
            />
          )}
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-[320px_1fr_320px] gap-0 overflow-hidden">
        {/* Left Column: OrderBook */}
        <div className="border-r border-dark-600 flex flex-col bg-dark-800 overflow-hidden">
          <div className="text-xs text-gray-500 px-3 py-1.5 border-b border-dark-600 font-medium flex items-center justify-between">
            <span>Order Book</span>
            <span className="text-[10px] text-gray-600">{orderBook.bids.length + orderBook.asks.length} levels</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <OrderBook
              bids={orderBook.bids}
              asks={orderBook.asks}
              spread={orderBook.spread}
              maxBidTotal={orderBook.maxBidTotal}
              maxAskTotal={orderBook.maxAskTotal}
              flashedPrices={orderBook.flashedPrices}
            />
          </div>
        </div>

        {/* Center Column: Chart + Trades */}
        <div className="flex flex-col bg-dark-900 overflow-hidden">
          <div className="flex-1 min-h-0">
            <Chart market={market} trades={trades} />
          </div>
          <div className="h-[200px] border-t border-dark-600 bg-dark-800 flex-shrink-0">
            <div className="text-xs text-gray-500 px-3 py-1.5 border-b border-dark-600 font-medium">Market Trades</div>
            <div className="h-[calc(100%-32px)]">
              <Fills trades={trades} />
            </div>
          </div>
        </div>

        {/* Right Column: Order Form + Positions */}
        <div className="border-l border-dark-600 flex flex-col bg-dark-800 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0">
            <OrderForm
              market={market}
              balance={balance}
              onPlaceOrder={handlePlaceOrder}
            />
          </div>
          <div className="h-[220px] border-t border-dark-600 flex-shrink-0">
            <Positions positions={positions} />
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAuth && <AuthModal onAuth={handleAuth} />}
      {showDeposit && <OnrampModal onDeposit={handleDeposit} onClose={() => setShowDeposit(false)} />}
      {showProfile && balance && (
        <ProfileModal
          balance={balance}
          positions={positions}
          fills={fills}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
