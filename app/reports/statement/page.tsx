"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Customer, Invoice, Receipt } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { inputClass } from "@/components/FormField";

type LedgerRow = {
  id: string;
  date: string;
  particulars: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
};

function formatMoney(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CustomerStatementPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        return;
      }
      setLoadingStatement(true);
      setError(null);
      const [invRes, rcptRes] = await Promise.all([
        supabase.from("invoices").select("*").eq("customer_id", selectedId).order("invoice_date", { ascending: true }),
        supabase.from("receipts").select("*").eq("customer_id", selectedId).order("receipt_date", { ascending: true }),
      ]);
      if (invRes.error) setError(invRes.error.message);
      else setInvoices(invRes.data as Invoice[]);
      if (rcptRes.error) setError(rcptRes.error.message);
      else setReceipts(rcptRes.data as Receipt[]);
      setLoadingStatement(false);
    }
    loadStatement();
  }, [selectedId]);

  const customer = customers.find((c) => c.id === selectedId) ?? null;

  const { rows, closingBalance } = useMemo(() => {
    if (!customer) return { rows: [] as LedgerRow[], closingBalance: 0 };

    const entries = [
      ...invoices.map((inv) => ({
        date: inv.invoice_date,
        particulars: "Invoice",
        ref: inv.invoice_no,
        debit: inv.total,
        credit: 0,
        sortKey: `${inv.invoice_date}-0`,
      })),
      ...receipts.map((r) => ({
        date: r.receipt_date,
        particulars: "Receipt",
        ref: r.receipt_no,
        debit: 0,
        credit: r.amount,
        sortKey: `${r.receipt_date}-1`,
      })),
    ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    let running = customer.opening_balance;
    const built: LedgerRow[] = [
      {
        id: "opening",
        date: "",
        particulars: "Opening Balance",
        ref: "—",
        debit: 0,
        credit: 0,
        balance: running,
      },
    ];

    entries.forEach((e, i) => {
      running = running + e.debit - e.credit;
      built.push({
        id: `${e.particulars}-${e.ref}-${i}`,
        date: e.date,
        particulars: e.particulars,
        ref: e.ref,
        debit: e.debit,
        credit: e.credit,
        balance: running,
      });
    });

    return { rows: built, closingBalance: running };
  }, [customer, invoices, receipts]);

  const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Customer Statement" subtitle="A running ledger of invoices and receipts for one customer." />
        <NotConfigured />
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customer Statement</h2>
          <p className="mt-1 text-sm text-slate-500">
            A running ledger of invoices (debits) and receipts (credits) for one customer.
          </p>
        </div>
        {customer && (
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Print Statement
          </button>
        )}
      </div>

      <div className="mb-6 max-w-sm print:hidden">
        <select
          className={inputClass}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loadingCustomers}
        >
          <option value="">
            {loadingCustomers ? "Loading customers..." : "Select a customer..."}
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!customer ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
          Select a customer above to view their statement.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 print:border-0 print:p-0 print:shadow-none">
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{customer.name}</h3>
              <p className="text-sm text-slate-500">
                {customer.code}
                {customer.gstin ? ` · GSTIN ${customer.gstin}` : ""}
              </p>
              {customer.address && <p className="mt-1 text-sm text-slate-500">{customer.address}</p>}
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>Contact: {customer.contact_person || "—"}</p>
              <p>{customer.email || "—"}</p>
              <p>{customer.phone || "—"}</p>
            </div>
          </div>

          {loadingStatement ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading statement…</p>
          ) : (
            <>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
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
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 text-slate-700">{r.date ? formatDate(r.date) : "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{r.particulars}</td>
                        <td className="px-4 py-3 text-slate-500">{r.ref}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {r.debit ? formatMoney(r.debit) : ""}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {r.credit ? formatMoney(r.credit) : ""}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatMoney(r.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-700" colSpan={3}>
                        Totals
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {formatMoney(totalDebit)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {formatMoney(totalCredit)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {formatMoney(closingBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 text-sm">
                <span className="text-slate-500">Closing balance (amount owed):</span>
                <span className="text-lg font-bold text-slate-900">{formatMoney(closingBalance)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
