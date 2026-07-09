"use client";

import { useState } from "react";
import Link from "next/link";

const ACTIONS = [
  { href: "/invoices", icon: "🧾", label: "Create Invoice" },
  { href: "/receipts", icon: "💵", label: "Record Payment" },
  { href: "/upload", icon: "📤", label: "Import Invoices" },
  { href: "/reminders/send", icon: "📨", label: "Send Bulk Reminder" },
  { href: "/reports/statement", icon: "📄", label: "Customer Statement" },
  { href: "/reports/ageing", icon: "📈", label: "AR Ageing Report" },
];

/** Floating quick-actions button — every link points at a real, already-built screen. */
export function QuickActionsFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 print:hidden">
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 cursor-default" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute bottom-16 right-0 w-56 overflow-hidden rounded-xl border border-hairline bg-surface py-1.5 shadow-card-hover"
          >
            {ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-secondary transition-colors duration-150 hover:bg-black/[0.04] hover:text-ink"
              >
                <span aria-hidden>{a.icon}</span>
                {a.label}
              </Link>
            ))}
          </div>
        </>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Quick actions"
        aria-expanded={open}
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-white shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-dark ${
          open ? "rotate-45" : ""
        }`}
      >
        +
      </button>
    </div>
  );
}
