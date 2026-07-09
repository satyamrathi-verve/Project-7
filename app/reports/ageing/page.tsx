"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Customer, Invoice, Receipt, ReceiptAllocation } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { inputClass } from "@/components/FormField";
import { StatCard } from "@/components/StatCard";

type Bucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";
const BUCKET_LABELS: Record<Bucket, string> = {
  current: "Current",
  d1_30: "1–30 Days",
  d31_60: "31–60 Days",
  d61_90: "61–90 Days",
  d90_plus: "90+ Days",
};
const BUCKET_COLORS: Record<Bucket, string> = {
  current: "bg-success",
  d1_30: "bg-lime-400",
  d31_60: "bg-warning",
  d61_90: "bg-warning",
  d90_plus: "bg-danger",
};
const BUCKET_ORDER: Bucket[] = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"];

type OpenInvoice = { invoice: Invoice; outstanding: number; daysOverdue: number; bucket: Bucket };

type CustomerAgeing = {
  customer: Customer;
  openInvoices: OpenInvoice[];
  buckets: Record<Bucket, number>;
  outstanding: number;
  maxDaysOverdue: number;
  oldestDueDate: string | null;
  lastPaymentDate: string | null;
  priority: "Critical" | "High" | "Medium" | "Low";
};

function daysOverdue(dueDate: string): number {
  return Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
}

function bucketFor(days: number): Bucket {
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90_plus";
}

const QUICK_FILTERS = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Only Overdue" },
  { key: "over_limit", label: "Credit Limit Exceeded" },
  { key: "no_payment_90", label: "No Payment in 90 Days" },
  { key: "above_5l", label: "Above ₹5L" },
  { key: "above_10l", label: "Above ₹10L" },
] as const;
type QuickFilterKey = (typeof QUICK_FILTERS)[number]["key"];

export default function AgeingReportPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allocations, setAllocations] = useState<ReceiptAllocation[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("all");
  const [bucketFilter, setBucketFilter] = useState<"all" | Bucket>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadAll() {
    if (!supabase) return;
    setLoading(true);
    const [{ data: customerData }, { data: invoiceData }, { data: allocationData }, { data: receiptData }] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("invoices").select("*").in("status", ["open", "partial", "overdue"]),
      supabase.from("receipt_allocations").select("*"),
      supabase.from("receipts").select("*").order("receipt_date", { ascending: false }),
    ]);
    setCustomers((customerData as Customer[]) ?? []);
    setInvoices((invoiceData as Invoice[]) ?? []);
    setAllocations((allocationData as ReceiptAllocation[]) ?? []);
    setReceipts((receiptData as Receipt[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const ageing: CustomerAgeing[] = useMemo(() => {
    const allocatedByInvoice = new Map<string, number>();
    allocations.forEach((a) => allocatedByInvoice.set(a.invoice_id, (allocatedByInvoice.get(a.invoice_id) ?? 0) + Number(a.amount)));

    const invoicesByCustomer = new Map<string, Invoice[]>();
    invoices.forEach((inv) => {
      const list = invoicesByCustomer.get(inv.customer_id) ?? [];
      list.push(inv);
      invoicesByCustomer.set(inv.customer_id, list);
    });

    const lastPaymentByCustomer = new Map<string, string>();
    receipts.forEach((r) => {
      const existing = lastPaymentByCustomer.get(r.customer_id);
      if (!existing || r.receipt_date > existing) lastPaymentByCustomer.set(r.customer_id, r.receipt_date);
    });

    const rows: CustomerAgeing[] = [];
    customers.forEach((customer) => {
      const custInvoices = invoicesByCustomer.get(customer.id) ?? [];
      const openInvoices: OpenInvoice[] = custInvoices
        .map((invoice) => {
          const outstanding = Number(invoice.total) - (allocatedByInvoice.get(invoice.id) ?? 0);
          const days = daysOverdue(invoice.due_date);
          return { invoice, outstanding, daysOverdue: days, bucket: bucketFor(days) };
        })
        .filter((r) => r.outstanding > 0.01)
        .sort((a, b) => a.invoice.due_date.localeCompare(b.invoice.due_date));

      if (openInvoices.length === 0) return;

      const buckets: Record<Bucket, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
      openInvoices.forEach((r) => (buckets[r.bucket] += r.outstanding));
      const outstanding = openInvoices.reduce((s, r) => s + r.outstanding, 0);
      const maxDaysOverdue = Math.max(...openInvoices.map((r) => r.daysOverdue));
      const utilisation = customer.credit_limit > 0 ? outstanding / customer.credit_limit : 0;

      const priority: CustomerAgeing["priority"] =
        buckets.d90_plus > 0 || utilisation > 1
          ? "Critical"
          : buckets.d61_90 > 0 || utilisation > 0.8
          ? "High"
          : buckets.d31_60 > 0
          ? "Medium"
          : "Low";

      rows.push({
        customer,
        openInvoices,
        buckets,
        outstanding,
        maxDaysOverdue,
        oldestDueDate: openInvoices[0]?.invoice.due_date ?? null,
        lastPaymentDate: lastPaymentByCustomer.get(customer.id) ?? null,
        priority,
      });
    });

    return rows.sort((a, b) => b.outstanding - a.outstanding);
  }, [customers, invoices, allocations, receipts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ageing.filter((row) => {
      if (q && !row.customer.name.toLowerCase().includes(q) && !row.customer.code.toLowerCase().includes(q)) return false;
      if (bucketFilter !== "all" && row.buckets[bucketFilter] <= 0) return false;

      switch (quickFilter) {
        case "overdue":
          return row.maxDaysOverdue > 0;
        case "over_limit":
          return row.customer.credit_limit > 0 && row.outstanding > row.customer.credit_limit;
        case "no_payment_90": {
          const daysSincePay = row.lastPaymentDate ? daysOverdue(row.lastPaymentDate) : Infinity;
          return daysSincePay > 90;
        }
        case "above_5l":
          return row.outstanding > 500000;
        case "above_10l":
          return row.outstanding > 1000000;
        default:
          return true;
      }
    });
  }, [ageing, search, quickFilter, bucketFilter]);

  // ---- KPI totals (over the full ageing set, not the filtered view) ----
  const totals = useMemo(() => {
    const t: Record<Bucket, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
    ageing.forEach((row) => BUCKET_ORDER.forEach((b) => (t[b] += row.buckets[b])));
    const totalOutstanding = BUCKET_ORDER.reduce((s, b) => s + t[b], 0);
    const overdueCustomers = ageing.filter((r) => r.maxDaysOverdue > 0).length;
    const overdueInvoices = ageing.flatMap((r) => r.openInvoices).filter((r) => r.daysOverdue > 0);
    const overdueOutstanding = overdueInvoices.reduce((s, r) => s + r.outstanding, 0);
    const avgDaysOverdue =
      overdueOutstanding > 0
        ? overdueInvoices.reduce((s, r) => s + r.daysOverdue * r.outstanding, 0) / overdueOutstanding
        : 0;
    return { buckets: t, totalOutstanding, overdueCustomers, avgDaysOverdue };
  }, [ageing]);

  // ---- Filtered live summary (sticky bar) ----
  const liveSummary = useMemo(() => {
    const outstanding = filtered.reduce((s, r) => s + r.outstanding, 0);
    const current = filtered.reduce((s, r) => s + r.buckets.current, 0);
    const overdue = outstanding - current;
    const overdueCount = filtered.filter((r) => r.maxDaysOverdue > 0).length;
    return { customers: filtered.length, outstanding, current, overdue, overdueCount };
  }, [filtered]);

  // ---- Insights (rule-based, computed from real data) ----
  const insights = useMemo(() => {
    const list: string[] = [];
    const worstByDays = [...ageing].sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue)[0];
    if (worstByDays && worstByDays.maxDaysOverdue > 0) {
      list.push(
        `${worstByDays.customer.name} has the oldest overdue balance — ${formatMoney(worstByDays.outstanding)} outstanding, ${worstByDays.maxDaysOverdue} days overdue.`
      );
    }
    const largest = ageing[0];
    if (largest) list.push(`${largest.customer.name} carries the largest outstanding balance at ${formatMoney(largest.outstanding)}.`);
    const noPayment90 = ageing.filter((r) => (r.lastPaymentDate ? daysOverdue(r.lastPaymentDate) : Infinity) > 90);
    if (noPayment90.length > 0) list.push(`${noPayment90.length} customer(s) haven't paid anything in over 90 days.`);
    const overLimit = ageing.filter((r) => r.customer.credit_limit > 0 && r.outstanding > r.customer.credit_limit);
    if (overLimit.length > 0) list.push(`${overLimit.length} customer(s) are currently over their credit limit.`);
    if (totals.buckets.current > 0) list.push(`${formatMoney(totals.buckets.current)} is not yet due — expected to come in on schedule.`);
    if (totals.buckets.d90_plus > 0)
      list.push(`${formatMoney(totals.buckets.d90_plus)} is 90+ days overdue and at high risk of becoming bad debt.`);
    return list;
  }, [ageing, totals]);

  const topDefaulters = ageing.slice(0, 10);
  const followUpList = ageing.filter((r) => r.priority === "Critical" || r.priority === "High").slice(0, 6);
  const recentPayments = receipts.slice(0, 6);
  const todaysCollection = receipts
    .filter((r) => r.receipt_date === new Date().toISOString().slice(0, 10))
    .reduce((s, r) => s + Number(r.amount), 0);

  function exportCsv() {
    const header = ["Code", "Customer", "Credit Limit", "Outstanding", ...BUCKET_ORDER.map((b) => BUCKET_LABELS[b]), "Days Overdue", "Priority"];
    const rows = filtered.map((r) => [
      r.customer.code,
      r.customer.name,
      String(r.customer.credit_limit),
      String(r.outstanding),
      ...BUCKET_ORDER.map((b) => String(r.buckets[b])),
      String(Math.max(0, r.maxDaysOverdue)),
      r.priority,
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ar-ageing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxBucketTotal = Math.max(...BUCKET_ORDER.map((b) => totals.buckets[b]), 1);
  const maxDefaulterOutstanding = Math.max(...topDefaulters.map((r) => r.outstanding), 1);

  const PRIORITY_BADGE: Record<CustomerAgeing["priority"], string> = {
    Critical: "bg-danger-bg text-danger",
    High: "bg-warning-bg text-warning",
    Medium: "bg-warning-bg text-warning",
    Low: "bg-success-bg text-success",
  };

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="AR Ageing Report" subtitle="Outstanding receivables by customer, bucketed by days overdue." />
        <NotConfigured />
      </>
    );
  }

  return (
    <div className="pb-24">
      <p className="mb-1 text-xs font-medium text-ink-muted print:hidden">
        Dashboard <span className="mx-1">/</span> Accounts Receivable <span className="mx-1">/</span>{" "}
        <span className="text-ink-secondary">AR Ageing Report</span>
      </p>
      <div className="print:hidden">
        <PageHeader
          title="AR Ageing Report"
          subtitle="Every customer's outstanding balance, bucketed by how overdue it is."
          action={
            <div className="flex gap-2">
              <button onClick={loadAll} className="rounded-lg border border-ink-muted/40 bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-section">
                Refresh
              </button>
              <button onClick={exportCsv} className="rounded-lg border border-ink-muted/40 bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-section">
                Export CSV
              </button>
              <button onClick={() => window.print()} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                Print
              </button>
            </div>
          }
        />
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading ageing report…</p>
      ) : (
        <>
          {/* KPI row */}
          <div className="mb-6 grid grid-cols-2 gap-4 print:hidden lg:grid-cols-4">
            <StatCard icon="💰" label="Total Outstanding" value={formatMoney(totals.totalOutstanding)} accent="blue" />
            <StatCard icon="🟢" label="Current (Not Due)" value={formatMoney(totals.buckets.current)} accent="green" />
            <StatCard icon="🟡" label="1–30 Days" value={formatMoney(totals.buckets.d1_30)} accent="green" />
            <StatCard icon="🟠" label="31–60 Days" value={formatMoney(totals.buckets.d31_60)} accent="orange" />
            <StatCard icon="🔶" label="61–90 Days" value={formatMoney(totals.buckets.d61_90)} accent="orange" />
            <StatCard icon="🔴" label="90+ Days" value={formatMoney(totals.buckets.d90_plus)} accent="red" />
            <StatCard icon="👥" label="Overdue Customers" value={String(totals.overdueCustomers)} accent="purple" />
            <StatCard icon="📅" label="Avg Days Overdue" value={`${Math.round(totals.avgDaysOverdue)} days`} accent="purple" />
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="mb-6 rounded-2xl border border-hairline bg-surface p-5 shadow-sm print:hidden">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">Insights</h3>
              <ul className="space-y-1.5">
                {insights.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-secondary">
                    <span className="text-brand">•</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
            {/* LEFT: filters + grid + charts */}
            <div className="space-y-6 lg:col-span-7">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <input
                  className={`${inputClass} w-56`}
                  placeholder="Search customer or code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select className={inputClass} value={bucketFilter} onChange={(e) => setBucketFilter(e.target.value as "all" | Bucket)}>
                  <option value="all">All buckets</option>
                  {BUCKET_ORDER.map((b) => (
                    <option key={b} value={b}>
                      {BUCKET_LABELS[b]}
                    </option>
                  ))}
                </select>
                {QUICK_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setQuickFilter(f.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      quickFilter === f.key ? "bg-brand text-white" : "border border-ink-muted/40 text-ink-secondary hover:bg-section"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Main grid */}
              <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface shadow-sm">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 bg-section">
                    <tr className="border-b border-hairline text-left">
                      <th className="px-4 py-3 font-semibold text-ink-secondary"></th>
                      <th className="px-4 py-3 font-semibold text-ink-secondary">Customer</th>
                      <th className="px-4 py-3 text-right font-semibold text-ink-secondary">Outstanding</th>
                      {BUCKET_ORDER.map((b) => (
                        <th key={b} className="px-3 py-3 text-right font-semibold text-ink-secondary">
                          {BUCKET_LABELS[b]}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-right font-semibold text-ink-secondary">Days Overdue</th>
                      <th className="px-3 py-3 font-semibold text-ink-secondary">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-ink-muted">
                          No customers match these filters.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row) => {
                        const utilisation = row.customer.credit_limit > 0 ? row.outstanding / row.customer.credit_limit : 0;
                        const expanded = expandedId === row.customer.id;
                        return (
                          <Fragment key={row.customer.id}>
                            <tr
                              onClick={() => setExpandedId(expanded ? null : row.customer.id)}
                              className="cursor-pointer border-b border-hairline/50 hover:bg-section"
                            >
                              <td className="px-4 py-3 text-ink-muted">{expanded ? "▾" : "▸"}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                                    {row.customer.name.slice(0, 1).toUpperCase()}
                                  </span>
                                  <div>
                                    <p className="font-medium text-ink">{row.customer.name}</p>
                                    <p className="text-xs text-ink-muted">
                                      {row.customer.code} · {Math.round(utilisation * 100)}% of limit
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-ink">{formatMoney(row.outstanding)}</td>
                              {BUCKET_ORDER.map((b) => (
                                <td key={b} className="px-3 py-3 text-right text-ink-secondary">
                                  {row.buckets[b] > 0 ? formatMoney(row.buckets[b]) : "—"}
                                </td>
                              ))}
                              <td className="px-3 py-3 text-right text-ink-secondary">{Math.max(0, row.maxDaysOverdue)}</td>
                              <td className="px-3 py-3">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[row.priority]}`}>
                                  {row.priority}
                                </span>
                              </td>
                            </tr>
                            {expanded && (
                              <tr className="border-b border-hairline/50 bg-section/60">
                                <td colSpan={9} className="px-6 py-4">
                                  <div className="mb-2 flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Open Invoices</p>
                                    <Link href={`/reports/statement?customer=${row.customer.id}`} className="text-xs font-medium text-brand hover:underline">
                                      View Full Statement →
                                    </Link>
                                  </div>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-ink-muted">
                                        <th className="py-1 pr-3">Invoice</th>
                                        <th className="py-1 pr-3">Invoice Date</th>
                                        <th className="py-1 pr-3">Due Date</th>
                                        <th className="py-1 pr-3 text-right">Outstanding</th>
                                        <th className="py-1">Bucket</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.openInvoices.map((oi) => (
                                        <tr key={oi.invoice.id} className="border-t border-hairline">
                                          <td className="py-1.5 pr-3 font-medium text-ink-secondary">{oi.invoice.invoice_no}</td>
                                          <td className="py-1.5 pr-3 text-ink-secondary">{formatDate(oi.invoice.invoice_date)}</td>
                                          <td className="py-1.5 pr-3 text-ink-secondary">{formatDate(oi.invoice.due_date)}</td>
                                          <td className="py-1.5 pr-3 text-right text-ink-secondary">{formatMoney(oi.outstanding)}</td>
                                          <td className="py-1.5">
                                            <span className={`inline-block h-2 w-2 rounded-full ${BUCKET_COLORS[oi.bucket]}`} />{" "}
                                            <span className="text-ink-muted">{BUCKET_LABELS[oi.bucket]}</span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 gap-6 print:hidden sm:grid-cols-2">
                <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-ink-muted">Outstanding by Age Bucket</h3>
                  <div className="space-y-3">
                    {BUCKET_ORDER.map((b) => (
                      <div key={b}>
                        <div className="mb-1 flex justify-between text-xs text-ink-muted">
                          <span>{BUCKET_LABELS[b]}</span>
                          <span>{formatMoney(totals.buckets[b])}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-sidebar">
                          <div
                            className={`h-2 rounded-full ${BUCKET_COLORS[b]}`}
                            style={{ width: `${(totals.buckets[b] / maxBucketTotal) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-ink-muted">Top 10 Defaulters</h3>
                  <div className="space-y-2.5">
                    {topDefaulters.map((r) => (
                      <div key={r.customer.id}>
                        <div className="mb-1 flex justify-between text-xs text-ink-muted">
                          <span className="truncate">{r.customer.name}</span>
                          <span>{formatMoney(r.outstanding)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-sidebar">
                          <div className="h-2 rounded-full bg-brand" style={{ width: `${(r.outstanding / maxDefaulterOutstanding) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT sidebar */}
            <div className="space-y-6 print:hidden lg:col-span-3">
              <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">Today's Collection</h3>
                <p className="text-2xl font-bold text-ink">{formatMoney(todaysCollection)}</p>
                <p className="mt-1 text-xs text-ink-muted">{receipts.filter((r) => r.receipt_date === new Date().toISOString().slice(0, 10)).length} receipt(s) recorded today</p>
              </div>

              <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">Needs Follow-up</h3>
                {followUpList.length === 0 ? (
                  <p className="text-sm text-ink-muted">Nobody critical right now.</p>
                ) : (
                  <ul className="space-y-2">
                    {followUpList.map((r) => (
                      <li key={r.customer.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-ink-secondary">{r.customer.name}</p>
                          <p className="text-xs text-ink-muted">{Math.max(0, r.maxDaysOverdue)} days overdue</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[r.priority]}`}>{r.priority}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">Recent Payments</h3>
                {recentPayments.length === 0 ? (
                  <p className="text-sm text-ink-muted">No receipts yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentPayments.map((r) => (
                      <li key={r.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-ink-secondary">{customers.find((c) => c.id === r.customer_id)?.name ?? "—"}</p>
                          <p className="text-xs text-ink-muted">{formatDate(r.receipt_date)}</p>
                        </div>
                        <span className="font-semibold text-ink">{formatMoney(Number(r.amount))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Sticky live summary bar */}
      <div className="fixed bottom-0 left-60 right-0 border-t border-hairline bg-surface/95 px-8 py-4 backdrop-blur print:hidden">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-ink-muted">Customers </span>
            <span className="font-semibold text-ink">{liveSummary.customers}</span>
          </div>
          <div>
            <span className="text-ink-muted">Outstanding </span>
            <span className="font-semibold text-ink">{formatMoney(liveSummary.outstanding)}</span>
          </div>
          <div>
            <span className="text-ink-muted">Current </span>
            <span className="font-semibold text-ink">{formatMoney(liveSummary.current)}</span>
          </div>
          <div>
            <span className="text-ink-muted">Overdue </span>
            <span className="font-semibold text-danger">{formatMoney(liveSummary.overdue)}</span>
          </div>
          <div>
            <span className="text-ink-muted">Overdue Customers </span>
            <span className="font-semibold text-ink">{liveSummary.overdueCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
