"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Customer, InvoiceStatus } from "@/lib/types";
import { FormField, inputClass } from "@/components/FormField";
import { CustomerCombobox } from "@/components/CustomerCombobox";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1";

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type LineItem = { description: string; qty: string; rate: string };
const EMPTY_ITEM: LineItem = { description: "", qty: "1", rate: "" };

export type InvoiceFormValues = {
  invoiceNo: string;
  customerId: string;
  invoiceDate: string;
  dueDate: string;
  taxPercent: string;
  notes: string;
  status: InvoiceStatus;
  items: LineItem[];
};

const STATUS_OPTIONS: InvoiceStatus[] = ["open", "partial", "paid", "overdue"];

const addDaysISO = (isoDate: string, days: number) => {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * The one invoice form, used for both creating and editing. Editing an
 * invoice should be exactly as capable as creating one — same customer
 * picker, same line items, same tax math — so a correction never means
 * "type a new total and hope subtotal/tax still add up."
 */
export function InvoiceForm({
  customers,
  mode,
  invoiceId,
  initialValues,
  nextInvoiceNo,
  onSaved,
  onCancel,
}: {
  customers: Customer[];
  mode: "create" | "edit";
  invoiceId?: string;
  initialValues: InvoiceFormValues;
  /** Only used in create mode, to regenerate a number after "Save & New". */
  nextInvoiceNo?: () => string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<InvoiceFormValues>(initialValues);
  const [dueDateTouched, setDueDateTouched] = useState(mode === "edit");
  const [saving, setSaving] = useState<"none" | "save" | "saveNew">("none");
  const [formError, setFormError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const lastRowLastCellRef = useRef<HTMLInputElement | null>(null);

  const customer = customers.find((c) => c.id === values.customerId) ?? null;

  // Due date auto-fills from the customer's credit days, until the user edits it directly.
  useEffect(() => {
    if (dueDateTouched || !customer) return;
    setValues((v) => ({ ...v, dueDate: addDaysISO(v.invoiceDate, customer.credit_days ?? 30) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, values.invoiceDate, dueDateTouched]);

  const subtotal = values.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const taxAmount = subtotal * ((Number(values.taxPercent) || 0) / 100);
  const total = subtotal + taxAmount;

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setValues((v) => ({ ...v, items: v.items.map((row, i) => (i === idx ? { ...row, ...patch } : row)) }));
  }
  function addItem() {
    setValues((v) => ({ ...v, items: [...v.items, { ...EMPTY_ITEM }] }));
  }
  function removeItem(idx: number) {
    setValues((v) => ({
      ...v,
      items: v.items.length > 1 ? v.items.filter((_, i) => i !== idx) : v.items,
    }));
  }

  /** Tab/Enter out of the last cell of the last row adds a fresh row and focuses it — no reaching for the mouse to keep punching lines. */
  function handleLastCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const isLastField = !e.shiftKey && (e.key === "Tab" || e.key === "Enter");
    if (!isLastField) return;
    e.preventDefault();
    addItem();
    requestAnimationFrame(() => lastRowLastCellRef.current?.focus());
  }

  const validItems = values.items
    .map((it) => ({ ...it, qtyNum: Number(it.qty) || 0, rateNum: Number(it.rate) || 0 }))
    .filter((it) => it.description.trim() && it.qtyNum > 0 && it.rateNum > 0);

  const canSave = Boolean(values.customerId) && validItems.length > 0 && saving === "none";

  async function persist(): Promise<boolean> {
    if (!supabase) return false;

    const payload = {
      invoice_no: values.invoiceNo.trim(),
      invoice_date: values.invoiceDate,
      customer_id: values.customerId,
      due_date: values.dueDate || values.invoiceDate,
      subtotal: Math.round(subtotal * 100) / 100,
      tax_amount: Math.round(taxAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
      status: values.status,
      notes: values.notes.trim() || null,
    };

    if (mode === "create") {
      const { data: invRow, error: invErr } = await supabase
        .from("invoices")
        .insert(payload)
        .select()
        .single();
      if (invErr || !invRow) {
        setFormError(invErr?.message ?? "Could not create the invoice.");
        return false;
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
      if (itemsErr) {
        setFormError(itemsErr.message);
        return false;
      }
      return true;
    }

    // edit: update the invoice, then replace its line items wholesale — simplest
    // way to keep subtotal/tax/total honest against whatever items now exist.
    const { error: updErr } = await supabase.from("invoices").update(payload).eq("id", invoiceId);
    if (updErr) {
      setFormError(updErr.message);
      return false;
    }
    const { error: delErr } = await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
    if (delErr) {
      setFormError(delErr.message);
      return false;
    }
    const { error: insErr } = await supabase.from("invoice_items").insert(
      validItems.map((it) => ({
        invoice_id: invoiceId,
        description: it.description.trim(),
        qty: it.qtyNum,
        rate: it.rateNum,
        amount: Math.round(it.qtyNum * it.rateNum * 100) / 100,
      }))
    );
    if (insErr) {
      setFormError(insErr.message);
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving("save");
    setFormError(null);
    const ok = await persist();
    setSaving("none");
    if (ok) onSaved();
  }

  async function handleSaveAndNew() {
    if (!canSave || mode !== "create") return;
    setSaving("saveNew");
    setFormError(null);
    const ok = await persist();
    setSaving("none");
    if (!ok) return;
    setValues({
      invoiceNo: nextInvoiceNo ? nextInvoiceNo() : values.invoiceNo,
      customerId: "",
      invoiceDate: values.invoiceDate,
      dueDate: "",
      taxPercent: values.taxPercent,
      notes: "",
      status: "open",
      items: [{ ...EMPTY_ITEM }],
    });
    setDueDateTouched(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  }

  return (
    <div className="max-w-3xl animate-fade-in rounded-xl border border-hairline bg-surface p-6 shadow-card motion-reduce:animate-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-ink">
            {mode === "create" ? "New Invoice" : `Edit ${initialValues.invoiceNo}`}
          </h3>
          {mode === "create" && (
            <p className="mt-1 text-sm text-ink-muted">
              Number: <span className="font-medium text-ink-secondary">{values.invoiceNo}</span>
            </p>
          )}
        </div>
        {justSaved && (
          <span className="animate-fade-in rounded-full bg-success-bg px-3 py-1 text-xs font-medium text-success">
            Saved — ready for the next one
          </span>
        )}
      </div>

      {formError && (
        <p className="mt-4 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">{formError}</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        <FormField label="Customer">
          <CustomerCombobox
            customers={customers}
            value={values.customerId}
            onChange={(id) => setValues((v) => ({ ...v, customerId: id }))}
          />
        </FormField>
        <FormField label="Invoice No">
          <input
            className={inputClass}
            value={values.invoiceNo}
            onChange={(e) => setValues((v) => ({ ...v, invoiceNo: e.target.value }))}
          />
        </FormField>
        <FormField label="Invoice Date">
          <input
            type="date"
            className={inputClass}
            value={values.invoiceDate}
            onChange={(e) => setValues((v) => ({ ...v, invoiceDate: e.target.value }))}
          />
        </FormField>
        <FormField label={`Due Date${customer ? ` (auto: ${customer.credit_days}d credit)` : ""}`}>
          <input
            type="date"
            className={inputClass}
            value={values.dueDate}
            onChange={(e) => {
              setDueDateTouched(true);
              setValues((v) => ({ ...v, dueDate: e.target.value }));
            }}
          />
        </FormField>
        <FormField label="Tax %">
          <input
            type="number"
            className={inputClass}
            value={values.taxPercent}
            onChange={(e) => setValues((v) => ({ ...v, taxPercent: e.target.value }))}
          />
        </FormField>
        {mode === "edit" && (
          <FormField label="Status">
            <select
              className={inputClass}
              value={values.status}
              onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as InvoiceStatus }))}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </FormField>
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Line Items</p>
          <p className="text-xs text-ink-muted">Tab or Enter in the last cell adds a new line</p>
        </div>
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
              {values.items.map((it, idx) => {
                const amount = (Number(it.qty) || 0) * (Number(it.rate) || 0);
                const isLastRow = idx === values.items.length - 1;
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
                        ref={isLastRow ? lastRowLastCellRef : undefined}
                        type="number"
                        min="0"
                        className={`${inputClass} w-full`}
                        value={it.rate}
                        onChange={(e) => updateItem(idx, { rate: e.target.value })}
                        onKeyDown={isLastRow ? handleLastCellKeyDown : undefined}
                      />
                    </td>
                    <td className="p-2 text-right tabular-nums text-ink-secondary">{inr(amount)}</td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={values.items.length === 1}
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
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
        />
      </FormField>

      <div className="mt-6 flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-secondary">
            <span>Subtotal</span>
            <span className="tabular-nums">{inr(subtotal)}</span>
          </div>
          <div className="flex justify-between text-ink-secondary">
            <span>Tax ({values.taxPercent || 0}%)</span>
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
          className={`rounded-lg px-4 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-ink/[0.04] ${FOCUS_RING}`}
        >
          Cancel
        </button>
        {mode === "create" && (
          <button
            type="button"
            onClick={handleSaveAndNew}
            disabled={!canSave}
            className={`rounded-lg border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-secondary transition-all duration-150 hover:scale-[1.02] hover:bg-ink/[0.03] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 ${FOCUS_RING}`}
          >
            {saving === "saveNew" ? "Saving…" : "Save & New"}
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:scale-[1.02] hover:bg-brand-dark active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 ${FOCUS_RING}`}
        >
          {saving === "save" ? "Saving…" : mode === "create" ? "Save Invoice" : "Save Changes"}
        </button>
      </div>
    </div>
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
