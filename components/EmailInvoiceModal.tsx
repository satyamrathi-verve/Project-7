"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Company, Customer, Invoice, ReminderLog } from "@/lib/types";
import { FormField, inputClass } from "@/components/FormField";

/*
  Email Invoice composer — a Zoho/QuickBooks-style draft popup shown before an
  invoice email "goes out". Everything is generated from live data:
    • To        → the customer's email from Customer Master
    • Subject   → "Invoice <no> from <company> - Payment Request"
    • Body      → a professional template filled with the real invoice figures,
                  including a dynamic Pay Now link to this app's payment page.
    • Attachment→ the printable invoice, named Invoice_<no>_<Customer>.pdf
  "Sending" is simulated the way the rest of the app simulates email: it writes a
  row to reminder_log (status sent/failed). There is no real mailbox, so genuine
  "Opened" tracking isn't possible — the history below shows the real logged status.
*/

function money(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[Number(m) - 1]} ${y}`;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9]+/g, "");
}

const STATUS_BADGE: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700",
  opened: "bg-blue-50 text-blue-700",
  failed: "bg-red-50 text-red-700",
};

export function EmailInvoiceModal({
  invoice,
  company,
  customer,
  onClose,
  onSent,
}: {
  invoice: Invoice;
  company: Company | null;
  customer: Customer | null;
  onClose: () => void;
  onSent?: (status: "sent" | "failed") => void;
}) {
  const companyName = company?.name ?? "Your Company";
  const customerName = customer?.name ?? "Customer";

  const payLink = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const q = new URLSearchParams({
      no: invoice.invoice_no,
      amt: String(invoice.total),
      cust: invoice.customer_id,
    });
    return `${origin}/pay/${invoice.id}?${q.toString()}`;
  }, [invoice.id, invoice.invoice_no, invoice.total, invoice.customer_id]);

  const attachmentName = `Invoice_${invoice.invoice_no}_${sanitizeFileName(customerName)}.pdf`;

  const defaultSubject = `Invoice ${invoice.invoice_no} from ${companyName} - Payment Request`;
  const defaultBody = useMemo(
    () =>
      `Dear ${customerName},

Greetings from ${companyName}.

Please find attached your invoice details.

Invoice No: ${invoice.invoice_no}
Invoice Date: ${formatDate(invoice.invoice_date)}
Due Date: ${formatDate(invoice.due_date)}
Total Amount: ${money(Number(invoice.total))}

You can view and download the invoice from the attachment (${attachmentName}).

For your convenience, you can make the payment securely using the link below:

Pay Now: ${payLink}

Kindly process the payment on or before the due date.
If you have already completed the payment, please ignore this reminder.

Thank you for your business.

Regards,
${companyName}
Accounts Team`,
    [customerName, companyName, invoice.invoice_no, invoice.invoice_date, invoice.due_date, invoice.total, attachmentName, payLink]
  );

  const [to, setTo] = useState(customer?.email ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ status: "sent" | "failed"; message: string } | null>(null);
  const [history, setHistory] = useState<ReminderLog[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadHistory() {
    if (!supabase) return;
    const { data } = await supabase
      .from("reminder_log")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("sent_at", { ascending: false });
    setHistory((data as ReminderLog[]) ?? []);
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]);

  async function handleSend() {
    if (!supabase) return;
    setSending(true);
    setResult(null);

    // CC has no column in reminder_log, so fold it into the recipient record honestly.
    const recipient = cc.trim() ? `${to.trim()} (cc: ${cc.trim()})` : to.trim();

    const { error } = await supabase.from("reminder_log").insert({
      invoice_id: invoice.id,
      to_email: recipient,
      subject: subject.trim(),
      body,
      status: "sent",
    });

    setSending(false);
    if (error) {
      setResult({ status: "failed", message: error.message });
      onSent?.("failed");
    } else {
      setResult({ status: "sent", message: `Invoice emailed to ${to.trim() || "customer"}.` });
      onSent?.("sent");
      loadHistory();
    }
  }

  function closeWithAnim() {
    setMounted(false);
    setTimeout(onClose, 150);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 transition-opacity duration-150 sm:items-center ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
      onClick={closeWithAnim}
    >
      <div
        className={`my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl transition-all duration-150 ${
          mounted ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Email Invoice</h3>
            <p className="text-xs text-slate-500">
              {invoice.invoice_no} · {customerName}
            </p>
          </div>
          <button
            onClick={closeWithAnim}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {result?.status === "sent" ? (
          // Success state
          <div className="px-6 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl">
              ✓
            </div>
            <p className="mt-4 text-base font-semibold text-slate-900">{result.message}</p>
            <p className="mt-1 text-sm text-slate-500">Logged to this invoice&apos;s email history.</p>
            <button
              onClick={closeWithAnim}
              className="mt-6 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            {result?.status === "failed" && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                Couldn&apos;t send: {result.message}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="To">
                <input className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@email.com" />
              </FormField>
              <FormField label="CC">
                <input className={inputClass} value={cc} onChange={(e) => setCc(e.target.value)} placeholder="optional" />
              </FormField>
            </div>

            <div className="mt-4">
              <FormField label="Subject">
                <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
              </FormField>
            </div>

            <div className="mt-4">
              <FormField label="Email Body">
                <textarea
                  className={`${inputClass} min-h-[220px] resize-y font-sans leading-relaxed`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </FormField>
            </div>

            {/* Attachments */}
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attachments</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                  <span className="text-red-500">📄</span>
                  {attachmentName}
                  <a
                    href={`/invoices/${invoice.id}/print`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    preview
                  </a>
                </span>
              </div>
            </div>

            {/* Pay Now preview */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Secure payment link</p>
                  <p className="text-xs text-slate-500">Recipient can pay {money(Number(invoice.total))} online — the invoice auto-settles.</p>
                </div>
                <a
                  href={payLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Pay Now
                </a>
              </div>
            </div>

            {/* Email history */}
            {history.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Email history</p>
                <ul className="mt-2 space-y-2">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-slate-600">{h.subject}</span>
                      <span className="flex flex-none items-center gap-2">
                        <span className="text-xs text-slate-400">{formatDate(h.sent_at)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[h.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {h.status}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        {result?.status !== "sent" && (
          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              onClick={closeWithAnim}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !to.trim()}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send Email"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
