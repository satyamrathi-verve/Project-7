"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Invoice } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { FormField, inputClass } from "@/components/FormField";

export default function InvoiceEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadInvoice() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from("invoices").select("*").eq("id", params.id).single();
    if (error) setError(error.message);
    else setInvoice(data as Invoice);
    setLoading(false);
  }

  useEffect(() => {
    loadInvoice();
  }, [params.id]);

  async function handleSave() {
    if (!supabase || !invoice) return;
    setSaving(true);
    const { error } = await supabase
      .from("invoices")
      .update({
        invoice_no: invoice.invoice_no,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        total: invoice.total,
        status: invoice.status,
      })
      .eq("id", invoice.id);
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/invoices");
  }

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Edit Invoice" subtitle="Edit the selected sales invoice." />
        <NotConfigured />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit Invoice" subtitle="Edit the selected sales invoice." />
      {loading ? (
        <p className="text-sm text-slate-400">Loading invoice…</p>
      ) : !invoice ? (
        <p className="text-sm text-slate-500">Invoice not found.</p>
      ) : (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <FormField label="Invoice No">
            <input
              className={inputClass}
              value={invoice.invoice_no}
              onChange={(e) => setInvoice({ ...invoice, invoice_no: e.target.value })}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Invoice Date">
              <input
                type="date"
                className={inputClass}
                value={invoice.invoice_date}
                onChange={(e) => setInvoice({ ...invoice, invoice_date: e.target.value })}
              />
            </FormField>
            <FormField label="Due Date">
              <input
                type="date"
                className={inputClass}
                value={invoice.due_date}
                onChange={(e) => setInvoice({ ...invoice, due_date: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Total">
              <input
                type="number"
                className={inputClass}
                value={invoice.total}
                onChange={(e) => setInvoice({ ...invoice, total: Number(e.target.value) })}
              />
            </FormField>
            <FormField label="Status">
              <select
                className={inputClass}
                value={invoice.status}
                onChange={(e) => setInvoice({ ...invoice, status: e.target.value as Invoice["status"] })}
              >
                <option value="open">open</option>
                <option value="partial">partial</option>
                <option value="paid">paid</option>
                <option value="overdue">overdue</option>
              </select>
            </FormField>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => router.push("/invoices")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
