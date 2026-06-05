import { useState } from 'react';
import { api } from '../lib/api';

export default function AuthModal({ onAuth }: { onAuth: () => void }) {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn = tab === 'signin' ? api.signin : api.signup;
      const res = await fn(username, password);
      localStorage.setItem('token', res.token);
      onAuth();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-xl p-6 w-80 border border-dark-600 shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-yellow-500 mb-1">PerpEx</h1>
          <p className="text-xs text-gray-500">Perpetual Futures Exchange</p>
        </div>

        <div className="flex mb-4 bg-dark-700 rounded-lg overflow-hidden text-sm">
          <button
            onClick={() => setTab('signin')}
            className={`flex-1 py-2 transition-colors ${tab === 'signin' ? 'bg-dark-500 text-white' : 'text-gray-500'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setTab('signup')}
            className={`flex-1 py-2 transition-colors ${tab === 'signup' ? 'bg-dark-500 text-white' : 'text-gray-500'}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors"
          />
          {error && <div className="text-red-500 text-xs bg-red-500/10 rounded px-2 py-1">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="py-2.5 bg-yellow-500 text-dark-900 rounded-lg font-semibold text-sm hover:bg-yellow-400 transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
