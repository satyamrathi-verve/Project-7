'use client';

import { usePathname } from 'next/navigation';
import { Nav } from './Nav';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSignIn = pathname === '/signin';

  if (isSignIn) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <Nav />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
