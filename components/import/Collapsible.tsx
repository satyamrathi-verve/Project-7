"use client";

import { useState, type ReactNode } from "react";

/** Reusable expand/collapse section — used anywhere the wizard has optional-to-scan detail. */
export function Collapsible({
  title,
  subtitle,
  defaultOpen = true,
  badge,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-900">{title}</span>
            {subtitle && <span className="block truncate text-xs text-slate-500">{subtitle}</span>}
          </span>
          {badge}
        </span>
        <span className={`flex-none text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>
      {open && <div className="border-t border-slate-100 p-5">{children}</div>}
    </div>
  );
}
