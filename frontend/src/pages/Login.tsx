import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const { data } = await api.login({ username: username.trim(), password });
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Connection failed. Please verify the backend is running.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-12 text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 text-lg font-black shadow-glow">SP</span>
          <span className="text-xl font-extrabold tracking-tight">StockPilot</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            Know exactly what you have.{' '}
            <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">Always.</span>
          </h2>
          <p className="mt-4 text-slate-400">Inventory and order management built on transaction-safe stock control.</p>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            {[
              'Real-time stock valuation and low-stock alerts',
              'Row-locked stock transactions: no overselling',
              'Role-based access for admins and staff',
              'Complete audit trail of every change',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 grid place-items-center h-5 w-5 shrink-0 rounded-full bg-indigo-500/20 text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">&copy; StockPilot</p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md animate-fade-up">
          <div className="lg:hidden text-center mb-8">
            <span className="inline-grid place-items-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-2xl shadow-glow">SP</span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">StockPilot Portal</h2>
            <p className="mt-1 text-sm text-slate-500">Inventory &amp; Orders</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-500">Sign in to the StockPilot portal to continue.</p>
          </div>

          <div className="card p-8 shadow-lg">
            {error && (
              <div data-testid="login-error" role="alert" className="mb-6 p-4 rounded-xl bg-rose-50 ring-1 ring-inset ring-rose-200 text-rose-800 text-sm flex items-start gap-3">
                <span className="grid place-items-center h-5 w-5 shrink-0 rounded-full bg-rose-100 text-xs font-bold text-rose-600">!</span>
                <div>
                  <p className="font-semibold">Authentication Error</p>
                  <p className="text-xs mt-0.5 text-rose-700">{error}</p>
                </div>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="username" className="label">Username or Email</label>
                <input
                  id="username"
                  name="username"
                  data-testid="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or staff"
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    data-testid="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="input pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 px-4 text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} data-testid="login-submit" className="btn-primary w-full py-3">
                {isSubmitting ? 'Authenticating...' : 'Sign In to StockPilot'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
