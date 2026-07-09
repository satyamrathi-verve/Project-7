"use client";

import { useState } from "react";
import Link from "next/link";

const ACTIONS = [
  { href: "/invoices", icon: "🧾", label: "Create Invoice" },
  { href: "/receipts", icon: "💵", label: "Record Payment" },
  { href: "/reminders/send", icon: "📨", label: "Send Reminder" },
  { href: "/reports/ageing", icon: "📤", label: "Export Report" },
  { href: "/masters/customers", icon: "👤", label: "Add Customer" },
];

/** Floating speed-dial — every action points at a real, already-built screen. */
export function QuickActionsFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 print:hidden">
      {open && <button aria-hidden tabIndex={-1} className="fixed inset-0 cursor-default" onClick={() => setOpen(false)} />}

      <div role="menu" className="flex flex-col items-end gap-2.5">
        {ACTIONS.map((a, i) => (
          <Link
            key={a.href}
            href={a.href}
            role="menuitem"
            tabIndex={open ? 0 : -1}
            aria-hidden={!open}
            onClick={() => setOpen(false)}
            style={{ transitionDelay: open ? `${i * 35}ms` : "0ms" }}
            className={`group flex items-center gap-3 transition-all duration-200 ease-premium ${
              open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            }`}
          >
            <span className="rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[13px] font-medium text-ink-secondary opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100">
              {a.label}
            </span>
            <span
              aria-label={a.label}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-hairline bg-surface text-lg shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card-hover"
            >
              {a.icon}
            </span>
          </Link>
        ))}
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        aria-expanded={open}
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-white shadow-card-hover transition-all duration-[220ms] ease-premium hover:-translate-y-0.5 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 ${
          open ? "rotate-45" : ""
        }`}
      >
        +
      </button>
    </div>
  );
}
