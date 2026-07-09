"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Company, Customer, Invoice, ReceiptAllocation } from "@/lib/types";
import { NotConfigured } from "@/components/NotConfigured";

/*
  Simulated payment page reached from an invoice's "Pay Now" link. There is no real
  gateway, but the settlement is 100% real against the live database: on success it
    1. creates a receipt (mode=upi) for the invoice's outstanding amount,
    2. allocates that receipt against the invoice (knock-off), and
    3. flips the invoice status to 'paid'.
  Outstanding is recomputed from the DB here (total − allocated), never trusted from
  the URL, so the amount is always correct even after partial payments.
*/

function money(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function newReceiptNo() {
  return `RCT-${Math.floor(Math.random() * 900000 + 100000)}`;
}

type Loaded = {
  invoice: Invoice;
  company: Company | null;
  customer: Customer | null;
  outstanding: number;
};

export default function PayInvoicePage() {
  const params = useParams();
  const id = String(params?.id ?? "");

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState<{ receiptNo: string; amount: number } | null>(null);

  async function load() {
    if (!supabase || !id) return;
    setLoading(true);
    setError(null);

    const { data: invoice, error: invErr } = await supabase.from("invoices").select("*").eq("id", id).single();
    if (invErr || !invoice) {
      setError(invErr?.message ?? "Invoice not found.");
      setLoading(false);
      return;
    }

    const [{ data: company }, { data: customer }, { data: allocations }] = await Promise.all([
      supabase.from("company").select("*").limit(1).maybeSingle(),
      supabase.from("customers").select("*").eq("id", (invoice as Invoice).customer_id).maybeSingle(),
      supabase.from("receipt_allocations").select("amount").eq("invoice_id", id),
    ]);

    const allocated = ((allocations as Pick<ReceiptAllocation, "amount">[]) ?? []).reduce(
      (s, a) => s + Number(a.amount),
      0
    );
    const outstanding = Number((invoice as Invoice).total) - allocated;

    setData({
      invoice: invoice as Invoice,
      company: (company as Company) ?? null,
      customer: (customer as Customer) ?? null,
      outstanding,
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handlePay() {
    if (!supabase || !data) return;
    const { invoice, outstanding } = data;
    if (outstanding <= 0) return;

    setProcessing(true);
    setError(null);

    const receiptNo = newReceiptNo();

    // 1. Create the receipt.
    const { data: receipt, error: rErr } = await supabase
      .from("receipts")
      .insert({
        receipt_no: receiptNo,
        receipt_date: todayStr(),
        customer_id: invoice.customer_id,
        amount: outstanding,
        mode: "upi",
        reference: `Online payment for ${invoice.invoice_no}`,
      })
      .select()
      .single();

    if (rErr || !receipt) {
      setProcessing(false);
      setError(rErr?.message ?? "Could not create receipt.");
      return;
    }

    // 2. Knock off the invoice with an allocation.
    const { error: aErr } = await supabase.from("receipt_allocations").insert({
      receipt_id: (receipt as { id: string }).id,
      invoice_id: invoice.id,
      amount: outstanding,
    });

    // 3. Mark the invoice paid.
    const { error: uErr } = await supabase.from("invoices").update({ status: "paid" }).eq("id", invoice.id);

    setProcessing(false);

    if (aErr || uErr) {
      setError((aErr ?? uErr)?.message ?? "Payment recorded but knock-off failed.");
      return;
    }

    setDone({ receiptNo, amount: outstanding });
    await load();
  }

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-md py-16">
        <NotConfigured />
      </div>
    );
  }

  if (loading) {
    return <div className="mx-auto max-w-md py-16 text-center text-sm text-ink-muted">Loading payment…</div>;
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="rounded-xl border border-danger-border bg-danger-bg p-4 text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { invoice, company, customer, outstanding } = data;
  const alreadyPaid = outstanding <= 0 || invoice.status === "paid";

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xl">
        {/* Gateway header */}
        <div className="bg-brand px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{company?.name ?? "Secure Checkout"}</span>
            <span className="rounded-full bg-surface/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              Demo Secure Pay
            </span>
          </div>
          <p className="mt-3 text-xs text-white/70">Paying for</p>
          <p className="text-lg font-bold">Invoice {invoice.invoice_no}</p>
        </div>

        <div className="px-6 py-6">
          {done ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-2xl">✓</div>
              <p className="mt-4 text-lg font-bold text-ink">Payment successful</p>
              <p className="mt-1 text-sm text-ink-muted">
                {money(done.amount)} received · Receipt {done.receiptNo}
              </p>
              <p className="mt-1 text-sm text-ink-muted">Invoice {invoice.invoice_no} is now marked Paid.</p>
              <Link
                href={`/invoices/${invoice.id}/print`}
                className="mt-6 inline-block rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                View invoice
              </Link>
            </div>
          ) : alreadyPaid ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-2xl">✓</div>
              <p className="mt-4 text-lg font-bold text-ink">Already paid</p>
              <p className="mt-1 text-sm text-ink-muted">There&apos;s nothing outstanding on this invoice.</p>
              <Link
                href={`/invoices/${invoice.id}/print`}
                className="mt-6 inline-block rounded-lg border border-ink-muted/40 px-5 py-2 text-sm font-medium text-ink-secondary hover:bg-section"
              >
                View invoice
              </Link>
            </div>
          ) : (
            <>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Billed to</dt>
                  <dd className="font-medium text-ink">{customer?.name ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Invoice</dt>
                  <dd className="text-ink">{invoice.invoice_no}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-hairline pt-3">
                  <dt className="text-ink-muted">Amount due</dt>
                  <dd className="text-2xl font-bold text-ink">{money(outstanding)}</dd>
                </div>
              </dl>

              {error && <p className="mt-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

              <button
                onClick={handlePay}
                disabled={processing}
                className="mt-6 w-full rounded-xl bg-success py-3 text-sm font-semibold text-white transition-colors hover:bg-success disabled:opacity-50"
              >
                {processing ? "Processing…" : `Pay ${money(outstanding)} securely`}
              </button>
              <p className="mt-3 text-center text-xs text-ink-muted">
                Simulated gateway · settles instantly against the live ledger
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
