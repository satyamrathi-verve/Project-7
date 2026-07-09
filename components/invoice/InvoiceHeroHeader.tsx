"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Customer, Invoice } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { STATUS_ACCENT_TEXT } from "@/lib/statusStyles";
import { StatusBadge } from "./StatusBadge";
import { Icon } from "./Primitives";

export function InvoiceHeroHeader({
  invoice,
  customer,
  outstanding,
  isOverdue,
  dueInDays,
  onRecordPayment,
  onSendReminder,
  sentinelId,
}: {
  invoice: Invoice;
  customer: Customer;
  outstanding: number;
  isOverdue: boolean;
  dueInDays: number;
  onRecordPayment: () => void;
  onSendReminder: () => void;
  /** id placed on an invisible marker at the foot of the header — the page observes it to trigger the sticky summary bar. */
  sentinelId?: string;
}) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const dueNote =
    outstanding === 0
      ? "Fully settled"
      : isOverdue
        ? `${Math.abs(dueInDays)} day${Math.abs(dueInDays) === 1 ? "" : "s"} overdue`
        : `Due in ${dueInDays} day${dueInDays === 1 ? "" : "s"}`;

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50/50 via-white to-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_30px_rgba(0,0,0,0.05)] sm:p-8">
      {/* Soft radial glow behind the invoice title — subtle, not distracting */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-brand/[0.08] blur-3xl"
      />

      <button
        onClick={() => router.push("/invoices")}
        className="relative z-10 mb-5 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-slate-800"
      >
        <span aria-hidden>←</span>
        Back to invoices
      </button>

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: identity + meta */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-900">{invoice.invoice_no}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="mt-1.5 text-[15px] text-slate-500">
            Billed to <span className="font-medium text-slate-700">{customer.name}</span>
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-4">
            <MetaField icon="📅" label="Invoice Date" value={formatDate(invoice.invoice_date)} />
            <MetaField icon="📅" label="Due Date" value={formatDate(invoice.due_date)} />
            <MetaField icon="⏱️" label="Payment Terms" value={`${customer.credit_days} days`} />
            <MetaField icon="🧑‍💼" label="Sales Executive" value="Not tracked" muted />
          </dl>
        </div>

        {/* Right: hero outstanding metric — slightly elevated above the header surface */}
        <div className="flex-none rounded-xl border border-slate-100 bg-white px-6 py-5 text-left shadow-[0_2px_8px_rgba(15,23,42,0.06),0_10px_24px_rgba(15,23,42,0.04)] lg:text-right">
          <p className="text-[12px] font-medium uppercase tracking-wide text-slate-400">Outstanding</p>
          <p className={`mt-1 text-[40px] font-bold leading-none tabular-nums ${STATUS_ACCENT_TEXT[invoice.status]}`}>
            {`₹${outstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          </p>
          <p className={`mt-2 text-sm font-medium ${isOverdue ? "text-red-600" : "text-slate-500"}`}>{dueNote}</p>
        </div>
      </div>

      {/* Premium divider */}
      <div className="relative z-10 mt-7 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Action bar */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 pt-5">
        <button
          onClick={onRecordPayment}
          className="rounded-[10px] bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-md active:translate-y-0"
        >
          <Icon className="mr-1">💰</Icon>
          Record Payment
        </button>
        <button
          onClick={onSendReminder}
          className="rounded-[10px] border border-brand/30 bg-brand/5 px-4 py-2 text-sm font-semibold text-brand transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand/10 active:translate-y-0"
        >
          <Icon className="mr-1">📨</Icon>
          Send Reminder
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/invoices/${invoice.id}/print`}
            target="_blank"
            className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
            title="Opens the printable A4 view — use your browser's Print → Save as PDF"
          >
            <Icon className="mr-1">⬇️</Icon>
            Download PDF
          </Link>

          <div className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-label="More actions"
              className="rounded-[10px] border border-slate-200 bg-white p-2 text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              ⋯
            </button>

            {moreOpen && (
              <>
                <button
                  aria-hidden
                  tabIndex={-1}
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setMoreOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <Link
                    href={`/invoices/${invoice.id}/print`}
                    target="_blank"
                    role="menuitem"
                    className="block px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    🖨️ Print
                  </Link>
                  <Link
                    href={`/invoices/${invoice.id}/edit`}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className="block px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    ✏️ Edit Invoice
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {sentinelId && <div id={sentinelId} aria-hidden className="absolute bottom-0 h-px w-px" />}
    </div>
  );
}

function MetaField({ icon, label, value, muted = false }: { icon: string; label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[12px] uppercase tracking-wide text-slate-400">
        <Icon>{icon}</Icon>
        {label}
      </dt>
      <dd className={`mt-1 text-[15px] font-semibold ${muted ? "text-slate-400" : "text-slate-800"}`}>{value}</dd>
    </div>
  );
}
