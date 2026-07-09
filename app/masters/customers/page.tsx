"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Customer, Invoice } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { DataTable, type Column } from "@/components/DataTable";
import { FormField, inputClass } from "@/components/FormField";

const CUSTOMER_EXPORT_COLUMNS: (keyof Customer)[] = [
  "code",
  "name",
  "gstin",
  "pan",
  "contact_person",
  "email",
  "phone",
  "address",
  "credit_limit",
  "credit_days",
  "opening_balance",
];

function toCsvValue(value: unknown) {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function exportCustomersCsv(rows: Customer[]) {
  const header = CUSTOMER_EXPORT_COLUMNS.join(",");
  const lines = rows.map((row) =>
    CUSTOMER_EXPORT_COLUMNS.map((col) => toCsvValue(row[col])).join(",")
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type FormState = {
  code: string;
  name: string;
  gstin: string;
  pan: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  credit_limit: string;
  credit_days: string;
  opening_balance: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  gstin: "",
  pan: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  credit_limit: "0",
  credit_days: "30",
  opening_balance: "0",
};

const AVATAR_GRADIENTS = [
  "from-pink-400 to-rose-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-fuchsia-400 to-pink-500",
  "from-cyan-400 to-sky-500",
  "from-lime-400 to-emerald-500",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? [parts[0][0], parts[1][0]] : [parts[0]?.[0] ?? "?"];
  return chars.join("").toUpperCase();
}

function avatarGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

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
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
      gstin: c.gstin ?? "",
      pan: c.pan ?? "",
      contact_person: c.contact_person ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      credit_limit: String(c.credit_limit ?? 0),
      credit_days: String(c.credit_days ?? 30),
      opening_balance: String(c.opening_balance ?? 0),
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
      gstin: form.gstin.trim() || null,
      pan: form.pan.trim() || null,
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      credit_limit: Number(form.credit_limit) || 0,
      credit_days: Number(form.credit_days) || 0,
      opening_balance: Number(form.opening_balance) || 0,
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

  const filteredCustomers = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.gstin ?? "").toLowerCase().includes(q) ||
      (c.contact_person ?? "").toLowerCase().includes(q)
    );
  });

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Customer",
      render: (c) => (
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white ${avatarGradient(c.id)}`}
          >
            {initials(c.name)}
          </div>
          <div>
            <p className="font-medium text-ink">{c.name}</p>
            <p className="text-xs text-ink-muted">{c.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: "credit_limit",
      header: "Credit Limit",
      render: (c) => (
        <span className="font-medium text-ink-secondary">
          ₹{Number(c.credit_limit).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "credit_days",
      header: "Terms",
      render: (c) => (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-2.5 py-1 text-xs font-medium text-info">
          <span className="h-1.5 w-1.5 rounded-full bg-info" />
          {c.credit_days}-day credit
        </span>
      ),
    },
    {
      key: "contact_person",
      header: "Contact",
      render: (c) => c.contact_person || "—",
    },
    {
      key: "email",
      header: "Email",
      render: (c) => c.email || "—",
    },
    {
      key: "phone",
      header: "Phone number",
      render: (c) => c.phone || "—",
    },
    {
      key: "address",
      header: "Address",
      render: (c) => (
        <span className="block max-w-[220px] truncate" title={c.address ?? undefined}>
          {c.address || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (c) => (
        <div className="relative flex justify-end">
          <button
            onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
            className="rounded-lg p-1.5 text-ink-muted transition-colors duration-150 hover:bg-black/[0.04] hover:text-ink-secondary"
            aria-label="Row actions"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 6a2 2 0 100-4 2 2 0 000 4zM10 12a2 2 0 100-4 2 2 0 000 4zM10 18a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </button>
          {openMenuId === c.id && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
              <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-lg border border-hairline bg-surface py-1 shadow-card-hover">
                <button
                  onClick={() => {
                    selectCustomer(c);
                    setOpenMenuId(null);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-ink-secondary hover:bg-black/[0.03]"
                >
                  View Sales
                </button>
                <button
                  onClick={() => {
                    openEdit(c);
                    setOpenMenuId(null);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-ink-secondary hover:bg-black/[0.03]"
                >
                  Edit
                </button>
              </div>
            </>
          )}
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
        title="Customers"
        subtitle="Every customer your team invoices."
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM14 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM10 11c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zM4.5 12.13c.71-.5 2.28-1.06 4.11-1.24a7.7 7.7 0 00-1.61 2.11H2v-.06c0-.29.72-.6 2.5-.81zM17.5 12.13c1.78.21 2.5.52 2.5.81V13h-5c-.4-.79-.95-1.5-1.61-2.11 1.83.18 3.4.74 4.11 1.24z" />
          </svg>
        }
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/upload"
              className="rounded-lg border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-black/[0.03]"
            >
              Import
            </Link>
            <button
              onClick={() => exportCustomersCsv(filteredCustomers)}
              disabled={customers.length === 0}
              className="rounded-lg border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export
            </button>
            <button
              onClick={openAdd}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-dark hover:scale-[1.02] active:scale-[0.98]"
            >
              + Add Customer
            </button>
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-ink-muted">Loading customers…</p>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer…"
                className={`${inputClass} w-full pl-9`}
              />
            </div>
            <span className="whitespace-nowrap text-sm text-ink-muted">
              {filteredCustomers.length} of {customers.length} customers
            </span>
          </div>

          <DataTable
            columns={columns}
            rows={filteredCustomers}
            empty={search ? "No customers match your search." : "No customers yet. Add one to get started."}
          />

          {selectedCustomerId && (
            <div className="mt-6 rounded-xl border border-hairline bg-surface p-5 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-ink">Sales Invoices</h3>
                  <p className="text-sm text-ink-muted">Invoices linked to the selected customer.</p>
                </div>
              </div>

              {loadingInvoices ? (
                <p className="text-sm text-ink-muted">Loading invoices…</p>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-ink-muted">No invoices found for this customer.</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-hairline bg-surface p-6 shadow-card-hover">
            <h3 className="text-lg font-semibold tracking-tight text-ink">
              {editingId ? "Edit Customer" : "Add Customer"}
            </h3>

            {error && (
              <p className="mt-3 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Basic Details
            </p>
            <div className="mt-2 grid grid-cols-2 gap-4">
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
              <div className="col-span-2">
                <FormField label="Address">
                  <input
                    className={inputClass}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </FormField>
              </div>
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Tax Details
            </p>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <FormField label="GSTIN">
                <input
                  className={inputClass}
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                />
              </FormField>
              <FormField label="PAN">
                <input
                  className={inputClass}
                  value={form.pan}
                  onChange={(e) => setForm({ ...form, pan: e.target.value })}
                />
              </FormField>
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Credit Terms
            </p>
            <div className="mt-2 grid grid-cols-3 gap-4">
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
              <FormField label="Opening Balance">
                <input
                  type="number"
                  className={inputClass}
                  value={form.opening_balance}
                  onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
                />
              </FormField>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-black/[0.04]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.code || !form.name}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-dark hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
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
