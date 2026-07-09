/*
  Cashflow projection helpers.

  A forward-looking collection forecast built ENTIRELY from real data:
  open / partial invoices, their outstanding balance (total − receipts
  allocated), grouped by due date into weekly or monthly buckets. Nothing is
  written back — the team's expected-amount adjustments live in the UI only.
*/
import type { Invoice, Customer, ReceiptAllocation } from "./types";
import { daysBetween } from "./format";

export type Granularity = "weekly" | "monthly";

export interface CfRow {
  invoice: Invoice;
  customerName: string;
  outstanding: number;
  overdue: boolean;
  daysToDue: number; // >0 future, <0 past due
}

export interface Bucket {
  key: string;
  label: string;
  sub: string;
  overdue: boolean;
  beyond: boolean;
  rows: CfRow[];
  outstanding: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function midnight(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
  const x = midnight(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** Outstanding = invoice.total − Σ receipt_allocations.amount, for open/partial/overdue invoices only. */
export function buildRows(invoices: Invoice[], allocations: ReceiptAllocation[], customers: Customer[], today: Date): CfRow[] {
  const alloc = new Map<string, number>();
  for (const a of allocations) alloc.set(a.invoice_id, (alloc.get(a.invoice_id) ?? 0) + Number(a.amount));
  const cust = new Map(customers.map((c) => [c.id, c.name]));
  const t = midnight(today);
  const rows: CfRow[] = [];
  for (const inv of invoices) {
    if (inv.status === "paid") continue;
    const outstanding = Number(inv.total) - (alloc.get(inv.id) ?? 0);
    if (outstanding <= 0) continue;
    const daysToDue = daysBetween(t.toISOString(), inv.due_date);
    rows.push({
      invoice: inv,
      customerName: cust.get(inv.customer_id) ?? "Unknown customer",
      outstanding,
      overdue: daysToDue < 0,
      daysToDue,
    });
  }
  return rows;
}

export function bucketize(rows: CfRow[], granularity: Granularity, horizon: number, today: Date): Bucket[] {
  const t = midnight(today);
  const buckets: Bucket[] = [];

  const overdue: Bucket = { key: "overdue", label: "Overdue", sub: "Past due — collect now", overdue: true, beyond: false, rows: [], outstanding: 0 };
  const beyond: Bucket = { key: "beyond", label: "Beyond horizon", sub: "Later", overdue: false, beyond: true, rows: [], outstanding: 0 };

  // pre-build the horizon buckets so the timeline is continuous even when empty
  const horizonBuckets: Bucket[] = [];
  if (granularity === "weekly") {
    const ws = startOfWeek(t);
    for (let i = 0; i < horizon; i++) {
      const start = addDays(ws, i * 7);
      const end = addDays(start, 6);
      horizonBuckets.push({
        key: `w${i}`,
        label: i === 0 ? "This week" : `${shortDate(start)}`,
        sub: `${shortDate(start)} – ${shortDate(end)}`,
        overdue: false, beyond: false, rows: [], outstanding: 0,
      });
    }
  } else {
    for (let i = 0; i < horizon; i++) {
      const d = new Date(t.getFullYear(), t.getMonth() + i, 1);
      horizonBuckets.push({
        key: `m${i}`,
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        sub: i === 0 ? "This month" : "",
        overdue: false, beyond: false, rows: [], outstanding: 0,
      });
    }
  }

  for (const r of rows) {
    if (r.overdue) { overdue.rows.push(r); continue; }
    const due = midnight(new Date(r.invoice.due_date));
    let idx: number;
    if (granularity === "weekly") {
      idx = Math.floor((startOfWeek(due).getTime() - startOfWeek(t).getTime()) / (7 * 86_400_000));
    } else {
      idx = (due.getFullYear() - t.getFullYear()) * 12 + (due.getMonth() - t.getMonth());
    }
    if (idx >= 0 && idx < horizon) horizonBuckets[idx].rows.push(r);
    else beyond.rows.push(r);
  }

  const all = [overdue, ...horizonBuckets, beyond];
  for (const b of all) b.outstanding = b.rows.reduce((s, r) => s + r.outstanding, 0);

  // drop the synthetic overdue/beyond buckets when empty
  buckets.push(...all.filter((b) => (b.overdue || b.beyond ? b.rows.length > 0 : true)));
  return buckets;
}

/** Default expected inflow for a bucket, before any manual override. */
export function defaultExpected(b: Bucket, confidence: number): number {
  const pct = b.overdue ? Math.max(0, confidence - 25) : confidence;
  return Math.round((b.outstanding * pct) / 100);
}

/** Deterministic tiny sparkline seed for KPI cards (no randomness). */
export function seedFor(seed: string, len = 12): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    out.push(40 + (h % 60));
  }
  return out;
}
