'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DEMO_USERS = [
  { username: 'admin', password: 'admin123', name: 'Admin User' },
  { username: 'demo', password: 'demo123', name: 'Demo User' },
  { username: 'user', password: 'user123', name: 'Test User' },
];

const BRAND_GRADIENT =
  'linear-gradient(150deg, rgb(var(--color-brand-dark)) 0%, rgb(var(--color-brand)) 52%, rgb(var(--color-brand-light)) 100%)';

/* ------------------------------------------------------------------ icons */
type IconProps = { className?: string };
const IconUser = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" /></svg>
);
const IconLock = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
);
const IconEye = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
);
const IconEyeOff = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" /></svg>
);
const IconCheck = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M20 6L9 17l-5-5" /></svg>
);
const IconAlert = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
);
const IconShield = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" /></svg>
);
const IconArrow = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
const IconTrending = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" /></svg>
);
const IconMail = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></svg>
);
const IconLayers = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" /></svg>
);

const FEATURES = [
  { icon: <IconTrending className="h-4 w-4" />, title: 'Live AR ageing & cashflow', body: 'See what you are owed and when it lands — bucketed and forecast.' },
  { icon: <IconMail className="h-4 w-4" />, title: 'Automated collection reminders', body: 'Chase every overdue customer from one screen, on a schedule.' },
  { icon: <IconLayers className="h-4 w-4" />, title: 'Statements & ledger, in sync', body: 'Customer statements, receipts and GL that always reconcile.' },
];

export default function SignInPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();

    const user = DEMO_USERS.find(
      (u) => u.username.toLowerCase() === trimmedUsername && u.password === trimmedPassword
    );

    if (user) {
      setIsLoading(true);
      localStorage.setItem('user', JSON.stringify({ username: user.username, name: user.name }));
      localStorage.setItem('isLoggedIn', 'true');

      await new Promise((resolve) => setTimeout(resolve, 1200));
      router.push('/dashboard');
    } else {
      setError('Invalid username or password. Try a demo login below.');
    }
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* ------------------------------------------------ left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16" style={{ background: BRAND_GRADIENT }}>
        {/* soft light + dot grid texture */}
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(600px circle at 100% 0%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(700px circle at -10% 100%, rgba(255,255,255,0.10), transparent 50%)' }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative flex items-center gap-3">
          <span className="text-3xl font-black tracking-tight">verve</span>
          <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-xs font-medium text-white/80">Advisory</span>
        </div>

        <div className="relative max-w-lg">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Accounts Receivable Platform
          </div>
          <h1 className="text-[40px] font-bold leading-[1.1] tracking-tight xl:text-5xl">
            Get paid faster,<br />with less chasing.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            Verve brings your receivables, reminders and cashflow into one clean workspace — so your team always knows who owes what, and when it will land.
          </p>

          <div className="mt-9 space-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white/12 text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-[13px] leading-snug text-white/65">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-3 text-xs text-white/55">
          <IconShield className="h-4 w-4" />
          Bank-grade security · SOC 2-aligned controls · © {new Date().getFullYear()} Verve Advisory
        </div>
      </div>

      {/* ------------------------------------------------ right form panel */}
      <div className="flex w-full items-center justify-center px-6 py-10 lg:w-1/2">
        <div className="w-full max-w-[400px] animate-fade-in-up">
          {/* mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="text-2xl font-black tracking-tight text-brand">verve</span>
            <span className="rounded-full border border-hairline px-2 py-0.5 text-xs font-medium text-ink-muted">Advisory</span>
          </div>

          <div className="mb-8">
            <h2 className="text-[26px] font-bold tracking-tight text-ink">Sign in to your workspace</h2>
            <p className="mt-1.5 text-sm text-ink-secondary">Welcome back. Enter your credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-ink-secondary">Username</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"><IconUser className="h-[18px] w-[18px]" /></span>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-hairline bg-surface py-3 pl-11 pr-4 text-sm text-ink outline-none transition-all duration-150 placeholder:text-ink-muted focus:border-brand focus:ring-4 focus:ring-brand/15"
                  placeholder="you@company.com"
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-ink-secondary">Password</label>
                <span className="text-xs text-ink-muted">Contact admin for access</span>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"><IconLock className="h-[18px] w-[18px]" /></span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-hairline bg-surface py-3 pl-11 pr-11 text-sm text-ink outline-none transition-all duration-150 placeholder:text-ink-muted focus:border-brand focus:ring-4 focus:ring-brand/15"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-ink/[0.04] hover:text-ink-secondary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <IconEyeOff className="h-[18px] w-[18px]" /> : <IconEye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer select-none items-center gap-2 pt-0.5 text-sm text-ink-secondary">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-hairline text-brand focus:ring-brand/30" />
              Keep me signed in
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-danger-border bg-danger-bg px-3.5 py-3 text-sm text-danger animate-fade-in">
                <IconAlert className="h-[18px] w-[18px] flex-none" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all duration-200 hover:bg-brand-dark hover:shadow-xl hover:shadow-brand/30 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Signing you in…
                </>
              ) : (
                <>
                  Sign in
                  <IconArrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* demo access */}
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-hairline" />
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Demo access</span>
              <span className="h-px flex-1 bg-hairline" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_USERS.map((user) => (
                <button
                  key={user.username}
                  type="button"
                  onClick={() => { setUsername(user.username); setPassword(user.password); setError(''); }}
                  className="rounded-xl border border-hairline bg-surface px-3 py-2.5 text-center transition-all duration-150 hover:border-brand/40 hover:bg-brand-light/10 hover:-translate-y-0.5"
                >
                  <span className="block text-sm font-semibold text-ink">{user.username}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-ink-muted">{user.password}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-ink-muted">Tap a card to autofill, then press Sign in.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
