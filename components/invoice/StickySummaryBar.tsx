"use client";

import { useEffect, useState } from "react";
import type { Invoice } from "@/lib/types";
import { STATUS_ACCENT_TEXT } from "@/lib/statusStyles";
import { StatusBadge } from "./StatusBadge";

/*
  Floating summary bar that appears once the hero header (with its own
  Outstanding hero + actions) has scrolled out of view, so the two key numbers
  and actions stay reachable on long invoices. Watches an IntersectionObserver
  on the header's sentinel element rather than a raw scroll-position check.
*/
export function StickySummaryBar({
  sentinelId,
  invoice,
  outstanding,
  onRecordPayment,
  onSendReminder,
}: {
  sentinelId: string;
  invoice: Invoice;
  outstanding: number;
  onRecordPayment: () => void;
  onSendReminder: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById(sentinelId);
    if (!sentinel) return;

    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelId]);

  return (
    <div
      role="region"
      aria-label="Invoice summary"
      aria-hidden={!visible}
      className={`fixed inset-x-0 top-0 z-30 flex justify-center px-4 transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      }`}
    >
      <div className="mt-3 flex w-full max-w-5xl flex-wrap items-center gap-3 rounded-xl border border-hairline bg-surface/95 px-4 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08),0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur">
        <span className="text-sm font-semibold text-ink">{invoice.invoice_no}</span>
        <StatusBadge status={invoice.status} />
        <span className="text-sm text-ink-muted">Outstanding</span>
        <span className={`text-base font-bold tabular-nums ${STATUS_ACCENT_TEXT[invoice.status]}`}>
          {`₹${outstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onSendReminder}
            className="rounded-[10px] border border-brand/30 bg-brand/5 px-3 py-1.5 text-sm font-semibold text-brand transition-all duration-200 hover:bg-brand/10"
          >
            Send Reminder
          </button>
          <button
            onClick={onRecordPayment}
            className="rounded-[10px] bg-brand px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-dark"
          >
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}
