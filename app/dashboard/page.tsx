"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Invoice, Receipt, ReceiptAllocation, Customer } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";

type InvoiceRow = Invoice & { customers: { name: string; code: string } | null };

const DAY = 24 * 60 * 60 * 1000;
const today = () => new Date(new Date().toDateString());

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const monthKey = (d: string) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

/** Not available: no AP/vendor, GST, TDS, GL-posting, or bank-feed tables in the backend. */
const NOT_AVAILABLE = [
  "AP Ageing",
  "GST Summary",
  "TDS Summary",
  "Trial Balance Health",
  "Bank Reconciliation Status",
  "Compliance Calendar",
  "Tax Payment Reminders",
  "DPO",
];

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [allocations, setAllocations] = useState<ReceiptAllocation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      setLoading(true);
      const [invRes, recRes, allocRes, custRes] = await Promise.all([
        supabase.from("invoices").select("*, customers(name, code)"),
        supabase.from("receipts").select("*"),
        supabase.from("receipt_allocations").select("*"),
        supabase.from("customers").select("*"),
      ]);
      const err = invRes.error || recRes.error || allocRes.error || custRes.error;
      if (err) setError(err.message);
      setInvoices((invRes.data as InvoiceRow[]) ?? []);
      setReceipts((recRes.data as Receipt[]) ?? []);
      setAllocations((allocRes.data as ReceiptAllocation[]) ?? []);
      setCustomers((custRes.data as Customer[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const model = useMemo(() => {
    const allocatedByInvoice = new Map<string, number>();
    for (const a of allocations) {
      allocatedByInvoice.set(a.invoice_id, (allocatedByInvoice.get(a.invoice_id) ?? 0) + Number(a.amount));
    }
    const outstanding = (inv: Invoice) =>
      Math.max(0, Number(inv.total) - (allocatedByInvoice.get(inv.id) ?? 0));

    const t = today();
    const isOverdue = (inv: Invoice) =>
      (inv.status === "open" || inv.status === "partial") && new Date(inv.due_date) < t;

    const totalOutstanding = invoices.reduce((s, i) => s + outstanding(i), 0);
    const overdueAmount = invoices.filter(isOverdue).reduce((s, i) => s + outstanding(i), 0);
    const overdueCount = invoices.filter(isOverdue).length;

    const startOfMonth = new Date(t.getFullYear(), t.getMonth(), 1);
    const invoicedThisMonth = invoices
      .filter((i) => new Date(i.invoice_date) >= startOfMonth)
      .reduce((s, i) => s + Number(i.total), 0);
    const collectedThisMonth = receipts
      .filter((r) => new Date(r.receipt_date) >= startOfMonth)
      .reduce((s, r) => s + Number(r.amount), 0);

    // DSO: trailing 90-day sales basis
    const ninetyAgo = new Date(t.getTime() - 90 * DAY);
    const salesTrailing90 = invoices
      .filter((i) => new Date(i.invoice_date) >= ninetyAgo)
      .reduce((s, i) => s + Number(i.total), 0);
    const dso = salesTrailing90 > 0 ? (totalOutstanding / salesTrailing90) * 90 : 0;

    const collectionEfficiency =
      invoicedThisMonth > 0 ? Math.min(100, (collectedThisMonth / invoicedThisMonth) * 100) : 0;

    // AR ageing buckets
    const buckets = { notDue: 0, b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0 };
    for (const inv of invoices) {
      const out = outstanding(inv);
      if (out <= 0 || inv.status === "paid") continue;
      const days = Math.floor((t.getTime() - new Date(inv.due_date).getTime()) / DAY);
      if (days < 0) buckets.notDue += out;
      else if (days <= 30) buckets.b0_30 += out;
      else if (days <= 60) buckets.b31_60 += out;
      else if (days <= 90) buckets.b61_90 += out;
      else buckets.b90plus += out;
    }

    // Revenue trend: last 6 months, by invoice_date
    const revByMonth = new Map<string, number>();
    for (const inv of invoices) {
      const k = monthKey(inv.invoice_date);
      revByMonth.set(k, (revByMonth.get(k) ?? 0) + Number(inv.total));
    }
    const revenueTrend = [...revByMonth.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-6);

    // Cash flow projection: expected inflow from open/partial invoices, grouped by due month
    const cashByMonth = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status === "paid") continue;
      const out = outstanding(inv);
      if (out <= 0) continue;
      const k = monthKey(inv.due_date);
      cashByMonth.set(k, (cashByMonth.get(k) ?? 0) + out);
    }
    const cashFlow = [...cashByMonth.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(0, 6);

    // Due date tracker: open/partial invoices due within next 30 days, soonest first
    const in30 = new Date(t.getTime() + 30 * DAY);
    const dueTracker = invoices
      .filter((i) => i.status !== "paid" && new Date(i.due_date) <= in30)
      .map((i) => ({ inv: i, out: outstanding(i), days: Math.floor((new Date(i.due_date).getTime() - t.getTime()) / DAY) }))
      .sort((a, b) => a.days - b.days)
      .slice(0, 8);

    // Top outstanding invoices
    const topOutstanding = invoices
      .filter((i) => outstanding(i) > 0)
      .map((i) => ({ inv: i, out: outstanding(i) }))
      .sort((a, b) => b.out - a.out)
      .slice(0, 6);

    return {
      totalOutstanding,
      overdueAmount,
      overdueCount,
      invoicedThisMonth,
      collectedThisMonth,
      dso,
      collectionEfficiency,
      buckets,
      revenueTrend,
      cashFlow,
      dueTracker,
      topOutstanding,
      activeCustomers: customers.length,
      totalInvoices: invoices.length,
    };
  }, [invoices, receipts, allocations, customers]);

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Finance intelligence overview." />
        <NotConfigured />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Finance intelligence overview." />
        <p className="text-sm text-ink-muted">Loading financial data…</p>
      </>
    );
  }

  const bucketTotal =
    model.buckets.notDue + model.buckets.b0_30 + model.buckets.b31_60 + model.buckets.b61_90 + model.buckets.b90plus;
  const maxCash = Math.max(1, ...model.cashFlow.map(([, v]) => v));
  const maxRev = Math.max(1, ...model.revenueTrend.map(([, v]) => v));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Finance Intelligence Dashboard"
        subtitle="A live snapshot of receivables, cash health, and collection performance."
      />

      {error && (
        <p className="mb-4 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {/* KPI row — neutral cards; accent reserved for the one figure that needs attention */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Total Outstanding" value={inr(model.totalOutstanding)} />
        <Kpi label="Overdue" value={inr(model.overdueAmount)} sub={`${model.overdueCount} invoices`} accent />
        <Kpi label="Invoiced (MTD)" value={inr(model.invoicedThisMonth)} />
        <Kpi label="Collected (MTD)" value={inr(model.collectedThisMonth)} />
        <Kpi label="DSO" value={`${model.dso.toFixed(0)} days`} sub="Days Sales Outstanding" />
        <Kpi label="Collection Efficiency" value={`${model.collectionEfficiency.toFixed(0)}%`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Cash flow projection */}
        <Panel title="Cash Flow Projection" subtitle="Expected inflow from open invoices, by due month" className="lg:col-span-2">
          {model.cashFlow.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex h-40 items-end gap-4">
              {model.cashFlow.map(([k, v]) => (
                <div key={k} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-medium text-ink-secondary">{inr(v)}</span>
                  <div
                    className="w-full rounded-t-md bg-brand transition-all duration-300"
                    style={{ height: `${Math.max(6, (v / maxCash) * 100)}px` }}
                  />
                  <span className="text-xs text-ink-muted">{monthLabel(k)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Working capital indicators */}
        <Panel title="Working Capital Indicators" subtitle="Derived from receivables only">
          <div className="space-y-4">
            <Metric label="Days Sales Outstanding (DSO)" value={`${model.dso.toFixed(1)} days`} />
            <Metric label="Collection Efficiency (MTD)" value={`${model.collectionEfficiency.toFixed(0)}%`} />
            <Metric label="Outstanding / Active Customer" value={inr(model.activeCustomers ? model.totalOutstanding / model.activeCustomers : 0)} />
            <p className="pt-2 text-xs text-ink-muted">
              DPO and full working-capital (current assets vs. liabilities) need payables and GL
              posting data not yet in the backend — see below.
            </p>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* AR Ageing */}
        <Panel title="AR Ageing" subtitle="Outstanding by days overdue" className="lg:col-span-2">
          {bucketTotal === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-3">
              {[
                { label: "Not due", value: model.buckets.notDue, color: "bg-info" },
                { label: "0–30 days", value: model.buckets.b0_30, color: "bg-warning/50" },
                { label: "31–60 days", value: model.buckets.b31_60, color: "bg-warning" },
                { label: "61–90 days", value: model.buckets.b61_90, color: "bg-danger/60" },
                { label: "90+ days", value: model.buckets.b90plus, color: "bg-danger" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="w-24 flex-none text-xs font-medium text-ink-muted">{b.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/[0.04]">
                    <div
                      className={`h-full transition-all duration-300 ${b.color}`}
                      style={{ width: `${bucketTotal ? (b.value / bucketTotal) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-28 flex-none text-right text-xs font-semibold tabular-nums text-ink-secondary">
                    {inr(b.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Revenue trend */}
        <Panel title="Revenue Trend" subtitle="Invoiced, last 6 months">
          {model.revenueTrend.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex h-32 items-end gap-2">
              {model.revenueTrend.map(([k, v]) => (
                <div key={k} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-ink/70 transition-all duration-300"
                    style={{ height: `${Math.max(4, (v / maxRev) * 90)}px` }}
                  />
                  <span className="text-[10px] text-ink-muted">{monthLabel(k)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Due date tracker */}
        <Panel title="Due Date Tracker" subtitle="Open invoices due within 30 days">
          {model.dueTracker.length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-y divide-hairline">
              {model.dueTracker.map(({ inv, out, days }) => (
                <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink">{inv.invoice_no}</p>
                    <p className="text-xs text-ink-muted">{inv.customers?.name ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-ink">{inr(out)}</p>
                    <p className={`text-xs ${days < 0 ? "text-danger" : "text-ink-muted"}`}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `Due in ${days}d`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Outstanding invoices */}
        <Panel title="Largest Outstanding Invoices" subtitle="Top exposure, current">
          {model.topOutstanding.length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-y divide-hairline">
              {model.topOutstanding.map(({ inv, out }) => (
                <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink">{inv.invoice_no}</p>
                    <p className="text-xs text-ink-muted">{inv.customers?.name ?? "—"}</p>
                  </div>
                  <p className="font-semibold tabular-nums text-ink">{inr(out)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Not available */}
      <Panel
        title="Awaiting Data"
        subtitle="These modules need tables this backend doesn't have yet (AP/vendor, GST, TDS, GL postings, bank feed) — nothing is faked here"
        className="mt-6"
      >
        <div className="flex flex-wrap gap-2">
          {NOT_AVAILABLE.map((label) => (
            <span
              key={label}
              className="rounded-full border border-hairline bg-section px-3 py-1 text-xs font-medium text-ink-muted"
            >
              {label}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums tracking-tight ${accent ? "text-danger" : "text-ink"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-hairline bg-surface p-5 shadow-card ${className}`}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-ink-muted">No data yet.</p>;
}
