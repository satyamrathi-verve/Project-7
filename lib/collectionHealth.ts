import type { Customer, Invoice, Receipt, ReceiptAllocation, ReminderLog } from "@/lib/types";
import { daysBetween } from "@/lib/format";

/*
  All figures here are computed from real rows already in the database
  (invoices, receipt_allocations, receipts) — nothing is fabricated. This is a
  simple rule-based scorer, not a model; the weights are intentionally plain
  so a non-technical teammate can read and adjust them.
*/

export interface AllocationWithReceipt extends ReceiptAllocation {
  receipts: Pick<Receipt, "receipt_date" | "mode"> | null;
}

export interface CollectionAnalytics {
  outstanding: number;
  amountPaid: number;
  percentPaid: number;
  isOverdue: boolean;
  dueInDays: number; // negative = days overdue
  outstandingAcrossAll: number;
  availableCredit: number;
  totalPaidAcrossAll: number;
  avgPaymentDelayDays: number | null;
  lateInvoiceCount: number;
  consideredInvoiceCount: number;
  preferredMode: string | null;
  lastPaymentDate: string | null;
  healthScore: number;
  healthLabel: "Excellent" | "Good" | "Average" | "High Risk";
  healthColorClass: string;
  riskLabel: "Low" | "Medium" | "High";
  riskChipClass: string;
  insights: Insight[];
}

export type InsightSeverity = "danger" | "warning" | "info" | "success";

export interface Insight {
  icon: string;
  /** Short label, e.g. "Overdue" or "Reminder Recommended" — shown as the mini-card heading. */
  title: string;
  text: string;
  severity: InsightSeverity;
}

export function computeCollectionAnalytics(params: {
  invoice: Invoice;
  customer: Customer;
  todayISO: string;
  thisInvoiceAllocations: AllocationWithReceipt[];
  customerInvoices: Invoice[]; // all invoices for this customer, including this one
  allocationsByInvoiceId: Map<string, AllocationWithReceipt[]>; // for every customerInvoices id
  customerReceipts: Receipt[];
  reminders: ReminderLog[];
}): CollectionAnalytics {
  const {
    invoice,
    customer,
    todayISO,
    thisInvoiceAllocations,
    customerInvoices,
    allocationsByInvoiceId,
    customerReceipts,
    reminders,
  } = params;

  const amountPaid = sum(thisInvoiceAllocations.map((a) => a.amount));
  const outstanding = Math.max(0, invoice.total - amountPaid);
  const percentPaid = invoice.total > 0 ? (amountPaid / invoice.total) * 100 : 0;
  const dueInDays = -daysBetween(todayISO, invoice.due_date); // >0 days left, <0 overdue
  const isOverdue = outstanding > 0 && dueInDays < 0;

  let outstandingAcrossAll = 0;
  let totalPaidAcrossAll = 0;
  let lateInvoiceCount = 0;
  let consideredInvoiceCount = 0;
  const delays: number[] = [];

  for (const inv of customerInvoices) {
    const allocs = allocationsByInvoiceId.get(inv.id) ?? [];
    const paidForInv = sum(allocs.map((a) => a.amount));
    const outstandingForInv = Math.max(0, inv.total - paidForInv);
    outstandingAcrossAll += outstandingForInv;
    totalPaidAcrossAll += paidForInv;

    if (outstandingForInv <= 0 && allocs.length > 0) {
      consideredInvoiceCount += 1;
      const lastReceiptDate = allocs
        .map((a) => a.receipts?.receipt_date)
        .filter(Boolean)
        .sort()
        .at(-1) as string | undefined;
      if (lastReceiptDate) {
        const delay = daysBetween(inv.due_date, lastReceiptDate);
        delays.push(Math.max(0, delay));
        if (delay > 0) lateInvoiceCount += 1;
      }
    } else if (outstandingForInv > 0 && daysBetween(todayISO, inv.due_date) < 0) {
      consideredInvoiceCount += 1;
      lateInvoiceCount += 1;
    }
  }

  const avgPaymentDelayDays = delays.length ? Math.round(sum(delays) / delays.length) : null;
  const availableCredit = Math.max(0, customer.credit_limit - outstandingAcrossAll);

  const modeCounts = new Map<string, number>();
  for (const r of customerReceipts) modeCounts.set(r.mode, (modeCounts.get(r.mode) ?? 0) + 1);
  const preferredMode = [...modeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const lastPaymentDate = customerReceipts.map((r) => r.receipt_date).sort().at(-1) ?? null;

  // --- Score (0-100, higher = healthier) ---
  let score = 100;
  if (isOverdue) score -= Math.min(40, Math.abs(dueInDays) * 2);
  if (avgPaymentDelayDays) score -= Math.min(20, avgPaymentDelayDays);
  const lateRatio = consideredInvoiceCount ? lateInvoiceCount / consideredInvoiceCount : 0;
  score -= lateRatio * 30;
  if (customer.credit_limit > 0 && outstandingAcrossAll / customer.credit_limit > 0.65) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const healthLabel: CollectionAnalytics["healthLabel"] =
    score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 50 ? "Average" : "High Risk";
  const healthColorClass = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";

  const riskLabel: CollectionAnalytics["riskLabel"] = score >= 80 ? "Low" : score >= 50 ? "Medium" : "High";
  const riskChipClass =
    riskLabel === "Low"
      ? "bg-emerald-50 text-emerald-700"
      : riskLabel === "Medium"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";

  // --- Insights (plain rules over the numbers above, not an AI call) ---
  const insights: Insight[] = [];
  if (isOverdue) {
    insights.push({
      icon: "⚠️",
      severity: "danger",
      title: "Invoice Overdue",
      text: `Overdue by ${Math.abs(dueInDays)} day${Math.abs(dueInDays) === 1 ? "" : "s"}.`,
    });
  } else if (outstanding > 0) {
    insights.push({
      icon: "🗓️",
      severity: "info",
      title: "Payment Due Soon",
      text: `Due in ${dueInDays} day${dueInDays === 1 ? "" : "s"}.`,
    });
  }
  if (avgPaymentDelayDays !== null) {
    insights.push(
      avgPaymentDelayDays > 0
        ? {
            icon: "📈",
            severity: "warning",
            title: "Payment Pattern",
            text: `Customer typically pays ${avgPaymentDelayDays} day${avgPaymentDelayDays === 1 ? "" : "s"} late on average.`,
          }
        : {
            icon: "🟢",
            severity: "success",
            title: "Reliable Payer",
            text: "Customer has historically paid on or before the due date.",
          }
    );
  }
  if (consideredInvoiceCount > 0 && lateInvoiceCount > 0) {
    insights.push({
      icon: "📊",
      severity: lateInvoiceCount / consideredInvoiceCount >= 0.5 ? "warning" : "info",
      title: "Recent History",
      text: `${lateInvoiceCount} of the last ${consideredInvoiceCount} invoice${consideredInvoiceCount === 1 ? "" : "s"} from this customer ${consideredInvoiceCount === 1 ? "was" : "were"} paid late or are currently overdue.`,
    });
  }
  if (customer.credit_limit > 0) {
    const pct = Math.round((outstandingAcrossAll / customer.credit_limit) * 100);
    if (pct >= 50) {
      insights.push({
        icon: "💰",
        severity: pct >= 80 ? "danger" : "warning",
        title: "Credit Utilization",
        text: `${pct}% of this customer's ₹${customer.credit_limit.toLocaleString("en-IN")} limit is in use.`,
      });
    }
  }
  const lastReminder = [...reminders].sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1))[0];
  if (isOverdue && Math.abs(dueInDays) >= 7) {
    if (!lastReminder || daysBetween(lastReminder.sent_at, todayISO) >= 7) {
      insights.push({
        icon: "📨",
        severity: "warning",
        title: "Reminder Recommended",
        text: "No reminder sent in the last 7 days.",
      });
    }
  }
  if (insights.length === 0) {
    insights.push({ icon: "🟢", severity: "success", title: "Good Standing", text: "No red flags on this invoice." });
  }

  return {
    outstanding,
    amountPaid,
    percentPaid,
    isOverdue,
    dueInDays,
    outstandingAcrossAll,
    availableCredit,
    totalPaidAcrossAll,
    avgPaymentDelayDays,
    lateInvoiceCount,
    consideredInvoiceCount,
    preferredMode,
    lastPaymentDate,
    healthScore: score,
    healthLabel,
    healthColorClass,
    riskLabel,
    riskChipClass,
    insights,
  };
}

function sum(nums: (number | null | undefined)[]): number {
  return nums.reduce((acc: number, n) => acc + (n ?? 0), 0);
}
