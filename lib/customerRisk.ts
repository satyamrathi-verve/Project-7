import type { Customer, Invoice, Receipt, ReceiptAllocation } from "@/lib/types";
import { daysBetween } from "@/lib/format";

/*
  Aggregate, per-customer collection risk — same scoring spirit as
  lib/collectionHealth.ts (which scores one invoice's customer), but computed
  independently of any single invoice so the Dashboard can rank every
  customer at once. Real numbers only: outstanding, credit utilisation, and
  payment-delay history from invoices/receipts/receipt_allocations.
*/

export interface CustomerRisk {
  customer: Customer;
  outstanding: number;
  creditUtilizationPct: number; // 0-100+ (can exceed 100 if over limit)
  avgDelayDays: number | null;
  riskScore: number; // 0-100, higher = healthier
  riskLabel: "Excellent" | "Good" | "Average" | "High Risk";
  riskColorClass: string;
  riskChipClass: string;
}

export function computeCustomerRisk(params: {
  customer: Customer;
  invoices: Invoice[]; // this customer's invoices only
  allocationsByInvoiceId: Map<string, ReceiptAllocation[]>;
  receiptsById: Map<string, Pick<Receipt, "receipt_date">>;
  todayISO: string;
}): CustomerRisk {
  const { customer, invoices, allocationsByInvoiceId, receiptsById, todayISO } = params;

  let outstanding = 0;
  let lateCount = 0;
  let consideredCount = 0;
  const delays: number[] = [];

  for (const inv of invoices) {
    const allocs = allocationsByInvoiceId.get(inv.id) ?? [];
    const paid = allocs.reduce((s, a) => s + (a.amount ?? 0), 0);
    const invOutstanding = Math.max(0, inv.total - paid);
    outstanding += invOutstanding;

    if (invOutstanding <= 0 && allocs.length > 0) {
      consideredCount += 1;
      const lastReceiptDate = allocs
        .map((a) => receiptsById.get(a.receipt_id)?.receipt_date)
        .filter(Boolean)
        .sort()
        .at(-1) as string | undefined;
      if (lastReceiptDate) {
        const delay = daysBetween(inv.due_date, lastReceiptDate);
        delays.push(Math.max(0, delay));
        if (delay > 0) lateCount += 1;
      }
    } else if (invOutstanding > 0 && daysBetween(todayISO, inv.due_date) < 0) {
      consideredCount += 1;
      lateCount += 1;
    }
  }

  const avgDelayDays = delays.length ? Math.round(delays.reduce((s, d) => s + d, 0) / delays.length) : null;
  const creditUtilizationPct = customer.credit_limit > 0 ? (outstanding / customer.credit_limit) * 100 : 0;

  let score = 100;
  if (avgDelayDays) score -= Math.min(25, avgDelayDays);
  const lateRatio = consideredCount ? lateCount / consideredCount : 0;
  score -= lateRatio * 35;
  if (creditUtilizationPct > 65) score -= Math.min(20, (creditUtilizationPct - 65) / 2);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const riskLabel: CustomerRisk["riskLabel"] =
    score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 50 ? "Average" : "High Risk";
  const riskColorClass = score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-danger";
  const riskChipClass =
    score >= 80 ? "bg-success-bg text-success" : score >= 50 ? "bg-warning-bg text-warning" : "bg-danger-bg text-danger";

  return {
    customer,
    outstanding,
    creditUtilizationPct,
    avgDelayDays,
    riskScore: score,
    riskLabel,
    riskColorClass,
    riskChipClass,
  };
}
