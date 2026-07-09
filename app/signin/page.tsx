'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

const DEMO_USERS = [
  { username: 'admin', password: 'admin123', name: 'Admin User' },
  { username: 'demo', password: 'demo123', name: 'Demo User' },
  { username: 'user', password: 'user123', name: 'Test User' },
];

export default function SignInPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

      await new Promise((resolve) => setTimeout(resolve, 1500));
      router.push('/');
    } else {
      setError('Invalid username or password');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#3B5998] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <Logo variant="light" size="lg" />

          <div className="relative mt-4">
            <div className="w-12 h-12 border-4 border-white/20 rounded-full"></div>
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="text-white/80 text-lg font-medium">
            Signing you in...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#3B5998] flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12">
        <div className="max-w-md text-center">
          <Logo variant="light" size="xl" className="mb-8" />
          <div className="h-px w-24 bg-surface/30 mx-auto mb-8"></div>
          <p className="text-white/70 text-lg leading-relaxed">
            Streamline your accounts receivable management with our powerful, intuitive platform.
          </p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8">
            <Logo variant="light" size="lg" />
          </div>

          {/* Login Card */}
          <div className="bg-surface rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-ink">Welcome back</h2>
              <p className="text-ink-muted mt-1">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-ink-secondary mb-2">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3.5 bg-section border border-hairline rounded-xl focus:ring-2 focus:ring-[#3B5998] focus:border-[#3B5998] outline-none transition-all text-ink placeholder:text-ink-muted"
                  placeholder="Enter your username"
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-ink-secondary mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-section border border-hairline rounded-xl focus:ring-2 focus:ring-[#3B5998] focus:border-[#3B5998] outline-none transition-all text-ink placeholder:text-ink-muted"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-danger-bg text-danger px-4 py-3 rounded-xl text-sm border border-danger-border">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#3B5998] hover:bg-[#2d4373] text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-[#3B5998]/25 hover:shadow-xl hover:shadow-[#3B5998]/30 hover:-translate-y-0.5"
              >
                Sign In
              </button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-8 pt-6 border-t border-hairline/50">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
                Demo Credentials
              </p>
              <div className="space-y-2">
                {DEMO_USERS.map((user) => (
                  <button
                    key={user.username}
                    type="button"
                    onClick={() => {
                      setUsername(user.username);
                      setPassword(user.password);
                      setError('');
                    }}
                    className="w-full flex items-center justify-between text-sm bg-section hover:bg-section px-4 py-2.5 rounded-lg transition-colors group"
                  >
                    <span className="text-ink-secondary font-medium">{user.name}</span>
                    <code className="text-[#3B5998] font-mono text-xs bg-surface px-2 py-1 rounded border border-hairline group-hover:border-[#3B5998]/30">
                      {user.username} / {user.password}
                    </code>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-white/50 text-sm mt-6">
            AR Manager - Accounts Receivable System
          </p>
        </div>
      </div>
    </div>
  );
}
