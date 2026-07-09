"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/*
  Every route on the roadmap is a real navigation item now that the team has
  built through it. Anything still unbuilt would show a "build me" tag below.
*/
const LINKS: { href: string; label: string; built: boolean }[] = [
  { href: "/", label: "Home", built: true },
  { href: "/signin", label: "Sign In", built: true },
  { href: "/masters/customers", label: "Customer Master", built: true },
  { href: "/masters/gl", label: "GL Master", built: true },
  { href: "/invoices", label: "Sales Invoices", built: true },
  { href: "/receipts", label: "Receipt Entry", built: true },
  { href: "/upload", label: "Upload Report", built: true },
  { href: "/reminders/template", label: "Reminder Template", built: true },
  { href: "/reminders/send", label: "Auto Email Shoot", built: true },
  { href: "/reports/statement", label: "Customer Statement", built: true },
  { href: "/reports/ageing", label: "AR Ageing", built: true },
  { href: "/cashflow", label: "Cashflow Projection", built: true },
  { href: "/dashboard", label: "Dashboard", built: true },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-60 flex-none flex-col gap-0.5 border-r border-hairline bg-sidebar p-4 print:hidden">
      <div className="mb-5 px-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Verve</p>
        <h1 className="text-lg font-semibold tracking-tight text-ink">AR Manager</h1>
      </div>
      {LINKS.map((l) => {
        const active = pathname === l.href;
        if (!l.built) {
          return (
            <span
              key={l.href}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-muted"
            >
              {l.label}
              <span className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                build me
              </span>
            </span>
          );
        }
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              active ? "bg-brand text-white shadow-sm" : "text-ink-secondary hover:bg-black/[0.04]"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
