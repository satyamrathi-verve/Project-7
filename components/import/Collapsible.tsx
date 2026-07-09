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
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-section"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-ink">{title}</span>
            {subtitle && <span className="block truncate text-xs text-ink-muted">{subtitle}</span>}
          </span>
          {badge}
        </span>
        <span className={`flex-none text-ink-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>
      {open && <div className="border-t border-hairline p-5">{children}</div>}
    </div>
  );
}
