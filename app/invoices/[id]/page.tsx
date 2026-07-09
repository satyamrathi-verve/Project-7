"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Customer, Invoice, InvoiceItem } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { InvoiceForm, type InvoiceFormValues } from "@/components/InvoiceForm";

export default function InvoiceEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [initialValues, setInitialValues] = useState<InvoiceFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      setLoading(true);
      setError(null);

      const [invRes, itemsRes, custRes] = await Promise.all([
        supabase.from("invoices").select("*").eq("id", params.id).single(),
        supabase.from("invoice_items").select("*").eq("invoice_id", params.id).order("id"),
        supabase.from("customers").select("*").order("name", { ascending: true }),
      ]);

      if (invRes.error || !invRes.data) {
        setError(invRes.error?.message ?? "Invoice not found.");
        setLoading(false);
        return;
      }

      const invoice = invRes.data as Invoice;
      const items = (itemsRes.data as InvoiceItem[]) ?? [];
      const taxPercent =
        Number(invoice.subtotal) > 0 ? ((Number(invoice.tax_amount) / Number(invoice.subtotal)) * 100).toFixed(2) : "18";

      setCustomers((custRes.data as Customer[]) ?? []);
      setInitialValues({
        invoiceNo: invoice.invoice_no,
        customerId: invoice.customer_id,
        invoiceDate: invoice.invoice_date.slice(0, 10),
        dueDate: invoice.due_date.slice(0, 10),
        taxPercent,
        notes: invoice.notes ?? "",
        status: invoice.status,
        items:
          items.length > 0
            ? items.map((it) => ({ description: it.description, qty: String(it.qty), rate: String(it.rate) }))
            : [{ description: "", qty: "1", rate: "" }],
      });
      setLoading(false);
    }
    load();
  }, [params.id]);

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
      <PageHeader title="Edit Invoice" subtitle="Customer, line items, and tax — same form as creating one." />
      {loading ? (
        <p className="text-sm text-ink-muted">Loading invoice…</p>
      ) : error || !initialValues ? (
        <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
          {error ?? "Invoice not found."}
        </p>
      ) : (
        <InvoiceForm
          customers={customers}
          mode="edit"
          invoiceId={params.id}
          initialValues={initialValues}
          onSaved={() => router.push("/invoices")}
          onCancel={() => router.push("/invoices")}
        />
      )}
    </>
  );
}
