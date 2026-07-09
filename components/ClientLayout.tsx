'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Nav } from './Nav';
import { getCurrentUser } from '@/lib/auth';

/*
  Routes that must stay reachable without a login:
    /signin   — the login gate itself
    /pay/...  — the public invoice payment link customers open from an email
  Everything else requires the front-end demo session (localStorage). If it's
  missing, we bounce to /signin so the deployed app always opens behind login.
*/
const PUBLIC_PREFIXES = ['/signin', '/pay'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isPublic) return;
    if (!getCurrentUser()) {
      router.replace('/signin');
    } else {
      setReady(true);
    }
  }, [pathname, isPublic, router]);

  // Public pages render bare — no internal sidebar for signed-out visitors.
  if (isPublic) {
    return <>{children}</>;
  }

  // Brief guard while we confirm the session (and redirect if there isn't one).
  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen print:block">
      <div className="print:hidden">
        <Nav />
      </div>
      <main className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible">{children}</main>
    </div>
  );
}
