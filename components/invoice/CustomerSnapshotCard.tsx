import type { Customer, Invoice } from "@/lib/types";
import type { CollectionAnalytics } from "@/lib/collectionHealth";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, CardTitle, Field, ProgressBar, CircularRing, Icon } from "./Primitives";

const MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  neft: "NEFT",
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Tiny inline sparkline of per-invoice outstanding amounts, oldest → newest. No charting dependency. */
function OutstandingTrend({ invoices, allocationsByInvoiceId }: { invoices: Invoice[]; allocationsByInvoiceId: Map<string, { amount: number }[]> }) {
  const sorted = [...invoices].sort((a, b) => (a.invoice_date < b.invoice_date ? -1 : 1));
  const points = sorted.map((inv) => {
    const paid = (allocationsByInvoiceId.get(inv.id) ?? []).reduce((s, a) => s + (a.amount ?? 0), 0);
    return Math.max(0, inv.total - paid);
  });

  if (points.length < 2) return null;

  const max = Math.max(...points, 1);
  const w = 100;
  const h = 28;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => `${i * step},${h - (p / max) * h}`);
  const polylinePoints = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];

  const first = points[0];
  const last = points[points.length - 1];
  const pctChange = first > 0 ? Math.round(((last - first) / first) * 100) : last > 0 ? 100 : 0;
  const lastUpdated = sorted[sorted.length - 1]?.invoice_date;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[12px] text-ink-muted">Outstanding trend (per invoice)</p>
        <span className={`text-[12px] font-semibold ${pctChange > 0 ? "text-danger" : pctChange < 0 ? "text-success" : "text-ink-muted"}`}>
          {pctChange > 0 ? "▲" : pctChange < 0 ? "▼" : "–"} {Math.abs(pctChange)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full overflow-visible" preserveAspectRatio="none">
        <polyline points={polylinePoints} fill="none" stroke="rgb(var(--color-info))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 2.6 : 1.6} fill="rgb(var(--color-info))" opacity={i === coords.length - 1 ? 1 : 0.35}>
            <title>
              {formatDate(sorted[i].invoice_date)}: {formatMoney(points[i])}
            </title>
          </circle>
        ))}
        <circle cx={lastX} cy={lastY} r={5} fill="rgb(var(--color-info))" opacity={0.15} />
      </svg>
      {lastUpdated && <p className="mt-1 text-[11px] text-ink-muted">Last updated {formatDate(lastUpdated)}</p>}
    </div>
  );
}

export function CustomerSnapshotCard({
  customer,
  a,
  customerInvoices,
  allocationsByInvoiceId,
}: {
  customer: Customer;
  a: CollectionAnalytics;
  customerInvoices: Invoice[];
  allocationsByInvoiceId: Map<string, { amount: number }[]>;
}) {
  const utilizationPct =
    customer.credit_limit > 0 ? Math.min(100, Math.round((a.outstandingAcrossAll / customer.credit_limit) * 100)) : 0;
  const utilizationTone = utilizationPct >= 80 ? "red" : utilizationPct >= 50 ? "amber" : "emerald";
  const ringColor = a.healthScore >= 80 ? "rgb(var(--color-success))" : a.healthScore >= 50 ? "rgb(var(--color-warning))" : "rgb(var(--color-danger))";

  return (
    <Card>
      <CardTitle icon={<span aria-hidden>👥</span>} subtitle="Financial relationship overview">
        Customer Snapshot
      </CardTitle>

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
          {initialsOf(customer.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{customer.name}</p>
          <p className="text-xs text-ink-muted">
            Code {customer.code} · Customer since {formatDate(customer.created_at)}
          </p>
        </div>
        <span className={`ml-auto flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${a.riskChipClass}`}>
          {a.riskLabel} Risk
        </span>
      </div>

      {/* Collection score — ring gauge */}
      <div className="mb-4 flex items-center gap-4 rounded-xl border border-hairline/50 bg-section/50 p-3">
        <div className="relative flex h-14 w-14 flex-none items-center justify-center">
          <CircularRing value={a.healthScore} size={56} strokeColor={ringColor} />
          <span className="absolute text-sm font-bold" style={{ color: ringColor }}>
            {a.healthScore}
          </span>
        </div>
        <div>
          <p className="text-[12px] text-ink-muted">Collection Score</p>
          <p className="text-sm font-semibold" style={{ color: ringColor }}>
            {a.healthLabel}
          </p>
        </div>
        <div className="ml-auto w-24 text-right">
          <p className="text-[12px] text-ink-muted">Collection Probability</p>
          <ProgressBar
            percent={a.healthScore}
            tone={a.healthScore >= 80 ? "emerald" : a.healthScore >= 50 ? "amber" : "red"}
            label={`${a.healthScore}%`}
          />
        </div>
      </div>

      {/* Credit utilization — premium bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-ink-muted">Credit Utilization</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar percent={utilizationPct} tone={utilizationTone} label={`${utilizationPct}%`} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[12px] text-ink-muted">
          <span>Available Credit: {formatMoney(a.availableCredit)}</span>
          <span>Limit: {formatMoney(customer.credit_limit)}</span>
        </div>
      </div>

      <div className="mb-4">
        <OutstandingTrend invoices={customerInvoices} allocationsByInvoiceId={allocationsByInvoiceId} />
      </div>

      <div className="divide-y divide-hairline/50">
        <Field icon={<Icon>📉</Icon>} label="Outstanding (All Invoices)" value={formatMoney(a.outstandingAcrossAll)} />
        <Field icon={<Icon>🏦</Icon>} label="Total Paid (All Time)" value={formatMoney(a.totalPaidAcrossAll)} />
        <Field
          label="Avg. Payment Delay"
          value={a.avgPaymentDelayDays === null ? "No payment history yet" : `${a.avgPaymentDelayDays} days`}
        />
        <Field
          label="Preferred Payment Method"
          value={a.preferredMode ? MODE_LABELS[a.preferredMode] ?? a.preferredMode : "No payment received yet"}
        />
        <Field
          icon={<Icon>📆</Icon>}
          label="Last Payment Date"
          value={a.lastPaymentDate ? formatDate(a.lastPaymentDate) : "No payment received yet"}
        />
      </div>
    </Card>
  );
}
