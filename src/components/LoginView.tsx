import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { CurrentUser } from '../types';

interface LoginViewProps {
  onLoginSuccess: (token: string, isDemoMode: boolean, user: CurrentUser) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [coolDownSeconds, setCoolDownSeconds] = useState(0);
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);

  const getDisplayMessage = (data: any) => {
    if (data?.code === 'AUTH_SETUP_REQUIRED') {
      return 'Login system abhi Supabase ke saath complete connect nahi hua. `admins` table ki access allow karni hogi ya service role key add karni hogi.';
    }

    return data?.message || 'Wrong credentials.';
  };

  useEffect(() => {
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => {
        setDbConfigured(Boolean(data?.isSupabaseConfigured));
      })
      .catch(() => {
        setDbConfigured(false);
      });
  }, []);

  useEffect(() => {
    if (coolDownSeconds <= 0) return;

    const interval = setInterval(() => {
      setCoolDownSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [coolDownSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (coolDownSeconds > 0) return;

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (response.status === 429) {
        setCoolDownSeconds(data.waitTime || 30);
        setErrorMessage(data.message || 'Please wait before trying again.');
      } else if (!response.ok || !data.success) {
        setErrorMessage(getDisplayMessage(data));
      } else {
        onLoginSuccess(data.token, data.isDemoMode || false, data.user || { email: email.trim(), role: 'owner-admin' });
      }
    } catch (err) {
      console.error('Login request failed:', err);
      setErrorMessage('Server connection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="mb-6 text-center">
          <h1 className="font-['Georgia'] text-[1.9rem] italic tracking-tight text-slate-900">ZavariHaus</h1>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.34em] text-slate-400">Hotel Management</p>
          <p className="mt-2 text-sm text-slate-500">Login to continue</p>
        </div>

        {errorMessage && (
          <div
            className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
            id="login-error-banner"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {coolDownSeconds > 0 && (
          <div
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700"
            id="brute-force-banner"
          >
            Try again in {coolDownSeconds}s.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-form-email" className="mb-1 block text-sm text-slate-600">
              Email
            </label>
            <input
              id="admin-form-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || coolDownSeconds > 0}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="Enter email"
              required
            />
          </div>

          <div>
            <label htmlFor="admin-form-password" className="mb-1 block text-sm text-slate-600">
              Password
            </label>
            <input
              id="admin-form-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || coolDownSeconds > 0}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || coolDownSeconds > 0}
            className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? 'Checking...' : 'Login'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          {dbConfigured ? 'Supabase connected' : 'Supabase not configured'}
        </p>
      </div>
    </div>
  );
}
