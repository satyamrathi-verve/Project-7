"use client";

import { useEffect, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Customer, Invoice } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { DataTable, type Column } from "@/components/DataTable";
import { FormField, inputClass } from "@/components/FormField";

type FormState = {
  code: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  credit_limit: string;
  credit_days: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  credit_limit: "0",
  credit_days: "30",
};

export default function CustomerMasterPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCustomers() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });
    if (error) setError(error.message);
    else setCustomers(data as Customer[]);
    setLoading(false);
  }

  async function loadCustomerInvoices(customerId: string) {
    if (!supabase) return;
    setLoadingInvoices(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("customer_id", customerId)
      .order("invoice_date", { ascending: false });
    if (error) setError(error.message);
    else setInvoices(data as Invoice[]);
    setLoadingInvoices(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(c: Customer) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      name: c.name,
      contact_person: c.contact_person ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      credit_limit: String(c.credit_limit ?? 0),
      credit_days: String(c.credit_days ?? 30),
    });
    setShowForm(true);
  }

  function selectCustomer(c: Customer) {
    setSelectedCustomerId(c.id);
    loadCustomerInvoices(c.id);
  }

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    setError(null);

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      credit_limit: Number(form.credit_limit) || 0,
      credit_days: Number(form.credit_days) || 0,
    };

    const { error } = editingId
      ? await supabase.from("customers").update(payload).eq("id", editingId)
      : await supabase.from("customers").insert(payload);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setShowForm(false);
    await loadCustomers();
  }

  const columns: Column<Customer>[] = [
    { key: "code", header: "Code" },
    { key: "name", header: "Name" },
    {
      key: "contact_person",
      header: "Contact",
      render: (c) => c.contact_person || c.phone || c.email || "—",
    },
    {
      key: "credit_days",
      header: "Credit Days",
      render: (c) => `${c.credit_days} days`,
    },
    {
      key: "credit_limit",
      header: "Credit Limit",
      render: (c) => `₹${Number(c.credit_limit).toLocaleString("en-IN")}`,
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <div className="flex gap-3">
          <button
            onClick={() => selectCustomer(c)}
            className="text-sm font-medium text-brand hover:underline"
          >
            View Sales
          </button>
          <button
            onClick={() => openEdit(c)}
            className="text-sm font-medium text-brand hover:underline"
          >
            Edit
          </button>
        </div>
      ),
    },
  ];

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Customer Master" subtitle="Every customer your team invoices." />
        <NotConfigured />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Customer Master"
        subtitle="Every customer your team invoices."
        action={
          <button
            onClick={openAdd}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            + Add Customer
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-slate-400">Loading customers…</p>
      ) : (
        <>
          <DataTable columns={columns} rows={customers} empty="No customers yet. Add one to get started." />

          {selectedCustomerId && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Sales Invoices</h3>
                  <p className="text-sm text-slate-500">Invoices linked to the selected customer.</p>
                </div>
              </div>

              {loadingInvoices ? (
                <p className="text-sm text-slate-400">Loading invoices…</p>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-slate-500">No invoices found for this customer.</p>
              ) : (
                <DataTable
                  columns={[
                    { key: "invoice_no", header: "Invoice No" },
                    { key: "invoice_date", header: "Date" },
                    { key: "due_date", header: "Due Date" },
                    { key: "total", header: "Total", render: (row) => `₹${Number(row.total).toLocaleString("en-IN")}` },
                    { key: "status", header: "Status" },
                  ]}
                  rows={invoices}
                  empty="No invoices for this customer."
                />
              )}
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {editingId ? "Edit Customer" : "Add Customer"}
            </h3>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-4">
              <FormField label="Code">
                <input
                  className={inputClass}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </FormField>
              <FormField label="Name">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </FormField>
              <FormField label="Contact Person">
                <input
                  className={inputClass}
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                />
              </FormField>
              <FormField label="Phone">
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </FormField>
              <FormField label="Email">
                <input
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormField>
              <FormField label="Credit Days">
                <input
                  type="number"
                  className={inputClass}
                  value={form.credit_days}
                  onChange={(e) => setForm({ ...form, credit_days: e.target.value })}
                />
              </FormField>
              <FormField label="Credit Limit">
                <input
                  type="number"
                  className={inputClass}
                  value={form.credit_limit}
                  onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                />
              </FormField>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.code || !form.name}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
