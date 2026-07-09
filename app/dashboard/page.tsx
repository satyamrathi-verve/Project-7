"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Invoice, Receipt, ReceiptAllocation, Customer, ReminderLog, InvoiceStatus } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { StatCard } from "@/components/StatCard";
import { formatMoney, formatDateTime } from "@/lib/format";
import { computeCustomerRisk, type CustomerRisk } from "@/lib/customerRisk";
import type { InsightSeverity } from "@/lib/collectionHealth";

import { OutstandingTrendChart } from "@/components/dashboard/OutstandingTrendChart";
import { CollectionsChart } from "@/components/dashboard/CollectionsChart";
import { AgeingChart } from "@/components/dashboard/AgeingChart";
import { DistributionDonut } from "@/components/dashboard/DistributionDonut";
import { OutstandingOverviewCard } from "@/components/dashboard/OutstandingOverviewCard";
import { PriorityInvoicesCard, type PriorityRow, type Priority } from "@/components/dashboard/PriorityInvoicesCard";
import { RecentInvoicesCard, type RecentInvoiceRow } from "@/components/dashboard/RecentInvoicesCard";
import { CustomerRiskCard } from "@/components/dashboard/CustomerRiskCard";
import { SmartInsightsCard, type DashboardInsight } from "@/components/dashboard/SmartInsightsCard";
import { ActivityFeedCard, buildActivityEvents } from "@/components/dashboard/ActivityFeedCard";
import { AgeingSummaryCards, type AgeingSummaryItem } from "@/components/dashboard/AgeingSummaryCards";
import { CustomerHealthCard, type HealthSegment } from "@/components/dashboard/CustomerHealthCard";
import { QuickActionsFab } from "@/components/dashboard/QuickActionsFab";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Skeleton } from "@/components/dashboard/Primitives";

type InvoiceRow = Invoice & { customers: { name: string; code: string; phone: string | null } | null };

const DAY = 24 * 60 * 60 * 1000;
const today = () => new Date(new Date().toDateString());

const monthKey = (d: string) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

/** Last N calendar-month keys ending this month, oldest first, e.g. ["2025-08", ..., "2026-07"]. */
function lastNMonthKeys(n: number): string[] {
  const t = today();
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

const RANGE_OPTIONS = [
  { months: 3, label: "3M" },
  { months: 6, label: "6M" },
  { months: 12, label: "12M" },
] as const;

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [allocations, setAllocations] = useState<ReceiptAllocation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reminders, setReminders] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [rangeMonths, setRangeMonths] = useState<3 | 6 | 12>(12);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const [invRes, recRes, allocRes, custRes, remRes] = await Promise.all([
      supabase.from("invoices").select("*, customers(name, code, phone)"),
      supabase.from("receipts").select("*"),
      supabase.from("receipt_allocations").select("*"),
      supabase.from("customers").select("*"),
      supabase.from("reminder_log").select("*"),
    ]);
    const err = invRes.error || recRes.error || allocRes.error || custRes.error || remRes.error;
    if (err) setError(err.message);
    setInvoices((invRes.data as InvoiceRow[]) ?? []);
    setReceipts((recRes.data as Receipt[]) ?? []);
    setAllocations((allocRes.data as ReceiptAllocation[]) ?? []);
    setCustomers((custRes.data as Customer[]) ?? []);
    setReminders((remRes.data as ReminderLog[]) ?? []);
    setLoading(false);
    setLastUpdated(new Date());
  }

  useEffect(() => {
    load();
  }, []);

  const model = useMemo(() => {
    const t = today();
    const todayISO = t.toISOString();

    const allocationsByInvoiceId = new Map<string, ReceiptAllocation[]>();
    for (const a of allocations) {
      const list = allocationsByInvoiceId.get(a.invoice_id) ?? [];
      list.push(a);
      allocationsByInvoiceId.set(a.invoice_id, list);
    }
    const receiptsById = new Map(receipts.map((r) => [r.id, r]));

    const outstanding = (inv: Invoice) => {
      const allocs = allocationsByInvoiceId.get(inv.id) ?? [];
      const paid = allocs.reduce((s, a) => s + Number(a.amount), 0);
      return Math.max(0, Number(inv.total) - paid);
    };
    const paidOf = (inv: Invoice) => Number(inv.total) - outstanding(inv);

    const effectiveStatus = (inv: Invoice): InvoiceStatus => {
      if ((inv.status === "open" || inv.status === "partial") && new Date(inv.due_date) < t) return "overdue";
      return inv.status;
    };

    // ---- Headline aggregates ----
    const totalOutstanding = invoices.reduce((s, i) => s + outstanding(i), 0);
    const overdueInvoices = invoices.filter((i) => effectiveStatus(i) === "overdue");
    const overdueAmount = overdueInvoices.reduce((s, i) => s + outstanding(i), 0);

    const startOfMonth = new Date(t.getFullYear(), t.getMonth(), 1);
    const endOfMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    const weekAhead = new Date(t.getTime() + 7 * DAY);

    const invoicedThisMonth = invoices
      .filter((i) => new Date(i.invoice_date) >= startOfMonth)
      .reduce((s, i) => s + Number(i.total), 0);
    const collectedThisMonth = receipts
      .filter((r) => new Date(r.receipt_date) >= startOfMonth)
      .reduce((s, r) => s + Number(r.amount), 0);
    const collectedToday = receipts
      .filter((r) => new Date(new Date(r.receipt_date).toDateString()).getTime() === t.getTime())
      .reduce((s, r) => s + Number(r.amount), 0);

    const expectedThisWeek = invoices
      .filter((i) => i.status !== "paid" && new Date(i.due_date) <= weekAhead)
      .reduce((s, i) => s + outstanding(i), 0);
    const expectedThisMonth = invoices
      .filter((i) => i.status !== "paid" && new Date(i.due_date) <= endOfMonth)
      .reduce((s, i) => s + outstanding(i), 0);

    // Average Collection Period (DSO), trailing-90-day sales basis
    const ninetyAgo = new Date(t.getTime() - 90 * DAY);
    const salesTrailing90 = invoices
      .filter((i) => new Date(i.invoice_date) >= ninetyAgo)
      .reduce((s, i) => s + Number(i.total), 0);
    const dso = salesTrailing90 > 0 ? (totalOutstanding / salesTrailing90) * 90 : 0;

    const collectionEfficiency = invoicedThisMonth > 0 ? Math.min(100, (collectedThisMonth / invoicedThisMonth) * 100) : 0;

    const openInvoices = invoices.filter((i) => effectiveStatus(i) === "open" || effectiveStatus(i) === "partial");
    const openInvoicesAmount = openInvoices.reduce((s, i) => s + outstanding(i), 0);

    // Reminders sent per invoice, most recent first — used for "pending follow-up" detection.
    const lastReminderByInvoice = new Map<string, string>();
    for (const r of reminders) {
      if (!r.invoice_id) continue;
      const existing = lastReminderByInvoice.get(r.invoice_id);
      if (!existing || existing < r.sent_at) lastReminderByInvoice.set(r.invoice_id, r.sent_at);
    }
    const pendingFollowups = overdueInvoices.filter((i) => {
      const last = lastReminderByInvoice.get(i.id);
      if (!last) return true;
      return (t.getTime() - new Date(last).getTime()) / DAY >= 7;
    }).length;

    // ---- Monthly series (up to 12 months) for charts + sparklines ----
    const monthKeys = lastNMonthKeys(12);
    const invoicedByMonth = new Map<string, number>();
    const collectedByMonth = new Map<string, number>();
    for (const inv of invoices) invoicedByMonth.set(monthKey(inv.invoice_date), (invoicedByMonth.get(monthKey(inv.invoice_date)) ?? 0) + Number(inv.total));
    for (const r of receipts) collectedByMonth.set(monthKey(r.receipt_date), (collectedByMonth.get(monthKey(r.receipt_date)) ?? 0) + Number(r.amount));

    // Running outstanding at each month-end = cumulative invoiced-to-date minus cumulative collected-to-date.
    let cumInvoiced = 0;
    let cumCollected = 0;
    const outstandingTrend: { label: string; value: number }[] = [];
    const collectionsSeries: { label: string; invoiced: number; collected: number }[] = [];
    for (const k of monthKeys) {
      cumInvoiced += invoicedByMonth.get(k) ?? 0;
      cumCollected += collectedByMonth.get(k) ?? 0;
      outstandingTrend.push({ label: monthLabel(k), value: Math.max(0, cumInvoiced - cumCollected) });
      collectionsSeries.push({ label: monthLabel(k), invoiced: invoicedByMonth.get(k) ?? 0, collected: collectedByMonth.get(k) ?? 0 });
    }
    const outstandingSparkline = outstandingTrend.slice(-6).map((p) => p.value);
    const collectedSparkline = collectionsSeries.slice(-6).map((p) => p.collected);
    const invoicedSparkline = collectionsSeries.slice(-6).map((p) => p.invoiced);

    // ---- Ageing buckets ----
    const buckets = { notDue: 0, b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0 };
    const bucketCounts = { notDue: 0, b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0 };
    for (const inv of invoices) {
      const out = outstanding(inv);
      if (out <= 0 || inv.status === "paid") continue;
      const days = Math.floor((t.getTime() - new Date(inv.due_date).getTime()) / DAY);
      if (days < 0) { buckets.notDue += out; bucketCounts.notDue++; }
      else if (days <= 30) { buckets.b0_30 += out; bucketCounts.b0_30++; }
      else if (days <= 60) { buckets.b31_60 += out; bucketCounts.b31_60++; }
      else if (days <= 90) { buckets.b61_90 += out; bucketCounts.b61_90++; }
      else { buckets.b90plus += out; bucketCounts.b90plus++; }
    }

    // ---- Receivable distribution (by amount) ----
    const paidAmount = invoices.filter((i) => effectiveStatus(i) === "paid").reduce((s, i) => s + Number(i.total), 0);
    const openAmount = openInvoices.reduce((s, i) => s + outstanding(i), 0);

    // ---- Per-customer risk (for Customer Risk card + Health segments + High Risk KPI) ----
    const invoicesByCustomer = new Map<string, Invoice[]>();
    for (const inv of invoices) {
      const list = invoicesByCustomer.get(inv.customer_id) ?? [];
      list.push(inv);
      invoicesByCustomer.set(inv.customer_id, list);
    }
    const customerRisks: CustomerRisk[] = customers
      .filter((c) => (invoicesByCustomer.get(c.id) ?? []).length > 0)
      .map((c) =>
        computeCustomerRisk({
          customer: c,
          invoices: invoicesByCustomer.get(c.id) ?? [],
          allocationsByInvoiceId,
          receiptsById,
          todayISO,
        })
      );
    const topRiskCustomers = [...customerRisks].sort((a, b) => a.riskScore - b.riskScore).slice(0, 6);
    const highRiskCount = customerRisks.filter((r) => r.riskLabel === "High Risk").length;

    const healthSegments: HealthSegment[] = [
      { label: "Excellent", count: 0, outstanding: 0, colorClass: "text-success", barClass: "bg-success" },
      { label: "Good", count: 0, outstanding: 0, colorClass: "text-info", barClass: "bg-info" },
      { label: "Average", count: 0, outstanding: 0, colorClass: "text-warning", barClass: "bg-warning" },
      { label: "High Risk", count: 0, outstanding: 0, colorClass: "text-danger", barClass: "bg-danger" },
    ];
    for (const r of customerRisks) {
      const seg = healthSegments.find((s) => s.label === r.riskLabel)!;
      seg.count += 1;
      seg.outstanding += r.outstanding;
    }

    // ---- Top priority invoices (overdue, or due within 7 days) ----
    const priorityRows: PriorityRow[] = invoices
      .filter((i) => i.status !== "paid" && outstanding(i) > 0)
      .map((i) => {
        const overdueDays = Math.floor((t.getTime() - new Date(i.due_date).getTime()) / DAY);
        return { inv: i, overdueDays, out: outstanding(i) };
      })
      .filter((r) => r.overdueDays >= -7)
      .sort((a, b) => b.overdueDays - a.overdueDays)
      .slice(0, 10)
      .map(({ inv, overdueDays, out }) => {
        const priority: Priority = overdueDays >= 30 ? "Critical" : overdueDays >= 1 ? "High" : overdueDays >= -3 ? "Medium" : "Low";
        return {
          invoiceId: inv.id,
          invoiceNo: inv.invoice_no,
          customerName: inv.customers?.name ?? "Unknown customer",
          customerPhone: inv.customers?.phone ?? null,
          outstanding: out,
          dueDate: inv.due_date,
          overdueDays,
          priority,
        };
      });

    // ---- Recent invoices ----
    const recentInvoices: RecentInvoiceRow[] = [...invoices]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 10)
      .map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoice_no,
        customerName: inv.customers?.name ?? "Unknown customer",
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        total: Number(inv.total),
        paid: paidOf(inv),
        outstanding: outstanding(inv),
        effectiveStatus: effectiveStatus(inv),
      }));

    // ---- Smart insights (rule-based over the real numbers above) ----
    const insights: DashboardInsight[] = [];
    const prevMonth = collectionsSeries[collectionsSeries.length - 2];
    const thisMonthSeries = collectionsSeries[collectionsSeries.length - 1];
    if (prevMonth && prevMonth.invoiced > 0) {
      const prevOutstandingIdx = outstandingTrend.length - 2;
      const prevOutstanding = outstandingTrend[prevOutstandingIdx]?.value ?? 0;
      const curOutstanding = outstandingTrend[outstandingTrend.length - 1]?.value ?? 0;
      if (prevOutstanding > 0) {
        const pct = Math.round(((curOutstanding - prevOutstanding) / prevOutstanding) * 100);
        if (Math.abs(pct) >= 3) {
          insights.push({
            icon: pct > 0 ? "📈" : "📉",
            severity: pct > 0 ? "warning" : "success",
            title: "Outstanding Trend",
            text: `Outstanding ${pct > 0 ? "increased" : "decreased"} by ${Math.abs(pct)}% vs last month.`,
          });
        }
      }
    }
    if (prevMonth && prevMonth.collected > 0 && thisMonthSeries) {
      const pct = Math.round(((thisMonthSeries.collected - prevMonth.collected) / prevMonth.collected) * 100);
      if (Math.abs(pct) >= 5) {
        insights.push({
          icon: pct > 0 ? "💪" : "⚠️",
          severity: pct > 0 ? "success" : "warning",
          title: "Collections Trend",
          text: `Collections ${pct > 0 ? "improved" : "declined"} by ${Math.abs(pct)}% vs last month.`,
        });
      }
    }
    const dueWithin3 = invoices.filter((i) => {
      if (i.status === "paid" || outstanding(i) <= 0) return false;
      const days = Math.floor((new Date(i.due_date).getTime() - t.getTime()) / DAY);
      return days >= 0 && days <= 3;
    }).length;
    if (dueWithin3 > 0) {
      insights.push({
        icon: "🗓️",
        severity: "info",
        title: "Due Soon",
        text: `${dueWithin3} invoice${dueWithin3 === 1 ? "" : "s"} become${dueWithin3 === 1 ? "s" : ""} due within 3 days.`,
      });
    }
    const worstCredit = [...customerRisks].sort((a, b) => b.creditUtilizationPct - a.creditUtilizationPct)[0];
    if (worstCredit && worstCredit.creditUtilizationPct >= 90) {
      insights.push({
        icon: "💳",
        severity: "danger",
        title: "Credit Limit Alert",
        text: `${worstCredit.customer.name} has crossed ${Math.round(worstCredit.creditUtilizationPct)}% of their credit limit.`,
      });
    }
    if (totalOutstanding > 0) {
      const top5 = [...customerRisks].sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);
      const top5Sum = top5.reduce((s, r) => s + r.outstanding, 0);
      const pct = Math.round((top5Sum / totalOutstanding) * 100);
      if (pct >= 40) {
        insights.push({
          icon: "🎯",
          severity: "info",
          title: "Concentration Risk",
          text: `Top 5 customers account for ${pct}% of total receivables.`,
        });
      }
    }
    const efficiencyTarget = 85;
    insights.push({
      icon: collectionEfficiency >= efficiencyTarget ? "🟢" : "🟠",
      severity: collectionEfficiency >= efficiencyTarget ? "success" : "warning",
      title: "Collection Efficiency",
      text: `Collection efficiency is ${Math.round(collectionEfficiency)}%, ${
        collectionEfficiency >= efficiencyTarget ? "above" : "below"
      } the ${efficiencyTarget}% benchmark.`,
    });
    if (expectedThisWeek > 0) {
      insights.push({
        icon: "💰",
        severity: "info",
        title: "Cash Inflow Forecast",
        text: `Expected cash inflow in the next 7 days: ${formatMoney(expectedThisWeek)}.`,
      });
    }

    // ---- Activity feed ----
    const customersById = new Map(customers.map((c) => [c.id, c]));
    const activityEvents = buildActivityEvents({
      receipts: receipts.map((r) => ({
        receipt_date: r.receipt_date,
        amount: Number(r.amount),
        mode: r.mode,
        customerName: customersById.get(r.customer_id)?.name ?? "Unknown customer",
      })),
      reminders: reminders.map((r) => ({ sent_at: r.sent_at, subject: r.subject, to_email: r.to_email, status: r.status })),
      limit: 8,
    });

    // ---- Welcome summary ----
    const attentionCount = priorityRows.filter((r) => r.priority === "Critical" || r.priority === "High" || r.overdueDays === 0).length;

    return {
      totalOutstanding,
      overdueAmount,
      overdueCount: overdueInvoices.length,
      collectedThisMonth,
      collectedToday,
      expectedThisWeek,
      expectedThisMonth,
      invoicedThisMonth,
      dso,
      collectionEfficiency,
      openInvoicesCount: openInvoices.length,
      openInvoicesAmount,
      highRiskCount,
      pendingFollowups,
      outstandingTrend,
      collectionsSeries,
      outstandingSparkline,
      collectedSparkline,
      invoicedSparkline,
      buckets,
      bucketCounts,
      paidAmount,
      openAmount,
      topRiskCustomers,
      healthSegments,
      priorityRows,
      recentInvoices,
      insights,
      activityEvents,
      attentionCount,
      activeCustomers: customerRisks.length,
      totalInvoices: invoices.length,
    };
  }, [invoices, receipts, allocations, customers, reminders]);

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
      <div className="mx-auto max-w-[1400px] space-y-8">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();

  const rangeSlice = <T,>(arr: T[]) => arr.slice(-rangeMonths);

  return (
    <div className="mx-auto max-w-[1400px] pb-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[40px] font-bold leading-tight tracking-tight text-ink">Finance Intelligence Dashboard</h1>
          {lastUpdated && (
            <p className="mt-1.5 text-[13px] text-ink-muted">Last updated {formatDateTime(lastUpdated.toISOString())}</p>
          )}
        </div>
        <button
          onClick={load}
          aria-label="Refresh dashboard data"
          className="rounded-lg border border-hairline bg-surface px-3.5 py-2 text-sm font-medium text-ink-secondary transition-all duration-150 hover:-translate-y-0.5 hover:border-brand/20 hover:bg-ink/[0.03] hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {/* Welcome */}
      <div className="mb-8 rounded-xl border border-hairline bg-gradient-to-br from-brand-light/60 to-surface p-5 shadow-card">
        <h2 className="text-[22px] font-semibold text-ink">{greeting} 👋</h2>
        <p className="mt-1.5 text-[15px] text-ink-secondary">
          You have <span className="font-semibold text-ink">{formatMoney(model.totalOutstanding)}</span> outstanding across{" "}
          <span className="font-semibold text-ink">{model.openInvoicesCount + model.overdueCount}</span> invoices.{" "}
          {model.attentionCount > 0 ? (
            <span className="font-semibold text-danger">{model.attentionCount} invoice{model.attentionCount === 1 ? "" : "s"} need attention today.</span>
          ) : (
            <span className="font-semibold text-success">Nothing urgent needs attention today.</span>
          )}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon="💰"
          label="Total Outstanding"
          value={formatMoney(model.totalOutstanding)}
          accent="blue"
          sparkline={model.outstandingSparkline}
          insight={`${model.openInvoicesCount + model.overdueCount} invoices`}
        />
        <StatCard
          icon="⚠️"
          label="Overdue Amount"
          value={formatMoney(model.overdueAmount)}
          accent="red"
          insight={`${model.overdueCount} invoices`}
        />
        <StatCard
          icon="💵"
          label="Collected This Month"
          value={formatMoney(model.collectedThisMonth)}
          accent="green"
          sparkline={model.collectedSparkline}
          insight={`vs ${formatMoney(model.invoicedThisMonth)} invoiced`}
        />
        <StatCard
          icon="🎯"
          label="Collection Efficiency"
          value={`${Math.round(model.collectionEfficiency)}%`}
          accent={model.collectionEfficiency >= 85 ? "green" : "orange"}
          insight="Collected ÷ invoiced, month to date"
        />
        <StatCard
          icon="⏱️"
          label="Avg. Collection Period"
          value={`${model.dso.toFixed(0)} days`}
          accent="purple"
          insight="Trailing 90-day sales basis"
        />
        <StatCard
          icon="📂"
          label="Open Invoices"
          value={String(model.openInvoicesCount)}
          accent="blue"
          insight={formatMoney(model.openInvoicesAmount)}
        />
        <StatCard
          icon="🚩"
          label="High Risk Customers"
          value={String(model.highRiskCount)}
          accent="red"
          insight={`of ${model.activeCustomers} active`}
        />
        <StatCard
          icon="📨"
          label="Pending Follow-ups"
          value={String(model.pendingFollowups)}
          accent="orange"
          insight="Overdue, no reminder in 7 days"
        />
      </div>

      {/* Analytics */}
      <div className="mb-4 mt-10 flex items-center justify-between">
        <h2 className="text-[22px] font-semibold text-ink">Analytics</h2>
        <div className="flex gap-1 rounded-lg border border-hairline bg-section p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.months}
              onClick={() => setRangeMonths(opt.months)}
              aria-pressed={rangeMonths === opt.months}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
                rangeMonths === opt.months ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardCard title="Outstanding Trend" subtitle="Running receivable balance, month-end">
          <OutstandingTrendChart points={rangeSlice(model.outstandingTrend)} />
        </DashboardCard>
        <DashboardCard title="Collections vs Invoiced" subtitle="Real amounts raised vs collected, per month">
          <CollectionsChart points={rangeSlice(model.collectionsSeries)} />
        </DashboardCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <DashboardCard title="Invoice Ageing" subtitle="Outstanding value by days overdue">
          <AgeingChart
            buckets={[
              { label: "Not due", value: model.buckets.notDue, colorClass: "bg-info" },
              { label: "0–30 days", value: model.buckets.b0_30, colorClass: "bg-warning/50" },
              { label: "31–60 days", value: model.buckets.b31_60, colorClass: "bg-warning" },
              { label: "61–90 days", value: model.buckets.b61_90, colorClass: "bg-danger/60" },
              { label: "90+ days", value: model.buckets.b90plus, colorClass: "bg-danger" },
            ]}
          />
        </DashboardCard>
        <DashboardCard title="Receivable Distribution" subtitle="By invoice value">
          <DistributionDonut
            centerLabel={`₹${(model.paidAmount + model.openAmount + model.overdueAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            segments={[
              { label: "Paid", value: model.paidAmount, color: "rgb(var(--color-success))", colorClass: "bg-success" },
              { label: "Open", value: model.openAmount, color: "rgb(var(--color-info))", colorClass: "bg-info" },
              { label: "Overdue", value: model.overdueAmount, color: "rgb(var(--color-danger))", colorClass: "bg-danger" },
            ]}
          />
        </DashboardCard>
      </div>

      {/* Ageing summary tiles */}
      <div className="mt-6">
        <AgeingSummaryCards
          items={[
            { label: "Not Due", count: model.bucketCounts.notDue, amount: model.buckets.notDue, colorClass: "bg-info" },
            { label: "0–30 Days", count: model.bucketCounts.b0_30, amount: model.buckets.b0_30, colorClass: "bg-warning/50" },
            { label: "31–60 Days", count: model.bucketCounts.b31_60, amount: model.buckets.b31_60, colorClass: "bg-warning" },
            { label: "61–90 Days", count: model.bucketCounts.b61_90, amount: model.buckets.b61_90, colorClass: "bg-danger/60" },
            { label: "90+ Days", count: model.bucketCounts.b90plus, amount: model.buckets.b90plus, colorClass: "bg-danger" },
          ]}
        />
      </div>

      {/* Main grid: left (primary) + right (secondary) */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        <div className="space-y-6">
          <OutstandingOverviewCard
            outstanding={model.totalOutstanding}
            collectedToday={model.collectedToday}
            expectedThisWeek={model.expectedThisWeek}
            expectedThisMonth={model.expectedThisMonth}
            collectedMTD={model.collectedThisMonth}
            invoicedMTD={model.invoicedThisMonth}
          />
          <PriorityInvoicesCard rows={model.priorityRows} />
          <RecentInvoicesCard rows={model.recentInvoices} />
        </div>

        <div className="space-y-6">
          <CustomerRiskCard rows={model.topRiskCustomers} />
          <SmartInsightsCard insights={model.insights} />
          <ActivityFeedCard events={model.activityEvents} />
        </div>
      </div>

      {/* Customer health */}
      <div className="mt-6">
        <CustomerHealthCard segments={model.healthSegments} />
      </div>

      <QuickActionsFab />
    </div>
  );
}
