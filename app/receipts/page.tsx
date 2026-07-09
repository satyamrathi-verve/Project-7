"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Customer, Invoice, Receipt, ReceiptAllocation, ReceiptMode } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { FormField, inputClass } from "@/components/FormField";
import { StatCard } from "@/components/StatCard";

type FormState = {
  receipt_no: string;
  receipt_date: string;
  mode: ReceiptMode;
  reference: string;
  amount: string;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function newReceiptNo() {
  return `RCT-${Math.floor(Math.random() * 900000 + 100000)}`;
}

function emptyForm(): FormState {
  return { receipt_no: newReceiptNo(), receipt_date: todayStr(), mode: "cash", reference: "", amount: "" };
}

type InvoiceRow = { invoice: Invoice; outstanding: number; allocation: string };

const STATUS_BADGE: Record<string, string> = {
  open: "bg-info-bg text-info",
  partial: "bg-warning-bg text-warning",
  overdue: "bg-danger-bg text-danger",
  paid: "bg-success-bg text-success",
};

export default function ReceiptEntryPage() {
  const [pageLoading, setPageLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([]);
  const [allAllocations, setAllAllocations] = useState<ReceiptAllocation[]>([]);
  const [openInvoiceCount, setOpenInvoiceCount] = useState(0);

  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<InvoiceRow[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [duplicateAck, setDuplicateAck] = useState(false);

  async function loadAll() {
    if (!supabase) return;
    setPageLoading(true);
    const [{ data: customerData }, { data: receiptData }, { data: allocationData }, { count }] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("receipts").select("*").order("receipt_date", { ascending: false }),
      supabase.from("receipt_allocations").select("*"),
      supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["open", "partial", "overdue"]),
    ]);
    setCustomers((customerData as Customer[]) ?? []);
    setAllReceipts((receiptData as Receipt[]) ?? []);
    setAllAllocations((allocationData as ReceiptAllocation[]) ?? []);
    setOpenInvoiceCount(count ?? 0);
    setPageLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const customerLookup = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.gstin ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [customerSearch, customers]);

  async function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    setDuplicateAck(false);
    await loadCustomerInvoices(c.id);
  }

  async function loadCustomerInvoices(customerId: string) {
    if (!supabase) return;
    setLoadingInvoices(true);
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("customer_id", customerId)
      .in("status", ["open", "partial", "overdue"])
      .order("due_date", { ascending: true });

    const rows: InvoiceRow[] = ((invoices ?? []) as Invoice[])
      .map((invoice) => {
        const allocated = allAllocations
          .filter((a) => a.invoice_id === invoice.id)
          .reduce((sum, a) => sum + Number(a.amount), 0);
        return { invoice, outstanding: Number(invoice.total) - allocated, allocation: "" };
      })
      .filter((r) => r.outstanding > 0.01);

    setCustomerInvoices(rows);
    setLoadingInvoices(false);
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setCustomerInvoices([]);
    setCustomerSearch("");
    setDuplicateAck(false);
  }

  function setAllocation(invoiceId: string, value: string) {
    setCustomerInvoices((rows) => rows.map((r) => (r.invoice.id === invoiceId ? { ...r, allocation: value } : r)));
  }

  function allocateFull(invoiceId: string) {
    setCustomerInvoices((rows) => {
      const currentTotal = rows.reduce((s, r) => (r.invoice.id === invoiceId ? s : s + (Number(r.allocation) || 0)), 0);
      const budget = (Number(form.amount) || 0) - currentTotal;
      return rows.map((r) =>
        r.invoice.id === invoiceId ? { ...r, allocation: String(Math.max(0, Math.min(r.outstanding, budget))) } : r
      );
    });
  }

  function autoAllocateOldest() {
    let budget = Number(form.amount) || 0;
    setCustomerInvoices((rows) =>
      rows.map((r) => {
        if (budget <= 0.01) return { ...r, allocation: "" };
        const take = Math.min(r.outstanding, budget);
        budget -= take;
        return { ...r, allocation: take > 0 ? String(Math.round(take * 100) / 100) : "" };
      })
    );
  }

  function clearAllocations() {
    setCustomerInvoices((rows) => rows.map((r) => ({ ...r, allocation: "" })));
  }

  const totalAllocated = customerInvoices.reduce((sum, r) => sum + (Number(r.allocation) || 0), 0);
  const receiptAmount = Number(form.amount) || 0;
  const pending = Math.max(0, receiptAmount - totalAllocated);
  const difference = receiptAmount - totalAllocated;

  const isDuplicate = useMemo(() => {
    if (!selectedCustomer || !receiptAmount || !form.receipt_date) return false;
    return allReceipts.some(
      (r) => r.customer_id === selectedCustomer.id && Number(r.amount) === receiptAmount && r.receipt_date === form.receipt_date
    );
  }, [allReceipts, selectedCustomer, receiptAmount, form.receipt_date]);

  const isFutureDate = form.receipt_date > todayStr();

  async function handleSave() {
    if (!supabase) return;
    setError(null);
    setSuccessMsg(null);

    if (!selectedCustomer) return setError("Search and select a customer first.");
    if (!form.receipt_no.trim()) return setError("Receipt number is required.");
    if (!receiptAmount || receiptAmount <= 0) return setError("Enter a positive amount received.");
    if (totalAllocated > receiptAmount + 0.01) return setError("Allocated total can't exceed the receipt amount.");
    for (const r of customerInvoices) {
      const alloc = Number(r.allocation) || 0;
      if (alloc > r.outstanding + 0.01) return setError(`Allocation for ${r.invoice.invoice_no} exceeds its outstanding amount.`);
    }
    if (isDuplicate && !duplicateAck) return setError("Possible duplicate receipt — tick the confirmation box below to save anyway.");

    setSaving(true);

    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        receipt_no: form.receipt_no.trim(),
        receipt_date: form.receipt_date,
        customer_id: selectedCustomer.id,
        amount: receiptAmount,
        mode: form.mode,
        reference: form.reference.trim() || null,
      })
      .select()
      .single();

    if (receiptError || !receipt) {
      setError(receiptError?.message ?? "Could not save the receipt.");
      setSaving(false);
      return;
    }

    const toAllocate = customerInvoices.filter((r) => (Number(r.allocation) || 0) > 0);
    if (toAllocate.length) {
      const { error: allocError } = await supabase.from("receipt_allocations").insert(
        toAllocate.map((r) => ({ receipt_id: receipt.id, invoice_id: r.invoice.id, amount: Number(r.allocation) }))
      );
      if (allocError) {
        setError(allocError.message);
        setSaving(false);
        return;
      }
      for (const r of toAllocate) {
        const remaining = r.outstanding - Number(r.allocation);
        await supabase.from("invoices").update({ status: remaining <= 0.01 ? "paid" : "partial" }).eq("id", r.invoice.id);
      }
    }

    setSaving(false);
    setSuccessMsg(`Receipt ${receipt.receipt_no} saved for ${selectedCustomer.name}.`);
    const keptCustomer = selectedCustomer;
    setForm(emptyForm());
    setDuplicateAck(false);
    await loadAll();
    if (keptCustomer) await loadCustomerInvoices(keptCustomer.id);
  }

  function resetForm() {
    setForm(emptyForm());
    clearCustomer();
    setError(null);
    setSuccessMsg(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        resetForm();
      } else if (e.key === "Escape") {
        resetForm();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function exportCsv() {
    const header = ["Receipt No", "Date", "Customer", "Amount", "Mode", "Reference"];
    const rows = allReceipts.map((r) => [
      r.receipt_no,
      r.receipt_date,
      customerLookup.get(r.customer_id)?.name ?? "",
      String(r.amount),
      r.mode,
      r.reference ?? "",
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipts-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- KPI derivations ----
  const today = todayStr();
  const todaysReceipts = allReceipts.filter((r) => r.receipt_date === today);
  const todaysCollection = todaysReceipts.reduce((s, r) => s + Number(r.amount), 0);
  const allocatedByReceipt = useMemo(() => {
    const map = new Map<string, number>();
    allAllocations.forEach((a) => map.set(a.receipt_id, (map.get(a.receipt_id) ?? 0) + Number(a.amount)));
    return map;
  }, [allAllocations]);
  const unallocatedGlobal = allReceipts.reduce(
    (sum, r) => sum + Math.max(0, Number(r.amount) - (allocatedByReceipt.get(r.id) ?? 0)),
    0
  );
  const last7 = useMemo(() => {
    const days: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push(allReceipts.filter((r) => r.receipt_date === key).reduce((s, r) => s + Number(r.amount), 0));
    }
    return days;
  }, [allReceipts]);

  const recentForCustomer = selectedCustomer
    ? allReceipts.filter((r) => r.customer_id === selectedCustomer.id).slice(0, 5)
    : [];
  const globalRecent = allReceipts.slice(0, 6);

  const customerOutstanding = selectedCustomer
    ? customerInvoices.reduce((sum, r) => sum + r.outstanding, 0)
    : 0;
  const availableCredit = selectedCustomer ? Number(selectedCustomer.credit_limit) - customerOutstanding : 0;
  const risk =
    !selectedCustomer || selectedCustomer.credit_limit <= 0
      ? null
      : customerOutstanding > selectedCustomer.credit_limit
      ? { label: "Over limit", cls: "bg-danger-bg text-danger" }
      : customerOutstanding > selectedCustomer.credit_limit * 0.8
      ? { label: "Watch", cls: "bg-warning-bg text-warning" }
      : { label: "Healthy", cls: "bg-success-bg text-success" };

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Receipt Entry" subtitle="Record payments and allocate them to invoices." />
        <NotConfigured />
      </>
    );
  }

  return (
    <div className="pb-28">
      <p className="mb-1 text-xs font-medium text-ink-muted">
        Dashboard <span className="mx-1">/</span> Accounts Receivable <span className="mx-1">/</span>{" "}
        <span className="text-ink-secondary">Receipt Entry</span>
      </p>
      <PageHeader
        title="Receipt Entry"
        subtitle="Record payments and allocate them against open invoices."
        action={
          <div className="flex gap-2">
            <button
              onClick={exportCsv}
              className="rounded-lg border border-ink-muted/40 bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-section"
            >
              Export CSV
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              + New Receipt
            </button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="🧾" label="Today's Receipts" value={String(todaysReceipts.length)} accent="blue" sparkline={last7} />
        <StatCard
          icon="💰"
          label="Today's Collection"
          value={`₹${todaysCollection.toLocaleString("en-IN")}`}
          accent="green"
          sparkline={last7}
        />
        <StatCard icon="📄" label="Open Invoices" value={String(openInvoiceCount)} accent="orange" />
        <StatCard
          icon="⚠️"
          label="Unallocated Amount"
          value={`₹${unallocatedGlobal.toLocaleString("en-IN")}`}
          accent={unallocatedGlobal > 0 ? "red" : "green"}
        />
      </div>

      {successMsg && (
        <div className="mb-4 rounded-lg bg-success-bg px-4 py-3 text-sm font-medium text-success">{successMsg}</div>
      )}
      {error && <div className="mb-4 rounded-lg bg-danger-bg px-4 py-3 text-sm font-medium text-danger">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
        {/* LEFT 70% */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-muted">Receipt Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Receipt No">
                <input className={inputClass} value={form.receipt_no} onChange={(e) => setForm({ ...form, receipt_no: e.target.value })} />
              </FormField>
              <FormField label="Receipt Date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.receipt_date}
                  onChange={(e) => setForm({ ...form, receipt_date: e.target.value })}
                />
              </FormField>
              <FormField label="Payment Mode">
                <select className={inputClass} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as ReceiptMode })}>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                  <option value="neft">NEFT</option>
                </select>
              </FormField>
              <FormField label="Reference Number">
                <input
                  className={inputClass}
                  placeholder="Cheque no. / UTR / UPI ref"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                />
              </FormField>
              <FormField label="Amount Received">
                <input type="number" className={inputClass} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </FormField>
            </div>
            {isFutureDate && (
              <p className="mt-3 text-xs font-medium text-warning">⚠ Receipt date is in the future — double-check before saving.</p>
            )}
          </div>

          {/* Customer search */}
          <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-muted">Customer</h3>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-xl border border-hairline bg-section px-4 py-3">
                <div>
                  <p className="font-semibold text-ink">{selectedCustomer.name}</p>
                  <p className="text-xs text-ink-muted">
                    {selectedCustomer.code} {selectedCustomer.gstin ? `· GST ${selectedCustomer.gstin}` : ""}
                  </p>
                </div>
                <button onClick={clearCustomer} className="text-sm font-medium text-brand hover:underline">
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className={`${inputClass} w-full`}
                  placeholder="Search by name, code, GST, phone or email…"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                />
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-hairline bg-surface shadow-lg">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-section"
                      >
                        <span className="text-sm font-medium text-ink">{c.name}</span>
                        <span className="text-xs text-ink-muted">
                          {c.code} {c.phone ? `· ${c.phone}` : ""} {c.email ? `· ${c.email}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isDuplicate && (
              <div className="mt-4 rounded-lg bg-warning-bg px-4 py-3">
                <p className="text-sm font-medium text-warning">
                  ⚠ Possible duplicate — a receipt for this customer with the same amount and date already exists.
                </p>
                <label className="mt-2 flex items-center gap-2 text-sm text-warning">
                  <input type="checkbox" checked={duplicateAck} onChange={(e) => setDuplicateAck(e.target.checked)} />
                  This is not a duplicate, save anyway
                </label>
              </div>
            )}
          </div>

          {/* Invoice allocation grid */}
          <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Invoice Allocation</h3>
              {selectedCustomer && customerInvoices.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={autoAllocateOldest} className="rounded-lg border border-ink-muted/40 px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-section">
                    Allocate Oldest First
                  </button>
                  <button onClick={clearAllocations} className="rounded-lg border border-ink-muted/40 px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-section">
                    Clear
                  </button>
                </div>
              )}
            </div>

            {!selectedCustomer ? (
              <p className="text-sm text-ink-muted">Select a customer above to see their open invoices.</p>
            ) : loadingInvoices ? (
              <p className="text-sm text-ink-muted">Loading invoices…</p>
            ) : customerInvoices.length === 0 ? (
              <p className="text-sm text-ink-muted">This customer has no open invoices.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-hairline">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="border-b border-hairline bg-section text-left">
                      <th className="px-3 py-2 font-semibold text-ink-secondary">Invoice</th>
                      <th className="px-3 py-2 font-semibold text-ink-secondary">Due Date</th>
                      <th className="px-3 py-2 font-semibold text-ink-secondary">Status</th>
                      <th className="px-3 py-2 font-semibold text-ink-secondary">Outstanding</th>
                      <th className="px-3 py-2 font-semibold text-ink-secondary">Allocate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerInvoices.map((r) => {
                      const daysOverdue = Math.floor((Date.now() - new Date(r.invoice.due_date).getTime()) / 86400000);
                      const progress = Math.min(100, ((Number(r.allocation) || 0) / r.outstanding) * 100);
                      return (
                        <tr key={r.invoice.id} className="border-b border-hairline/50 last:border-0">
                          <td className="px-3 py-2 font-medium text-ink-secondary">{r.invoice.invoice_no}</td>
                          <td className="px-3 py-2 text-ink-secondary">
                            {new Date(r.invoice.due_date).toLocaleDateString("en-IN")}
                            {daysOverdue > 0 && <span className="ml-1 text-xs font-medium text-danger">({daysOverdue}d overdue)</span>}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.invoice.status]}`}>
                              {r.invoice.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-ink-secondary">₹{r.outstanding.toLocaleString("en-IN")}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                className={`${inputClass} w-28`}
                                value={r.allocation}
                                onChange={(e) => setAllocation(r.invoice.id, e.target.value)}
                                placeholder="0"
                              />
                              <button onClick={() => allocateFull(r.invoice.id)} className="text-xs font-medium text-brand hover:underline">
                                Full
                              </button>
                            </div>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-sidebar">
                              <div
                                className={`h-1.5 rounded-full ${progress >= 100 ? "bg-success" : "bg-brand"}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-hairline bg-section text-sm font-semibold text-ink-secondary">
                      <td className="px-3 py-2" colSpan={3}>
                        Totals
                      </td>
                      <td className="px-3 py-2">₹{customerInvoices.reduce((s, r) => s + r.outstanding, 0).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2">₹{totalAllocated.toLocaleString("en-IN")}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 30% */}
        <div className="space-y-6 lg:col-span-3">
          {selectedCustomer ? (
            <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">Customer Snapshot</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Outstanding</dt>
                  <dd className="font-semibold text-ink">₹{customerOutstanding.toLocaleString("en-IN")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Credit Limit</dt>
                  <dd className="font-semibold text-ink">₹{Number(selectedCustomer.credit_limit).toLocaleString("en-IN")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Available Credit</dt>
                  <dd className={`font-semibold ${availableCredit < 0 ? "text-danger" : "text-ink"}`}>
                    ₹{availableCredit.toLocaleString("en-IN")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Credit Days</dt>
                  <dd className="font-semibold text-ink">{selectedCustomer.credit_days} days</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">PAN</dt>
                  <dd className="font-semibold text-ink">{selectedCustomer.pan ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Customer Since</dt>
                  <dd className="font-semibold text-ink">
                    {new Date(selectedCustomer.created_at).toLocaleDateString("en-IN")}
                  </dd>
                </div>
                {risk && (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Risk</dt>
                    <dd>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${risk.cls}`}>{risk.label}</span>
                    </dd>
                  </div>
                )}
              </dl>
              <div className="mt-4 flex gap-2 border-t border-hairline/50 pt-4">
                {selectedCustomer.phone && (
                  <a href={`tel:${selectedCustomer.phone}`} className="flex-1 rounded-lg border border-ink-muted/40 px-3 py-1.5 text-center text-xs font-medium text-ink-secondary hover:bg-section">
                    Call
                  </a>
                )}
                {selectedCustomer.email && (
                  <a href={`mailto:${selectedCustomer.email}`} className="flex-1 rounded-lg border border-ink-muted/40 px-3 py-1.5 text-center text-xs font-medium text-ink-secondary hover:bg-section">
                    Email
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-muted/40 bg-surface p-5 text-center text-sm text-ink-muted">
              Search a customer to see their outstanding, credit and contact details here.
            </div>
          )}

          <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">
              {selectedCustomer ? `${selectedCustomer.name}'s Recent Receipts` : "Recent Receipts"}
            </h3>
            {(selectedCustomer ? recentForCustomer : globalRecent).length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing yet.</p>
            ) : (
              <ul className="space-y-2">
                {(selectedCustomer ? recentForCustomer : globalRecent).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-ink-secondary">{r.receipt_no}</p>
                      <p className="text-xs text-ink-muted">
                        {!selectedCustomer && `${customerLookup.get(r.customer_id)?.name ?? "—"} · `}
                        {new Date(r.receipt_date).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <span className="font-semibold text-ink">₹{Number(r.amount).toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Sticky live summary bar */}
      <div className="fixed bottom-0 left-60 right-0 border-t border-hairline bg-surface/95 px-8 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-ink-muted">Receipt Amount </span>
              <span className="font-semibold text-ink">₹{receiptAmount.toLocaleString("en-IN")}</span>
            </div>
            <div>
              <span className="text-ink-muted">Allocated </span>
              <span className="font-semibold text-ink">₹{totalAllocated.toLocaleString("en-IN")}</span>
            </div>
            <div>
              <span className="text-ink-muted">Pending </span>
              <span className={`font-semibold ${pending > 0 ? "text-warning" : "text-ink"}`}>₹{pending.toLocaleString("en-IN")}</span>
            </div>
            <div>
              <span className="text-ink-muted">Difference </span>
              <span className={`font-semibold ${Math.abs(difference) < 0.01 ? "text-success" : "text-danger"}`}>
                ₹{difference.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-ink-muted sm:inline">Ctrl+S Save · Ctrl+N New · Esc Cancel</span>
            <button
              onClick={handleSave}
              disabled={saving || pageLoading}
              className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Receipt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
