"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Company, Customer, Invoice, InvoiceItem, ReceiptAllocation } from "@/lib/types";
import { NotConfigured } from "@/components/NotConfigured";
import { EmailInvoiceModal } from "@/components/EmailInvoiceModal";

/*
  Sales Invoice — Print Preview (A4 printable page).

  Everything on the page is driven by the LIVE invoice: company header, bill-to
  customer, the real invoice_items, and the stored subtotal/tax/total. A few things
  the demo backend simply doesn't store are handled honestly:
    • Payment terms  → derived from the customer's credit_days ("Net 30 days").
    • CGST / SGST    → the stored tax_amount split 50/50 (standard intra-state GST);
                       the split preserves the real grand total exactly.
    • HSN/SAC        → not a column in this database, shown as "—".
    • Bank / UPI     → not a column either; PAYMENT_DETAILS below is a static
                       company block for the team to fill with real details.
  Nothing here writes to or alters the backend except the simulated "Email Invoice"
  action, which logs a row in reminder_log exactly like the Auto Email Shoot screen.
*/

// Static company payment block — the backend has no bank columns, so fill these in
// with Verve's real account details before a live demo.
const PAYMENT_DETAILS = {
  bankName: "HDFC Bank — Pune Main Branch",
  accountNumber: "5010 0123 4567 89",
  ifsc: "HDFC0000123",
  upi: "verveadvisory@hdfcbank",
};

const TERMS = [
  "Payment is due within the credit period stated above.",
  "Please quote the invoice number on all payments.",
  "Interest @18% p.a. may apply on overdue amounts.",
];

type Loaded = {
  company: Company | null;
  customer: Customer | null;
  invoice: Invoice;
  items: InvoiceItem[];
  allocated: number;
};

function money(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[Number(m) - 1]} ${y}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Indian-system number-to-words for the "Amount in Words" line.
function amountInWords(amount: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(n: number): string {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`;
  }
  function threeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return `${h ? ones[h] + " Hundred" + (rest ? " " : "") : ""}${rest ? twoDigits(rest) : ""}`;
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let words = parts.join(" ").trim() + " Rupees";
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return words + " Only";
}

type PaymentStatus = "Paid" | "Partially Paid" | "Unpaid" | "Overdue";

const STATUS_STYLE: Record<PaymentStatus, string> = {
  Paid: "bg-success-bg text-success ring-success-border",
  "Partially Paid": "bg-info-bg text-info ring-info-border",
  Unpaid: "bg-warning-bg text-warning ring-warning-border",
  Overdue: "bg-danger-bg text-danger ring-danger-border",
};

// Derive the payment status from real figures: what's been allocated against the
// invoice (paid vs partial), the total, and whether it's past the due date.
function paymentStatus(total: number, allocated: number, dueDate: string): PaymentStatus {
  const outstanding = total - allocated;
  if (outstanding <= 0) return "Paid";
  const pastDue = dueDate.slice(0, 10) < todayStr();
  if (pastDue) return "Overdue";
  if (allocated > 0) return "Partially Paid";
  return "Unpaid";
}

// GST state codes (first two digits of a GSTIN) → state name, for Place of Supply.
const GST_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

function placeOfSupply(gstin: string | null): { name: string; code: string } | null {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.slice(0, 2);
  const name = GST_STATES[code];
  return name ? { name, code } : null;
}

// PO details aren't a column in this schema, so surface them only if the invoice
// notes carry an explicit "PO No: ..." / "PO Date: ..." line. No match → hidden.
function extractPurchaseOrder(notes: string | null): { number?: string; date?: string } {
  if (!notes) return {};
  const num = notes.match(/\bP\.?O\.?\s*(?:No\.?|Number|#)\s*[:\-]\s*([A-Za-z0-9/\-]+)/i);
  const date = notes.match(/\bP\.?O\.?\s*Date\s*[:\-]\s*([0-9A-Za-z/\-\s]+?)(?:\n|$|,|;)/i);
  return { number: num?.[1]?.trim(), date: date?.[1]?.trim() };
}

export default function InvoicePrintPage() {
  const params = useParams();
  const id = String(params?.id ?? "");

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!supabase || !id) return;
      setLoading(true);
      setError(null);

      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .single();

      if (invErr || !invoice) {
        setError(invErr?.message ?? "Invoice not found.");
        setLoading(false);
        return;
      }

      const [{ data: company }, { data: customer }, { data: items }, { data: allocations }] = await Promise.all([
        supabase.from("company").select("*").limit(1).maybeSingle(),
        supabase.from("customers").select("*").eq("id", (invoice as Invoice).customer_id).maybeSingle(),
        supabase.from("invoice_items").select("*").eq("invoice_id", id).order("id"),
        supabase.from("receipt_allocations").select("amount").eq("invoice_id", id),
      ]);

      const allocated = ((allocations as Pick<ReceiptAllocation, "amount">[]) ?? []).reduce(
        (s, a) => s + Number(a.amount),
        0
      );

      setData({
        company: (company as Company) ?? null,
        customer: (customer as Customer) ?? null,
        invoice: invoice as Invoice,
        items: (items as InvoiceItem[]) ?? [],
        allocated,
      });
      setLoading(false);
    }
    load();
  }, [id]);

  if (!isConfigured) return <NotConfigured />;

  if (loading) return <p className="text-sm text-ink-muted">Loading invoice…</p>;

  if (error || !data) {
    return (
      <div className="rounded-xl border border-danger-border bg-danger-bg p-6 text-sm text-danger">
        <p className="font-medium">Couldn&apos;t open this invoice.</p>
        <p className="mt-1">{error ?? "Unknown error."}</p>
        <Link href="/invoices" className="mt-3 inline-block font-medium text-brand hover:underline">
          ← Back to Sales Invoices
        </Link>
      </div>
    );
  }

  const { company, customer, invoice, items, allocated } = data;

  const subtotal = Number(invoice.subtotal);
  const taxAmount = Number(invoice.tax_amount);
  const total = Number(invoice.total);
  const effectiveRate = subtotal > 0 ? taxAmount / subtotal : 0;
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;
  const igst = 0;
  const cgstPct = (effectiveRate * 100) / 2;
  const sgstPct = (effectiveRate * 100) / 2;
  const roundOff = Number((total - (subtotal + taxAmount)).toFixed(2));
  const outstanding = total - allocated;
  const status = paymentStatus(total, allocated, invoice.due_date);
  const paymentTerms = customer ? `Net ${customer.credit_days} days` : "—";
  const supply = placeOfSupply(customer?.gstin ?? null);
  const po = extractPurchaseOrder(invoice.notes);

  // Attachments: no attachments table in this schema, so this is empty for now.
  // It renders automatically once linked-document data exists.
  const attachments: { name: string }[] = [];

  // E-invoice (IRN / signed GST QR) is not stored in this schema, so it stays hidden.
  // Populate these from IRP data to light up the e-invoice QR block.
  type EInvoice = { irn: string; ackNo: string; ackDate: string; signedQr: string };
  const eInvoice = null as EInvoice | null;

  // A scannable UPI collect string: any UPI app can pay the outstanding amount.
  const upiPayString = `upi://pay?pa=${encodeURIComponent(PAYMENT_DETAILS.upi)}&pn=${encodeURIComponent(
    company?.name ?? "Company"
  )}&am=${Math.max(outstanding, 0).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${invoice.invoice_no}`)}`;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { background: #ffffff !important; }
          main { overflow: visible !important; padding: 0 !important; }
          .print-hide { display: none !important; }
          /* Keep the whole invoice on one A4 page: scale the sheet to fit and drop
             screen chrome. Chromium honours zoom during print, so the layout reflows
             instead of being clipped. */
          .invoice-paper {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            border: none !important;
            zoom: 0.82;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .avoid-break { break-inside: avoid; }
          table { break-inside: auto; }
          tr, td, th { break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>

      {/* Top action bar — hidden when printing */}
      <div className="print-hide mx-auto mb-6 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link
            href="/invoices"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-black/[0.04]"
          >
            ← Back
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Invoice</p>
            <p className="text-sm font-bold text-ink">{invoice.invoice_no}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-section"
          >
            ⬇ Download PDF
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            🖨 Print
          </button>
          <button
            onClick={() => setShowEmail(true)}
            className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand/5"
          >
            ✉ Email Invoice
          </button>
        </div>
      </div>

      {/* A4 paper */}
      <div className="invoice-paper mx-auto w-full max-w-[210mm] rounded-sm bg-surface p-10 text-ink shadow-xl ring-1 ring-hairline">
        {/* Header: company + TAX INVOICE */}
        <div className="flex items-start justify-between gap-6 border-b border-hairline pb-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-brand text-xl font-bold text-white">
              {(company?.name ?? "AR")
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink">{company?.name ?? "Your Company"}</h1>
              {company?.address && <p className="mt-1 max-w-xs text-sm text-ink-muted">{company.address}</p>}
              <div className="mt-2 space-y-0.5 text-xs text-ink-muted">
                {company?.gstin && <p>GSTIN: {company.gstin}</p>}
                {company?.email && <p>{company.email}</p>}
                {company?.phone && <p>{company.phone}</p>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold tracking-tight text-ink">TAX INVOICE</h2>
            <span
              className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${STATUS_STYLE[status]}`}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Bill To + Invoice Details */}
        <div className="grid grid-cols-2 gap-8 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Bill To</p>
            <p className="mt-2 text-base font-bold text-ink">{customer?.name ?? "—"}</p>
            {customer?.code && <p className="text-xs font-medium text-ink-muted">Customer Code: {customer.code}</p>}
            {customer?.address && <p className="mt-1 text-sm text-ink-muted">{customer.address}</p>}
            <div className="mt-2 space-y-0.5 text-xs text-ink-muted">
              {customer?.gstin && <p>GSTIN: {customer.gstin}</p>}
              {supply && (
                <p>
                  Place of Supply: {supply.name} ({supply.code})
                </p>
              )}
              {customer?.contact_person && <p>Attn: {customer.contact_person}</p>}
              {customer?.phone && <p>{customer.phone}</p>}
              {customer?.email && <p>{customer.email}</p>}
            </div>
          </div>
          <div className="rounded-xl bg-section p-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Invoice No</dt>
                <dd className="font-semibold text-ink">{invoice.invoice_no}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Invoice Date</dt>
                <dd className="text-ink">{formatDate(invoice.invoice_date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Due Date</dt>
                <dd className="text-ink">{formatDate(invoice.due_date)}</dd>
              </div>
              {po.number && (
                <div className="flex justify-between">
                  <dt className="text-ink-muted">PO No</dt>
                  <dd className="text-ink">{po.number}</dd>
                </div>
              )}
              {po.date && (
                <div className="flex justify-between">
                  <dt className="text-ink-muted">PO Date</dt>
                  <dd className="text-ink">{po.date}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-muted">Payment Terms</dt>
                <dd className="text-ink">{paymentTerms}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Item table */}
        <div className="overflow-hidden rounded-xl border border-hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-section text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Item Description</th>
                <th className="px-3 py-2 font-semibold">HSN/SAC</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Rate</th>
                <th className="px-3 py-2 text-right font-semibold">Disc.</th>
                <th className="px-3 py-2 text-right font-semibold">Tax %</th>
                <th className="px-3 py-2 text-right font-semibold">Tax Amt</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-ink-muted">
                    No line items on this invoice.
                  </td>
                </tr>
              ) : (
                items.map((it, i) => {
                  const lineAmount = Number(it.amount);
                  const lineTax = lineAmount * effectiveRate;
                  return (
                    <tr key={it.id} className="border-t border-hairline">
                      <td className="px-3 py-2 text-ink-muted">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-ink">{it.description}</td>
                      <td className="px-3 py-2 text-ink-muted">—</td>
                      <td className="px-3 py-2 text-right text-ink-secondary">{Number(it.qty)}</td>
                      <td className="px-3 py-2 text-right text-ink-secondary">{money(Number(it.rate))}</td>
                      <td className="px-3 py-2 text-right text-ink-muted">0.00</td>
                      <td className="px-3 py-2 text-right text-ink-secondary">{(effectiveRate * 100).toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right text-ink-secondary">{money(lineTax)}</td>
                      <td className="px-3 py-2 text-right font-medium text-ink">{money(lineAmount + lineTax)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Tax summary + totals, side by side to stay compact */}
        <div className="avoid-break mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* GST tax summary */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Tax Summary</p>
            <div className="overflow-hidden rounded-lg border border-hairline">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-section text-left text-ink-muted">
                    <th className="px-2 py-1.5 font-semibold">Taxable Value</th>
                    <th className="px-2 py-1.5 text-right font-semibold">CGST {cgstPct.toFixed(1)}%</th>
                    <th className="px-2 py-1.5 text-right font-semibold">SGST {sgstPct.toFixed(1)}%</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-hairline text-ink-secondary">
                    <td className="px-2 py-1.5">{money(subtotal)}</td>
                    <td className="px-2 py-1.5 text-right">{money(cgst)}</td>
                    <td className="px-2 py-1.5 text-right">{money(sgst)}</td>
                    <td className="px-2 py-1.5 text-right">{money(taxAmount)}</td>
                  </tr>
                  <tr className="border-t border-hairline bg-section font-semibold text-ink">
                    <td className="px-2 py-1.5">Total</td>
                    <td className="px-2 py-1.5 text-right">{money(cgst)}</td>
                    <td className="px-2 py-1.5 text-right">{money(sgst)}</td>
                    <td className="px-2 py-1.5 text-right">{money(taxAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-ink-secondary">
              <span className="font-semibold text-ink-secondary">Amount in words:</span> {amountInWords(total)}
            </p>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Subtotal</span>
                <span className="text-ink">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Discount</span>
                <span className="text-ink">{money(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">CGST</span>
                <span className="text-ink">{money(cgst)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">SGST</span>
                <span className="text-ink">{money(sgst)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">IGST</span>
                <span className="text-ink">{money(igst)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Round Off</span>
                <span className="text-ink">{money(roundOff)}</span>
              </div>
              <div className="flex justify-between border-t border-hairline pt-2 text-base font-bold text-ink">
                <span>Grand Total</span>
                <span className="text-brand">{money(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment details */}
        <div className="avoid-break mt-6 grid grid-cols-2 gap-8 border-t border-hairline pt-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Payment Details</p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <dl className="space-y-1 text-sm text-ink-secondary">
                <div className="flex gap-2">
                  <dt className="w-24 flex-none text-ink-muted">Bank Name</dt>
                  <dd>{PAYMENT_DETAILS.bankName}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 flex-none text-ink-muted">Account No</dt>
                  <dd>{PAYMENT_DETAILS.accountNumber}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 flex-none text-ink-muted">IFSC</dt>
                  <dd>{PAYMENT_DETAILS.ifsc}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 flex-none text-ink-muted">UPI</dt>
                  <dd>{PAYMENT_DETAILS.upi}</dd>
                </div>
              </dl>
              {/* Scan-to-pay UPI QR — encodes the payee VPA and the outstanding amount */}
              {PAYMENT_DETAILS.upi && outstanding > 0 && (
                <div className="flex-none text-center">
                  <div className="rounded-lg border border-hairline bg-surface p-1.5">
                    <QRCodeSVG value={upiPayString} size={76} level="M" />
                  </div>
                  <p className="mt-1 text-[10px] text-ink-muted">Scan to pay</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Terms &amp; Conditions</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-ink-muted">
              {TERMS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {invoice.notes && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Notes</p>
                <p className="mt-1 text-xs text-ink-muted">{invoice.notes}</p>
              </>
            )}
          </div>
        </div>

        {/* Attachments — shown only when the invoice has linked documents */}
        {attachments.length > 0 && (
          <div className="avoid-break mt-6 border-t border-hairline pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Attachments</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <span
                  key={a.name}
                  className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-section px-3 py-1.5 text-xs text-ink-secondary"
                >
                  <span className="text-red-500">📎</span>
                  {a.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* GST e-invoice block — shown only for e-invoices with an IRN + signed QR */}
        {eInvoice && (
          <div className="avoid-break mt-6 flex items-start gap-4 border-t border-hairline pt-5">
            <div className="flex-none rounded-lg border border-hairline bg-surface p-1.5">
              <QRCodeSVG value={eInvoice.signedQr} size={96} level="M" />
            </div>
            <div className="text-xs text-ink-secondary">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">e-Invoice</p>
              <p className="mt-1">
                <span className="text-ink-muted">IRN:</span> {eInvoice.irn}
              </p>
              <p>
                <span className="text-ink-muted">Ack No:</span> {eInvoice.ackNo}
              </p>
              <p>
                <span className="text-ink-muted">Ack Date:</span> {eInvoice.ackDate}
              </p>
            </div>
          </div>
        )}

        {/* Footer: signature + thanks */}
        <div className="mt-8 flex items-end justify-between">
          <p className="text-sm font-medium text-ink-muted">Thank you for your business!</p>
          <div className="text-center">
            <div className="mb-1 h-12 w-48 border-b border-hairline" />
            <p className="text-xs text-ink-muted">Authorized Signatory</p>
            <p className="text-xs font-medium text-ink-secondary">{company?.name ?? ""}</p>
          </div>
        </div>
      </div>

      {showEmail && (
        <EmailInvoiceModal
          invoice={invoice}
          company={company}
          customer={customer}
          onClose={() => setShowEmail(false)}
          onSent={(status) => {
            setToast(status === "sent" ? "Invoice email sent and logged." : "Email failed — see composer.");
            setTimeout(() => setToast(null), 4000);
          }}
        />
      )}

      {toast && (
        <div className="print-hide fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
