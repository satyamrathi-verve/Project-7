"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Customer, Invoice, InvoiceStatus, ReceiptAllocation } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { FormField, inputClass } from "@/components/FormField";

type InvoiceRow = Invoice & {
  customers: { name: string; code: string } | null;
};

const DAY = 24 * 60 * 60 * 1000;
const today = () => new Date(new Date().toDateString());
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (isoDate: string, days: number) => {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1";

const STATUS_FILTERS: { value: InvoiceStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

/** Dot color only — status text stays neutral so color isn't the only signal (label is always spelled out). */
const STATUS_DOT: Record<InvoiceStatus, string> = {
  open: "bg-info",
  partial: "bg-warning",
  paid: "bg-success",
  overdue: "bg-danger",
};

/** Status is only truly "overdue" once the due date has passed, per the AR rule. */
function effectiveStatus(row: InvoiceRow): InvoiceStatus {
  if (
    (row.status === "open" || row.status === "partial") &&
    new Date(row.due_date) < today()
  ) {
    return "overdue";
  }
  return row.status;
}

/** Days-to-due label for the collections-focused "Due" column. */
function dueInfo(row: InvoiceRow): { label: string; tone: "muted" | "warn" | "danger" } {
  if (row.status === "paid") return { label: "Settled", tone: "muted" };
  const days = Math.round((new Date(row.due_date).getTime() - today().getTime()) / DAY);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "danger" };
  if (days === 0) return { label: "Due today", tone: "warn" };
  if (days <= 7) return { label: `Due in ${days}d`, tone: "warn" };
  return { label: `Due in ${days}d`, tone: "muted" };
}

/** Next sequential number following the seeded "INV-0001" convention. */
function nextInvoiceNo(invoices: InvoiceRow[]): string {
  let max = 0;
  for (const inv of invoices) {
    const m = /^INV-(\d+)$/.exec(inv.invoice_no);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

type SortKey = "invoice_no" | "invoice_date" | "customer" | "total" | "outstanding" | "status";
type SortDir = "asc" | "desc";
type Tab = "list" | "new";

function downloadCsv(rows: InvoiceRow[], outstandingOf: (i: Invoice) => number) {
  const header = ["Invoice No", "Date", "Customer", "Total", "Outstanding", "Status"];
  const lines = rows.map((r) =>
    [
      r.invoice_no,
      r.invoice_date,
      r.customers?.name ?? "",
      Number(r.total).toFixed(2),
      outstandingOf(r).toFixed(2),
      effectiveStatus(r),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [allocations, setAllocations] = useState<ReceiptAllocation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("invoice_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [tab, setTab] = useState<Tab>("list");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [invRes, allocRes, custRes] = await Promise.all([
      supabase.from("invoices").select("*, customers(name, code)"),
      supabase.from("receipt_allocations").select("*"),
      supabase.from("customers").select("*").order("name", { ascending: true }),
    ]);
    const err = invRes.error || allocRes.error || custRes.error;
    if (err) setError(err.message);
    else {
      setInvoices((invRes.data as InvoiceRow[]) ?? []);
      setAllocations((allocRes.data as ReceiptAllocation[]) ?? []);
      setCustomers((custRes.data as Customer[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const outstandingOf = useMemo(() => {
    const allocated = new Map<string, number>();
    for (const a of allocations) {
      allocated.set(a.invoice_id, (allocated.get(a.invoice_id) ?? 0) + Number(a.amount));
    }
    return (inv: Invoice) => Math.max(0, Number(inv.total) - (allocated.get(inv.id) ?? 0));
  }, [allocations]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const bySearchAndSort = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (inv: InvoiceRow) =>
      !q ||
      inv.customers?.name.toLowerCase().includes(q) ||
      inv.customers?.code.toLowerCase().includes(q) ||
      inv.invoice_no.toLowerCase().includes(q);
    return invoices.filter(matches);
  }, [invoices, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<InvoiceStatus | "all", number> = {
      all: bySearchAndSort.length,
      open: 0,
      partial: 0,
      paid: 0,
      overdue: 0,
    };
    for (const inv of bySearchAndSort) counts[effectiveStatus(inv)]++;
    return counts;
  }, [bySearchAndSort]);

  const filtered = useMemo(() => {
    const rows =
      statusFilter === "all"
        ? bySearchAndSort
        : bySearchAndSort.filter((inv) => effectiveStatus(inv) === statusFilter);

    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case "invoice_no":
          return a.invoice_no.localeCompare(b.invoice_no) * dir;
        case "invoice_date":
          return (new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()) * dir;
        case "customer":
          return (a.customers?.name ?? "").localeCompare(b.customers?.name ?? "") * dir;
        case "total":
          return (Number(a.total) - Number(b.total)) * dir;
        case "outstanding":
          return (outstandingOf(a) - outstandingOf(b)) * dir;
        case "status":
          return effectiveStatus(a).localeCompare(effectiveStatus(b)) * dir;
        default:
          return 0;
      }
    });
  }, [bySearchAndSort, statusFilter, sortKey, sortDir, outstandingOf]);

  const kpis = useMemo(() => {
    const totalValue = filtered.reduce((s, i) => s + Number(i.total), 0);
    const totalOutstanding = filtered.reduce((s, i) => s + outstandingOf(i), 0);
    const overdue = filtered.filter((i) => effectiveStatus(i) === "overdue");
    const overdueAmount = overdue.reduce((s, i) => s + outstandingOf(i), 0);
    return {
      count: filtered.length,
      totalValue,
      totalOutstanding,
      overdueAmount,
      overdueCount: overdue.length,
      overdueShare: totalOutstanding > 0 ? (overdueAmount / totalOutstanding) * 100 : 0,
    };
  }, [filtered, outstandingOf]);

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";
  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
  }

  async function handleCreated() {
    setTab("list");
    await load();
  }

  const rowSignature = `${sortKey}:${sortDir}:${statusFilter}:${search}`;

  function SortHeader({ label, k, align = "left", width }: { label: string; k: SortKey; align?: "left" | "right"; width: string }) {
    const active = sortKey === k;
    const arrow = active ? (sortDir === "asc" ? "↑" : "↓") : "";
    return (
      <th scope="col" aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className={`p-0 ${width}`}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`group flex w-full items-center gap-1 px-4 py-3 font-medium text-ink-secondary transition-colors duration-150 hover:text-ink ${FOCUS_RING} ${
            align === "right" ? "flex-row-reverse text-right" : "text-left"
          }`}
        >
          {label}
          <span className={`w-2.5 text-[10px] ${active ? "text-brand" : "text-ink-muted/50 opacity-0 group-hover:opacity-100"}`}>
            {arrow || "↕"}
          </span>
        </button>
      </th>
    );
  }

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Sales Invoices" subtitle="Every invoice raised for your customers." />
        <NotConfigured />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Sales Invoices"
        subtitle="Every invoice raised for your customers."
        action={
          tab === "list" ? (
            <button
              onClick={() => downloadCsv(filtered, outstandingOf)}
              disabled={filtered.length === 0}
              className={`inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-secondary shadow-card transition-all duration-150 hover:scale-[1.02] hover:shadow-card-hover active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 ${FOCUS_RING}`}
            >
              <DownloadIcon />
              Export CSV
            </button>
          ) : undefined
        }
      />

      {/* Tabs — switches between the invoice list and the new-invoice form */}
      <div role="tablist" aria-label="Invoices" className="mb-6 inline-flex h-9 items-center gap-0.5 rounded-lg bg-black/[0.035] p-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "list"}
          onClick={() => setTab("list")}
          className={`rounded-md px-3.5 py-1 text-sm font-medium transition-all duration-150 ${FOCUS_RING} ${
            tab === "list" ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink-secondary"
          }`}
        >
          All Invoices
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "new"}
          onClick={() => setTab("new")}
          className={`flex items-center gap-1.5 rounded-md px-3.5 py-1 text-sm font-medium transition-all duration-150 ${FOCUS_RING} ${
            tab === "new" ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink-secondary"
          }`}
        >
          <PlusIcon />
          New Invoice
        </button>
      </div>

      {tab === "new" ? (
        <NewInvoiceForm customers={customers} invoices={invoices} onCreated={handleCreated} onCancel={() => setTab("list")} />
      ) : (
        <div className="animate-fade-in motion-reduce:animate-none">
          {/* KPI row — one neutral card language; color reserved for meaning, not decoration */}
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi label="Invoices" value={String(kpis.count)} icon={<DocumentIcon />} />
            <Kpi label="Total Value" value={inr(kpis.totalValue)} icon={<WalletIcon />} />
            <Kpi label="Outstanding" value={inr(kpis.totalOutstanding)} sub={`${kpis.overdueShare.toFixed(0)}% overdue`} icon={<ClockIcon />} />
            <Kpi
              label="Overdue"
              value={inr(kpis.overdueAmount)}
              sub={`${kpis.overdueCount} invoice${kpis.overdueCount === 1 ? "" : "s"}`}
              icon={<AlertIcon />}
              accent
            />
          </div>

          {/* Toolbar — stable DOM so tab order never shifts */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
                <SearchIcon />
              </span>
              <input
                className={`h-9 w-72 rounded-lg border border-hairline bg-surface pl-9 pr-9 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20`}
                placeholder="Search by customer or invoice no…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search invoices"
              />
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                tabIndex={search ? 0 : -1}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted transition-opacity hover:text-ink-secondary ${FOCUS_RING} ${
                  search ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <ClearIcon />
              </button>
            </div>

            {/* Segmented control replaces native <select> — same filter, no OS-chrome context switch */}
            <div role="group" aria-label="Filter by status" className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-black/[0.035] p-1">
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setStatusFilter(f.value)}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-all duration-150 ${FOCUS_RING} ${
                      active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink-secondary"
                    }`}
                  >
                    {f.label}
                    <span className="text-xs tabular-nums text-ink-muted">{statusCounts[f.value]}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={resetFilters}
              tabIndex={hasActiveFilters ? 0 : -1}
              className={`text-sm font-medium text-brand transition-opacity hover:underline ${FOCUS_RING} ${
                hasActiveFilters ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              Reset filters
            </button>

            <span className="ml-auto text-sm text-ink-muted" aria-live="polite" aria-atomic="true">
              Showing {filtered.length} of {invoices.length} invoices
            </span>
          </div>

          {error && (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-danger-border bg-danger-bg px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-danger">
                <AlertIcon />
                <span>Couldn&apos;t load invoices — {error}</span>
              </div>
              <button
                type="button"
                onClick={load}
                className={`flex-none rounded-md border border-danger-border bg-surface px-3 py-1.5 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-bg ${FOCUS_RING}`}
              >
                Retry
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-card">
            <div className="max-h-[65vh] overflow-y-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Sales invoices with customer, amounts, due status, and status</caption>
                <colgroup>
                  <col className="w-[130px]" />
                  <col className="w-[110px]" />
                  <col />
                  <col className="w-[140px]" />
                  <col className="w-[140px]" />
                  <col className="w-[120px]" />
                  <col className="w-[130px]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-section">
                  <tr className="border-b border-hairline text-left">
                    <SortHeader label="Number" k="invoice_no" width="w-[130px]" />
                    <SortHeader label="Date" k="invoice_date" width="w-[110px]" />
                    <SortHeader label="Customer" k="customer" width="" />
                    <SortHeader label="Total" k="total" align="right" width="w-[140px]" />
                    <SortHeader label="Outstanding" k="outstanding" align="right" width="w-[140px]" />
                    <th scope="col" className="px-4 py-3 font-medium text-ink-secondary">
                      Due
                    </th>
                    <SortHeader label="Status" k="status" width="w-[130px]" />
                  </tr>
                </thead>
                <tbody key={rowSignature} className="animate-fade-in motion-reduce:animate-none">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-hairline last:border-0">
                        <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-black/[0.04] motion-reduce:animate-none" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-16 animate-pulse rounded bg-black/[0.04] motion-reduce:animate-none" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-40 animate-pulse rounded bg-black/[0.04] motion-reduce:animate-none" /></td>
                        <td className="px-4 py-3"><div className="ml-auto h-4 w-20 animate-pulse rounded bg-black/[0.04] motion-reduce:animate-none" /></td>
                        <td className="px-4 py-3"><div className="ml-auto h-4 w-20 animate-pulse rounded bg-black/[0.04] motion-reduce:animate-none" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-16 animate-pulse rounded bg-black/[0.04] motion-reduce:animate-none" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-14 animate-pulse rounded-full bg-black/[0.04] motion-reduce:animate-none" /></td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-ink-muted">
                          <SearchIcon />
                        </div>
                        <p className="text-sm font-medium text-ink-secondary">No invoices match.</p>
                        <p className="mt-1 text-sm text-ink-muted">Try a different search term or status.</p>
                        {hasActiveFilters && (
                          <button type="button" onClick={resetFilters} className={`mt-3 text-sm font-medium text-brand hover:underline ${FOCUS_RING}`}>
                            Reset filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((inv) => {
                      const status = effectiveStatus(inv);
                      const out = outstandingOf(inv);
                      const due = dueInfo(inv);
                      return (
                        <tr key={inv.id} className="group border-b border-hairline transition-colors duration-150 last:border-0 hover:bg-black/[0.015]">
                          <td className="px-4 py-3 font-medium">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className={`text-ink underline-offset-2 hover:text-brand hover:underline ${FOCUS_RING} rounded`}
                            >
                              {inv.invoice_no}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-ink-secondary">{new Date(inv.invoice_date).toLocaleDateString("en-IN")}</td>
                          <td className="truncate px-4 py-3 text-ink-secondary">{inv.customers?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-ink-secondary">{inr(Number(inv.total))}</td>
                          <td className={`px-4 py-3 text-right tabular-nums font-medium ${out > 0 ? "text-ink" : "text-ink-muted"}`}>
                            {inr(out)}
                          </td>
                          <td
                            className={`px-4 py-3 text-xs font-medium ${
                              due.tone === "danger" ? "text-danger" : due.tone === "warn" ? "text-warning" : "text-ink-muted"
                            }`}
                          >
                            {due.label}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-sm capitalize text-ink-secondary">
                                <span className={`h-1.5 w-1.5 flex-none rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                                {status}
                              </span>
                              <Link
                                href={`/invoices/${inv.id}/print`}
                                aria-label={`Print ${inv.invoice_no}`}
                                className={`text-ink-muted opacity-0 transition-opacity duration-150 hover:text-brand group-hover:opacity-100 ${FOCUS_RING} rounded`}
                              >
                                <PrintIcon />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {!loading && filtered.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 bg-section">
                    <tr className="border-t border-hairline font-semibold text-ink">
                      <td className="px-4 py-3" colSpan={3}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{inr(kpis.totalValue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{inr(kpis.totalOutstanding)}</td>
                      <td className="px-4 py-3" colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* New Invoice tab                                                        */
/* ---------------------------------------------------------------------- */

type LineItem = { description: string; qty: string; rate: string };
const EMPTY_ITEM: LineItem = { description: "", qty: "1", rate: "" };

function NewInvoiceForm({
  customers,
  invoices,
  onCreated,
  onCancel,
}: {
  customers: Customer[];
  invoices: InvoiceRow[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [dueDateTouched, setDueDateTouched] = useState(false);
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
  const [taxPercent, setTaxPercent] = useState("18");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const invoiceNo = useMemo(() => nextInvoiceNo(invoices), [invoices]);

  // Due date auto-fills from the customer's credit days, until the user edits it directly.
  useEffect(() => {
    if (dueDateTouched || !customer) return;
    setDueDate(addDaysISO(invoiceDate, customer.credit_days ?? 30));
  }, [customer, invoiceDate, dueDateTouched]);

  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const taxAmount = subtotal * ((Number(taxPercent) || 0) / 100);
  const total = subtotal + taxAmount;

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((rows) => rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }
  function addItem() {
    setItems((rows) => [...rows, { ...EMPTY_ITEM }]);
  }
  function removeItem(idx: number) {
    setItems((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows));
  }

  const validItems = items
    .map((it) => ({ ...it, qtyNum: Number(it.qty) || 0, rateNum: Number(it.rate) || 0 }))
    .filter((it) => it.description.trim() && it.qtyNum > 0 && it.rateNum > 0);

  const canSave = Boolean(customerId) && validItems.length > 0 && !saving;

  async function handleSubmit() {
    if (!supabase || !canSave) return;
    setSaving(true);
    setFormError(null);

    const { data: invRow, error: invErr } = await supabase
      .from("invoices")
      .insert({
        invoice_no: invoiceNo,
        invoice_date: invoiceDate,
        customer_id: customerId,
        due_date: dueDate || invoiceDate,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        status: "open",
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (invErr || !invRow) {
      setFormError(invErr?.message ?? "Could not create the invoice.");
      setSaving(false);
      return;
    }

    const { error: itemsErr } = await supabase.from("invoice_items").insert(
      validItems.map((it) => ({
        invoice_id: invRow.id,
        description: it.description.trim(),
        qty: it.qtyNum,
        rate: it.rateNum,
        amount: Math.round(it.qtyNum * it.rateNum * 100) / 100,
      }))
    );

    setSaving(false);

    if (itemsErr) {
      setFormError(itemsErr.message);
      return;
    }

    onCreated();
  }

  return (
    <div className="max-w-3xl animate-fade-in rounded-xl border border-hairline bg-surface p-6 shadow-card motion-reduce:animate-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-ink">New Invoice</h3>
          <p className="mt-1 text-sm text-ink-muted">Next number: <span className="font-medium text-ink-secondary">{invoiceNo}</span></p>
        </div>
      </div>

      {formError && (
        <p className="mt-4 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">{formError}</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        <FormField label="Customer">
          <select
            className={inputClass}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Invoice Date">
          <input
            type="date"
            className={inputClass}
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </FormField>
        <FormField label={`Due Date${customer ? ` (auto: ${customer.credit_days}d credit)` : ""}`}>
          <input
            type="date"
            className={inputClass}
            value={dueDate}
            onChange={(e) => {
              setDueDateTouched(true);
              setDueDate(e.target.value);
            }}
          />
        </FormField>
        <FormField label="Tax %">
          <input
            type="number"
            className={inputClass}
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
          />
        </FormField>
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Line Items</p>
        <div className="mt-2 overflow-hidden rounded-lg border border-hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-section text-left">
                <th className="px-3 py-2 font-medium text-ink-secondary">Description</th>
                <th className="w-20 px-3 py-2 font-medium text-ink-secondary">Qty</th>
                <th className="w-32 px-3 py-2 font-medium text-ink-secondary">Rate</th>
                <th className="w-32 px-3 py-2 text-right font-medium text-ink-secondary">Amount</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const amount = (Number(it.qty) || 0) * (Number(it.rate) || 0);
                return (
                  <tr key={idx} className="border-b border-hairline last:border-0">
                    <td className="p-2">
                      <input
                        className={`${inputClass} w-full`}
                        placeholder="Description"
                        value={it.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        className={`${inputClass} w-full`}
                        value={it.qty}
                        onChange={(e) => updateItem(idx, { qty: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        className={`${inputClass} w-full`}
                        value={it.rate}
                        onChange={(e) => updateItem(idx, { rate: e.target.value })}
                      />
                    </td>
                    <td className="p-2 text-right tabular-nums text-ink-secondary">{inr(amount)}</td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        aria-label="Remove line item"
                        className={`text-ink-muted transition-colors duration-150 hover:text-danger disabled:opacity-30 ${FOCUS_RING}`}
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addItem}
          className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline ${FOCUS_RING}`}
        >
          <PlusIcon />
          Add line
        </button>
      </div>

      <FormField label="Notes (optional)">
        <textarea
          className={`${inputClass} mt-1.5 min-h-[64px] resize-y`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </FormField>

      <div className="mt-6 flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-secondary">
            <span>Subtotal</span>
            <span className="tabular-nums">{inr(subtotal)}</span>
          </div>
          <div className="flex justify-between text-ink-secondary">
            <span>Tax ({taxPercent || 0}%)</span>
            <span className="tabular-nums">{inr(taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-hairline pt-1.5 text-base font-semibold text-ink">
            <span>Total</span>
            <span className="tabular-nums">{inr(total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-black/[0.04] ${FOCUS_RING}`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSave}
          className={`rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:scale-[1.02] hover:bg-brand-dark active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 ${FOCUS_RING}`}
        >
          {saving ? "Saving…" : "Save Invoice"}
        </button>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
      <div className="flex items-center gap-2">
        <span className={accent ? "text-danger" : "text-ink-muted"}>{icon}</span>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${accent ? "text-danger" : "text-ink"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

/* Small inline icons, unified 1.75 stroke — no new dependency. */
function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" strokeLinecap="round" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H16a2 2 0 1 0 0 4h5" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3 2 20h20L12 3Z" strokeLinejoin="round" />
      <path d="M12 10v4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
function ClearIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3v12m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PrintIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </svg>
  );
}
