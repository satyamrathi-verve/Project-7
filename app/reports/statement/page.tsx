"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Customer, Invoice, Receipt, ReceiptAllocation, ReminderLog } from "@/lib/types";
import { NotConfigured } from "@/components/NotConfigured";
import { inputClass } from "@/components/FormField";

type TxnType = "invoice" | "receipt";

type LedgerRow = {
  id: string;
  date: string;
  particulars: string;
  type: TxnType;
  ref: string;
  note: string;
  debit: number;
  credit: number;
  balance: number;
};

type PeriodKey = "all" | "this_month" | "last_30" | "fy" | "custom";

const MS_DAY = 86400000;

function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_DAY);
}

// Local calendar date as YYYY-MM-DD, without going through toISOString() (which
// shifts the date across timezone boundaries, e.g. IST midnight -> previous day UTC).
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ageingBucket(daysOverdue: number): "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus" {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "d1_30";
  if (daysOverdue <= 60) return "d31_60";
  if (daysOverdue <= 90) return "d61_90";
  return "d90_plus";
}

const PERIOD_LABELS: Record<PeriodKey, string> = {
  all: "All Time",
  this_month: "This Month",
  last_30: "Last 30 Days",
  fy: "Financial Year",
  custom: "Custom Range",
};

export default function CustomerStatementPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [allocations, setAllocations] = useState<ReceiptAllocation[]>([]);
  const [reminders, setReminders] = useState<ReminderLog[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [txnFilter, setTxnFilter] = useState<"all" | TxnType>("all");

  const [note, setNote] = useState<string | null>(null);
  function toast(message: string) {
    setNote(message);
  }
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 5000);
    return () => clearTimeout(t);
  }, [note]);

  useEffect(() => {
    async function loadCustomers() {
      if (!supabase) return;
      setLoadingCustomers(true);
      const { data, error } = await supabase.from("customers").select("*").order("name", { ascending: true });
      if (error) setError(error.message);
      else setCustomers(data as Customer[]);
      setLoadingCustomers(false);
    }
    loadCustomers();
  }, []);

  useEffect(() => {
    async function loadStatement() {
      if (!supabase || !selectedId) {
        setInvoices([]);
        setReceipts([]);
        setAllocations([]);
        setReminders([]);
        return;
      }
      setLoadingStatement(true);
      setError(null);

      const [invRes, rcptRes] = await Promise.all([
        supabase.from("invoices").select("*").eq("customer_id", selectedId).order("invoice_date", { ascending: true }),
        supabase.from("receipts").select("*").eq("customer_id", selectedId).order("receipt_date", { ascending: true }),
      ]);
      if (invRes.error) setError(invRes.error.message);
      if (rcptRes.error) setError(rcptRes.error.message);

      const invRows = (invRes.data ?? []) as Invoice[];
      const rcptRows = (rcptRes.data ?? []) as Receipt[];
      setInvoices(invRows);
      setReceipts(rcptRows);

      const invoiceIds = invRows.map((i) => i.id);
      if (invoiceIds.length > 0) {
        const [allocRes, remRes] = await Promise.all([
          supabase.from("receipt_allocations").select("*").in("invoice_id", invoiceIds),
          supabase.from("reminder_log").select("*").in("invoice_id", invoiceIds).order("sent_at", { ascending: false }),
        ]);
        if (allocRes.error) setError(allocRes.error.message);
        else setAllocations(allocRes.data as ReceiptAllocation[]);
        if (remRes.error) setError(remRes.error.message);
        else setReminders(remRes.data as ReminderLog[]);
      } else {
        setAllocations([]);
        setReminders([]);
      }

      setLoadingStatement(false);
    }
    loadStatement();
  }, [selectedId]);

  const customer = customers.find((c) => c.id === selectedId) ?? null;

  const invoiceById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);
  const receiptById = useMemo(() => new Map(receipts.map((r) => [r.id, r])), [receipts]);

  const allocationsByInvoice = useMemo(() => {
    const map = new Map<string, ReceiptAllocation[]>();
    allocations.forEach((a) => {
      const list = map.get(a.invoice_id) ?? [];
      list.push(a);
      map.set(a.invoice_id, list);
    });
    return map;
  }, [allocations]);

  const allocationsByReceipt = useMemo(() => {
    const map = new Map<string, ReceiptAllocation[]>();
    allocations.forEach((a) => {
      const list = map.get(a.receipt_id) ?? [];
      list.push(a);
      map.set(a.receipt_id, list);
    });
    return map;
  }, [allocations]);

  const today = useMemo(() => localDateStr(new Date()), []);

  // Per-invoice outstanding, ageing, overdue metrics — derived from real invoices + receipt_allocations.
  const invoiceMetrics = useMemo(() => {
    return invoices.map((inv) => {
      const allocated = (allocationsByInvoice.get(inv.id) ?? []).reduce((s, a) => s + a.amount, 0);
      const outstanding = Math.max(0, inv.total - allocated);
      const isUnpaid = inv.status === "open" || inv.status === "partial";
      const daysOverdue = isUnpaid ? daysBetween(inv.due_date, today) : -1;
      const isOverdue = isUnpaid && daysOverdue > 0;
      return { ...inv, outstanding, isUnpaid, isOverdue, daysOverdue };
    });
  }, [invoices, allocationsByInvoice, today]);

  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalReceived = receipts.reduce((s, r) => s + r.amount, 0);
  const outstandingBalance = (customer?.opening_balance ?? 0) + totalInvoiced - totalReceived;
  const overdueAmount = invoiceMetrics.filter((i) => i.isOverdue).reduce((s, i) => s + i.outstanding, 0);
  const unpaidCount = invoiceMetrics.filter((i) => i.isUnpaid && i.outstanding > 0).length;

  const oldestUnpaid = useMemo(() => {
    const unpaid = invoiceMetrics.filter((i) => i.isUnpaid && i.outstanding > 0);
    if (unpaid.length === 0) return null;
    return unpaid.reduce((oldest, i) => (i.due_date < oldest.due_date ? i : oldest));
  }, [invoiceMetrics]);

  const lastPaymentDate = useMemo(() => {
    if (receipts.length === 0) return null;
    return receipts.reduce((latest, r) => (r.receipt_date > latest ? r.receipt_date : latest), receipts[0].receipt_date);
  }, [receipts]);

  const avgDaysToPay = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "paid");
    const spans: number[] = [];
    paid.forEach((inv) => {
      const allocs = allocationsByInvoice.get(inv.id) ?? [];
      if (allocs.length === 0) return;
      const paidDates = allocs.map((a) => receiptById.get(a.receipt_id)?.receipt_date).filter(Boolean) as string[];
      if (paidDates.length === 0) return;
      const lastPaidDate = paidDates.reduce((latest, d) => (d > latest ? d : latest));
      spans.push(daysBetween(inv.invoice_date, lastPaidDate));
    });
    if (spans.length === 0) return null;
    return Math.round(spans.reduce((s, d) => s + d, 0) / spans.length);
  }, [invoices, allocationsByInvoice, receiptById]);

  const ageingBuckets = useMemo(() => {
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
    invoiceMetrics
      .filter((i) => i.isUnpaid && i.outstanding > 0)
      .forEach((i) => {
        const key = ageingBucket(i.daysOverdue);
        buckets[key] += i.outstanding;
      });
    return buckets;
  }, [invoiceMetrics]);

  const lastReminder = reminders[0] ?? null;

  const accountStatus = useMemo(() => {
    if (overdueAmount > 0) return { label: "Overdue", classes: "bg-red-50 text-red-700 ring-red-200" };
    if (outstandingBalance > 0) return { label: "Current", classes: "bg-blue-50 text-blue-700 ring-blue-200" };
    return { label: "Settled", classes: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  }, [overdueAmount, outstandingBalance]);

  // Full chronological ledger (opening balance + every invoice/receipt), running balance computed once.
  const fullLedger = useMemo(() => {
    if (!customer) return [] as LedgerRow[];

    const entries = [
      ...invoices.map((inv) => ({
        date: inv.invoice_date,
        type: "invoice" as TxnType,
        particulars: "Invoice",
        ref: inv.invoice_no,
        note: "",
        debit: inv.total,
        credit: 0,
        sortKey: `${inv.invoice_date}-0-${inv.invoice_no}`,
      })),
      ...receipts.map((r) => {
        const against = (allocationsByReceipt.get(r.id) ?? [])
          .map((a) => invoiceById.get(a.invoice_id)?.invoice_no)
          .filter(Boolean)
          .join(", ");
        return {
          date: r.receipt_date,
          type: "receipt" as TxnType,
          particulars: "Receipt",
          ref: r.receipt_no,
          note: against ? `Against ${against}` : "",
          debit: 0,
          credit: r.amount,
          sortKey: `${r.receipt_date}-1-${r.receipt_no}`,
        };
      }),
    ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    let running = customer.opening_balance;
    const rows: LedgerRow[] = [
      {
        id: "opening",
        date: "",
        particulars: "Opening Balance",
        type: "invoice",
        ref: "—",
        note: "",
        debit: 0,
        credit: 0,
        balance: running,
      },
    ];

    entries.forEach((e, i) => {
      running = running + e.debit - e.credit;
      rows.push({
        id: `${e.particulars}-${e.ref}-${i}`,
        date: e.date,
        particulars: e.particulars,
        type: e.type,
        ref: e.ref,
        note: e.note,
        debit: e.debit,
        credit: e.credit,
        balance: running,
      });
    });

    return rows;
  }, [customer, invoices, receipts, allocationsByReceipt, invoiceById]);

  const periodRange = useMemo(() => {
    const now = new Date();
    if (period === "this_month") {
      const start = localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
      return { from: start, to: today };
    }
    if (period === "last_30") {
      const start = localDateStr(new Date(now.getTime() - 30 * MS_DAY));
      return { from: start, to: today };
    }
    if (period === "fy") {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const start = localDateStr(new Date(fyStartYear, 3, 1));
      return { from: start, to: today };
    }
    if (period === "custom" && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    return null;
  }, [period, today, customFrom, customTo]);

  const { displayRows, totalDebit, totalCredit, closingBalance, statementFrom, statementTo } = useMemo(() => {
    const txnRows = fullLedger.filter((r) => r.id !== "opening");

    let scoped = txnRows;
    let openingCarry = customer?.opening_balance ?? 0;

    if (periodRange) {
      const before = txnRows.filter((r) => r.date < periodRange.from);
      openingCarry = before.length > 0 ? before[before.length - 1].balance : customer?.opening_balance ?? 0;
      scoped = txnRows.filter((r) => r.date >= periodRange.from && r.date <= periodRange.to);
    }

    if (txnFilter !== "all") {
      scoped = scoped.filter((r) => r.type === txnFilter);
    }

    const rows: LedgerRow[] = [
      {
        id: "opening",
        date: periodRange ? periodRange.from : "",
        particulars: periodRange ? "Opening Balance (b/f)" : "Opening Balance",
        type: "invoice",
        ref: "—",
        note: "",
        debit: 0,
        credit: 0,
        balance: openingCarry,
      },
      ...scoped,
    ];

    const debitSum = scoped.reduce((s, r) => s + r.debit, 0);
    const creditSum = scoped.reduce((s, r) => s + r.credit, 0);
    const closing = rows[rows.length - 1].balance;

    return {
      displayRows: rows,
      totalDebit: debitSum,
      totalCredit: creditSum,
      closingBalance: closing,
      statementFrom: periodRange ? periodRange.from : txnRows[0]?.date ?? today,
      statementTo: periodRange ? periodRange.to : today,
    };
  }, [fullLedger, periodRange, txnFilter, customer, today]);

  function exportCsv() {
    if (!customer) return;

    const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines: string[] = [];

    lines.push(csvEscape(`Customer Statement — ${customer.name} (${customer.code})`));
    lines.push(csvEscape(`Period: ${PERIOD_LABELS[period]} (${statementFrom ? formatDate(statementFrom) : "—"} to ${formatDate(statementTo)})`));
    lines.push("");
    lines.push(["Date", "Particulars", "Ref", "Debit", "Credit", "Balance"].map(csvEscape).join(","));

    displayRows.forEach((r) => {
      lines.push(
        [
          r.date ? formatDate(r.date) : "",
          r.note ? `${r.particulars} (${r.note})` : r.particulars,
          r.ref,
          r.debit ? r.debit.toFixed(2) : "",
          r.credit ? r.credit.toFixed(2) : "",
          r.balance.toFixed(2),
        ]
          .map(csvEscape)
          .join(",")
      );
    });

    lines.push(
      ["", "Totals for period", "", totalDebit.toFixed(2), totalCredit.toFixed(2), closingBalance.toFixed(2)]
        .map(csvEscape)
        .join(",")
    );

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customer.code}-statement-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!isConfigured) {
    return (
      <>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Customer Statement</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review the running statement of invoices, receipts, and outstanding balance for a selected customer.
          </p>
        </div>
        <NotConfigured />
      </>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customer Statement</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review the running statement of invoices, receipts, and outstanding balance for a selected customer.
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          <button
            onClick={() => (customer ? exportCsv() : toast("Select a customer first."))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            title="Downloads a CSV file — opens directly in Excel or Google Sheets"
          >
            Download Excel
          </button>
          <button
            onClick={() => toast("Emailing statements isn't built yet — this button is a placeholder for that screen.")}
            className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
            title="Not built yet"
          >
            Email Statement
          </button>
          <button
            onClick={() => toast("Reminders are sent from the Auto Email Shoot screen, not from here.")}
            className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
            title="Not built yet"
          >
            Send Reminder
          </button>
          <button
            onClick={() => (customer ? window.print() : toast("Select a customer first."))}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
            title="Opens your browser's print dialog — choose 'Save as PDF' to export"
          >
            Print Statement
          </button>
        </div>
      </div>

      {note && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">
          <span>ℹ️</span>
          {note}
        </div>
      )}

      {/* Control bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 print:hidden">
        <select
          className={`${inputClass} min-w-[220px]`}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loadingCustomers}
        >
          <option value="">{loadingCustomers ? "Loading customers..." : "Select a customer..."}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>

        <select className={inputClass} value={period} onChange={(e) => setPeriod(e.target.value as PeriodKey)}>
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
            <option key={k} value={k}>
              {PERIOD_LABELS[k]}
            </option>
          ))}
        </select>

        {period === "custom" && (
          <>
            <input type="date" className={inputClass} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-sm text-slate-400">to</span>
            <input type="date" className={inputClass} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </>
        )}

        <select className={inputClass} value={txnFilter} onChange={(e) => setTxnFilter(e.target.value as "all" | TxnType)}>
          <option value="all">All transactions</option>
          <option value="invoice">Invoices only</option>
          <option value="receipt">Receipts only</option>
        </select>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!customer ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
          Select a customer above to view their statement.
        </div>
      ) : loadingStatement ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading statement…</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5 print:hidden">
            <SummaryCard icon="💰" label="Outstanding Balance" value={formatMoney(outstandingBalance)} emphasis={outstandingBalance > 0} />
            <SummaryCard icon="🧾" label="Total Invoiced" value={formatMoney(totalInvoiced)} />
            <SummaryCard icon="✅" label="Total Received" value={formatMoney(totalReceived)} />
            <SummaryCard
              icon="⚠️"
              label="Overdue Amount"
              value={formatMoney(overdueAmount)}
              emphasis={overdueAmount > 0}
              danger={overdueAmount > 0}
            />
            <SummaryCard
              icon="📅"
              label={lastPaymentDate ? "Last Payment" : "Oldest Unpaid Invoice"}
              value={lastPaymentDate ? formatDate(lastPaymentDate) : oldestUnpaid ? oldestUnpaid.invoice_no : "—"}
            />
          </div>

          {/* Two-column info area */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-5 print:hidden">
            {/* Customer profile */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{customer.name}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${accountStatus.classes}`}>
                      {accountStatus.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {customer.code}
                    {customer.gstin ? ` · GSTIN ${customer.gstin}` : ""}
                  </p>
                </div>
                <p className="text-xs text-slate-400">Generated {formatDate(today)}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-6 border-t border-slate-100 pt-4 text-sm">
                <div className="space-y-2">
                  <InfoRow label="Location" value={customer.address || "—"} />
                  <InfoRow label="Credit Terms" value={`Net ${customer.credit_days}`} />
                  <InfoRow label="Credit Limit" value={formatMoney(customer.credit_limit)} />
                </div>
                <div className="space-y-2">
                  <InfoRow label="Contact" value={customer.contact_person || "—"} />
                  <InfoRow label="Email" value={customer.email || "—"} />
                  <InfoRow label="Phone" value={customer.phone || "—"} />
                </div>
              </div>
            </div>

            {/* AR insights */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">AR Insights</h3>
              <div className="mt-3 space-y-2 text-sm">
                <InfoRow label="Unpaid invoices" value={String(unpaidCount)} />
                <InfoRow label="Oldest unpaid invoice" value={oldestUnpaid ? `${oldestUnpaid.invoice_no} (due ${formatDate(oldestUnpaid.due_date)})` : "None"} />
                <InfoRow label="Avg. days to pay" value={avgDaysToPay !== null ? `${avgDaysToPay} days` : "—"} />
                <InfoRow
                  label="Last reminder sent"
                  value={lastReminder ? `${formatDate(lastReminder.sent_at)} · ${lastReminder.to_email ?? "—"}` : "No reminders sent yet"}
                />
                <InfoRow label="Suggested follow-up" value={overdueAmount > 0 ? "Due now" : "Not required"} />
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Ageing breakdown</p>
              <div className="mt-2 space-y-1.5">
                <AgeingChip label="Current" value={ageingBuckets.current} total={outstandingBalance} colorClass="bg-slate-300" />
                <AgeingChip label="1–30 days" value={ageingBuckets.d1_30} total={outstandingBalance} colorClass="bg-amber-400" />
                <AgeingChip label="31–60 days" value={ageingBuckets.d31_60} total={outstandingBalance} colorClass="bg-orange-400" />
                <AgeingChip label="61–90 days" value={ageingBuckets.d61_90} total={outstandingBalance} colorClass="bg-red-400" />
                <AgeingChip label="90+ days" value={ageingBuckets.d90_plus} total={outstandingBalance} colorClass="bg-red-600" />
              </div>
            </div>
          </div>

          {/* Ledger card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 print:border-0 print:p-0 print:shadow-none">
            <div className="hidden items-start justify-between border-b border-slate-100 pb-4 print:flex">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{customer.name}</h3>
                <p className="text-sm text-slate-500">
                  {customer.code}
                  {customer.gstin ? ` · GSTIN ${customer.gstin}` : ""}
                </p>
              </div>
              <p className="text-sm text-slate-500">Generated {formatDate(today)}</p>
            </div>

            {/* Statement metadata strip */}
            <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-4 text-xs text-slate-600 sm:grid-cols-3 lg:grid-cols-6">
              <MetaItem label="Period" value={PERIOD_LABELS[period]} />
              <MetaItem label="From" value={statementFrom ? formatDate(statementFrom) : "—"} />
              <MetaItem label="To" value={formatDate(statementTo)} />
              <MetaItem label="Total Debits" value={formatMoney(totalDebit)} />
              <MetaItem label="Total Credits" value={formatMoney(totalCredit)} />
              <MetaItem label="Closing Balance" value={formatMoney(closingBalance)} strong />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-3 font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Particulars</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Ref</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Debit</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Credit</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r, idx) => (
                    <tr
                      key={r.id}
                      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                        r.id === "opening" ? "bg-slate-50/60 font-medium" : idx % 2 === 0 ? "" : "bg-slate-50/30"
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-700">{r.date ? formatDate(r.date) : "—"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="flex items-center gap-2">
                          {r.id !== "opening" && <TypeBadge type={r.type} />}
                          <span>{r.particulars}</span>
                        </div>
                        {r.note && <p className="mt-0.5 text-xs text-slate-400">{r.note}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{r.ref}</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {r.debit ? formatMoney(r.debit) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {r.credit ? formatMoney(r.credit) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-700" colSpan={3}>
                      Totals for period
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatMoney(totalDebit)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatMoney(totalCredit)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatMoney(closingBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <span className="text-slate-500">Closing balance (amount owed):</span>
              <span className="text-lg font-bold text-slate-900">{formatMoney(closingBalance)}</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  emphasis,
  danger,
}: {
  icon: string;
  label: string;
  value: string;
  emphasis?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm ${
        danger ? "border-red-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        <span>{icon}</span>
        {label}
      </div>
      <p className={`mt-2 text-lg font-semibold ${danger ? "text-red-600" : emphasis ? "text-slate-900" : "text-slate-700"}`}>
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{value}</span>
    </div>
  );
}

function MetaItem({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 ${strong ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>{value}</p>
    </div>
  );
}

function AgeingChip({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 flex-none text-slate-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-24 flex-none text-right font-medium text-slate-700">{formatMoney(value)}</span>
    </div>
  );
}

function TypeBadge({ type }: { type: TxnType }) {
  const isInvoice = type === "invoice";
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isInvoice ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
      }`}
    >
      {isInvoice ? "Inv" : "Rcpt"}
    </span>
  );
}
