"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/*
  The sidebar now uses every route as a real navigation item.
  Each entry points to a screen route so the app feels fully connected.
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
    <nav className="flex h-full w-60 flex-col gap-1 border-r border-slate-200 bg-white p-4 print:hidden">
      <div className="mb-4 px-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">Verve</p>
        <h1 className="text-lg font-bold text-slate-900">AR Manager</h1>
      </div>
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
