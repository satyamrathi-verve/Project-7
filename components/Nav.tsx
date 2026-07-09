"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./Logo";
import { useTheme } from "@/lib/theme";

const LINKS: { href: string; label: string; icon: string; built: boolean }[] = [
  { href: "/masters/customers", label: "Customer Master", icon: "🧑‍💼", built: true },
  { href: "/masters/gl", label: "GL Master", icon: "📚", built: true },
  { href: "/invoices", label: "Sales Invoices", icon: "🧾", built: true },
  { href: "/receipts", label: "Receipt Entry", icon: "💰", built: true },
  { href: "/upload", label: "Upload Report", icon: "📤", built: true },
  { href: "/reminders/template", label: "Reminder Template", icon: "✉️", built: true },
  { href: "/reminders/send", label: "Auto Email Shoot", icon: "📨", built: true },
  { href: "/reports/statement", label: "Customer Statement", icon: "📄", built: true },
  { href: "/reports/ageing", label: "AR Ageing", icon: "⏳", built: true },
  { href: "/cashflow", label: "Cashflow Projection", icon: "📈", built: true },
  { href: "/dashboard", label: "Dashboard", icon: "📊", built: true },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  function handleSignOut() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");
    router.push("/signin");
  }

  return (
    <nav className="flex h-full w-60 flex-none flex-col gap-0.5 border-r border-hairline bg-surface p-4 print:hidden">
      <div className="mb-4 flex items-center justify-between px-2 py-2">
        <Logo variant="dark" size="sm" className="items-start" />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-base text-ink-muted transition-all duration-150 hover:bg-section hover:text-ink active:scale-90"
        >
          <span className="animate-pop-in" key={theme}>{theme === "dark" ? "🌙" : "☀️"}</span>
        </button>
      </div>
      <div className="h-px bg-hairline mb-2"></div>
      {LINKS.map((l) => {
        const active = pathname === l.href;
        if (!l.built) {
          return (
            <span
              key={l.href}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-muted"
            >
              <span className="flex items-center gap-2">
                <span className="text-base opacity-60">{l.icon}</span>
                {l.label}
              </span>
              <span className="rounded bg-section px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                build me
              </span>
            </span>
          );
        }
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-brand text-white shadow-sm" : "text-ink-secondary hover:bg-section hover:text-ink"
            }`}
          >
            <span className="text-base">{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
      <div className="mt-auto pt-2">
        <div className="h-px bg-hairline mb-2" />
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-section hover:text-ink"
        >
          <span className="text-base">🚪</span>
          Sign out
        </button>
      </div>
    </nav>
  );
}
