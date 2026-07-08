"use client";

import { useEffect, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Invoice } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { DataTable, type Column } from "@/components/DataTable";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadInvoices() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("*, customer_id")
      .order("invoice_date", { ascending: false });
    if (error) setError(error.message);
    else setInvoices(data as Invoice[]);
    setLoading(false);
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  const columns: Column<Invoice>[] = [
    { key: "invoice_no", header: "Invoice No" },
    { key: "invoice_date", header: "Date" },
    { key: "customer_id", header: "Customer ID" },
    {
      key: "total",
      header: "Total",
      render: (invoice) => `₹${invoice.total.toLocaleString("en-IN")}`,
    },
    { key: "status", header: "Status" },
    {
      key: "actions",
      header: "",
      render: (invoice) => (
        <a
          href={`/invoices/${invoice.id}`}
          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          Edit
        </a>
      ),
    },
  ];

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Sales Invoices" subtitle="Invoice list and status overview." />
        <NotConfigured />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Sales Invoices" subtitle="Invoice list and status overview." />
      {loading ? (
        <p className="text-sm text-slate-400">Loading invoices…</p>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : (
        <DataTable columns={columns} rows={invoices} empty="No sales invoices found." />
      )}
    </>
  );
}
