"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";

const MAIN_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/invoices", label: "Invoices", icon: "🧾" },
  { href: "/receipts", label: "Receipts", icon: "💰" },
  { href: "/masters/customers", label: "Customers", icon: "🧑‍💼" },
];

const MORE_LINKS = [
  { href: "/masters/gl", label: "GL Master", icon: "📚" },
  { href: "/upload", label: "Upload Report", icon: "📤" },
  { href: "/reminders/template", label: "Reminder Template", icon: "✉️" },
  { href: "/reminders/send", label: "Auto Email Shoot", icon: "📨" },
  { href: "/reports/statement", label: "Customer Statement", icon: "📄" },
  { href: "/reports/ageing", label: "AR Ageing", icon: "⏳" },
  { href: "/cashflow", label: "Cashflow Projection", icon: "📈" },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const isMoreActive = MORE_LINKS.some(
    (l) => pathname === l.href || pathname.startsWith(l.href + "/")
  );

  function handleSignOut() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");
    router.push("/signin");
    setShowMenu(false);
  }

  return (
    <>
      {/* Slide-out menu overlay */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Slide-out menu panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-72 transform bg-surface shadow-xl transition-transform duration-300 ${
          showMenu ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-hairline p-4">
            <Logo variant="dark" size="sm" />
            <button
              onClick={() => setShowMenu(false)}
              className="rounded-lg p-2 text-ink-muted hover:bg-section hover:text-ink"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
              More Options
            </p>
            <div className="flex flex-col gap-1">
              {MORE_LINKS.map((l) => {
                const active = pathname === l.href || pathname.startsWith(l.href + "/");
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setShowMenu(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand text-white"
                        : "text-ink-secondary hover:bg-section hover:text-ink"
                    }`}
                  >
                    <span className="text-lg">{l.icon}</span>
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="border-t border-hairline p-4">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-section hover:text-ink"
            >
              <span className="text-lg">🚪</span>
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-hairline bg-surface/95 backdrop-blur-sm safe-area-pb">
        <div className="flex items-center justify-around px-2 py-1">
          {MAIN_LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center transition-colors ${
                  active ? "text-brand" : "text-ink-muted hover:text-ink"
                }`}
              >
                <span className="text-xl">{l.icon}</span>
                <span className="truncate text-[10px] font-medium">{l.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMenu(true)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center transition-colors ${
              isMoreActive ? "text-brand" : "text-ink-muted hover:text-ink"
            }`}
          >
            <span className="text-xl">☰</span>
            <span className="truncate text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
