"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Customer, Invoice, ReceiptAllocation, InvoiceStatus } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { DataTable, type Column } from "@/components/DataTable";
import { inputClass } from "@/components/FormField";
import { StatCard } from "@/components/StatCard";

/*
  Sales Invoices — the read-only list of every invoice with its customer, dates,
  total, what's still outstanding, and an at-a-glance status. Outstanding and the
  "overdue" flag are computed the way CLAUDE.md defines them:
    outstanding = total − sum(receipt_allocations.amount for that invoice)
    overdue     = status is open/partial AND due_date < today
*/

type InvoiceRow = Invoice & {
  customerName: string;
  customerCode: string;
  outstanding: number;
  effectiveStatus: InvoiceStatus;
};

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  open: "bg-blue-50 text-blue-700",
  partial: "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-700",
  paid: "bg-emerald-50 text-emerald-700",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: "Open",
  partial: "Partial",
  overdue: "Overdue",
  paid: "Paid",
};

const FILTERS: { key: "all" | InvoiceStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "partial", label: "Partial" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(d: string) {
  // d is an ISO date like 2026-06-30 — show it as 30 Jun 2026 without timezone drift.
  const [y, m, day] = d.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[Number(m) - 1]} ${y}`;
}

export default function SalesInvoicesPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");

  async function loadInvoices() {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const today = todayStr();

    const [{ data: invoiceData, error: invErr }, { data: customerData }, { data: allocationData }] =
      await Promise.all([
        supabase.from("invoices").select("*").order("invoice_date", { ascending: false }),
        supabase.from("customers").select("id, code, name"),
        supabase.from("receipt_allocations").select("invoice_id, amount"),
      ]);

    if (invErr) {
      setError(invErr.message);
      setLoading(false);
      return;
    }

    const customerById = new Map(
      ((customerData as Pick<Customer, "id" | "code" | "name">[]) ?? []).map((c) => [c.id, c])
    );

    const allocatedByInvoice = new Map<string, number>();
    for (const a of (allocationData as Pick<ReceiptAllocation, "invoice_id" | "amount">[]) ?? []) {
      allocatedByInvoice.set(a.invoice_id, (allocatedByInvoice.get(a.invoice_id) ?? 0) + Number(a.amount));
    }

    const built: InvoiceRow[] = ((invoiceData as Invoice[]) ?? []).map((inv) => {
      const customer = customerById.get(inv.customer_id);
      const outstanding = Number(inv.total) - (allocatedByInvoice.get(inv.id) ?? 0);
      // Overdue is derived: an open/partial invoice past its due date reads as overdue,
      // even if the stored status still says "open".
      const isOverdue =
        (inv.status === "open" || inv.status === "partial") && inv.due_date.slice(0, 10) < today;
      const effectiveStatus: InvoiceStatus = isOverdue ? "overdue" : inv.status;
      return {
        ...inv,
        customerName: customer?.name ?? "Unknown customer",
        customerCode: customer?.code ?? "—",
        outstanding,
        effectiveStatus,
      };
    });

    setRows(built);
    setLoading(false);
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.effectiveStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        r.invoice_no.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.customerCode.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const totals = useMemo(() => {
    const outstanding = rows.reduce((s, r) => s + Math.max(r.outstanding, 0), 0);
    const overdue = rows.filter((r) => r.effectiveStatus === "overdue");
    const overdueAmount = overdue.reduce((s, r) => s + Math.max(r.outstanding, 0), 0);
    return { count: rows.length, outstanding, overdueCount: overdue.length, overdueAmount };
  }, [rows]);

  const columns: Column<InvoiceRow>[] = [
    {
      key: "invoice_no",
      header: "Invoice #",
      render: (r) => (
        <Link href={`/invoices/${r.id}/print`} className="font-medium text-brand hover:underline">
          {r.invoice_no}
        </Link>
      ),
    },
    { key: "customer", header: "Customer", render: (r) => r.customerName },
    { key: "invoice_date", header: "Date", render: (r) => formatDate(r.invoice_date) },
    { key: "due_date", header: "Due", render: (r) => formatDate(r.due_date) },
    { key: "total", header: "Total", className: "text-right", render: (r) => money(r.total) },
    {
      key: "outstanding",
      header: "Outstanding",
      className: "text-right",
      render: (r) => (
        <span className={r.outstanding > 0 ? "font-medium text-slate-900" : "text-slate-400"}>
          {money(Math.max(r.outstanding, 0))}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[r.effectiveStatus]}`}>
          {STATUS_LABEL[r.effectiveStatus]}
        </span>
      ),
    },
  ];

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Sales Invoices" subtitle="Every invoice you've raised, with what's still outstanding." />
        <NotConfigured />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Sales Invoices" subtitle="Every invoice you've raised, with what's still outstanding." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon="🧾" label="Total Invoices" value={String(totals.count)} accent="blue" />
        <StatCard icon="💰" label="Total Outstanding" value={money(totals.outstanding)} accent="orange" />
        <StatCard
          icon="⏰"
          label="Overdue"
          value={`${totals.overdueCount} · ${money(totals.overdueAmount)}`}
          accent="red"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === f.key ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          className={`${inputClass} w-64`}
          placeholder="Search invoice # or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading invoices…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          empty={search || statusFilter !== "all" ? "No invoices match this filter." : "No invoices yet."}
        />
      )}
    </>
  );
}
