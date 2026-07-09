import { formatMoney } from "@/lib/format";

/*
  Invoiced vs collected per month, last 12 months — two real series
  (invoices.total grouped by invoice_date, receipts.amount grouped by
  receipt_date), grouped bars for an at-a-glance comparison.
*/
export function CollectionsChart({
  points,
}: {
  points: { label: string; invoiced: number; collected: number }[];
}) {
  if (points.length === 0) {
    return <p className="text-sm text-ink-muted">Not enough history yet.</p>;
  }

  const max = Math.max(...points.map((p) => Math.max(p.invoiced, p.collected)), 1);

  return (
    <div>
      <div className="flex h-40 items-end gap-3">
        {points.map((p) => (
          <div key={p.label} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-full w-full items-end justify-center gap-0.5">
              <div
                className="w-1/2 rounded-t bg-info/25 transition-all duration-300"
                style={{ height: `${Math.max(3, (p.invoiced / max) * 100)}%` }}
                title={`Invoiced ${p.label}: ${formatMoney(p.invoiced)}`}
              />
              <div
                className="w-1/2 rounded-t bg-success transition-all duration-300"
                style={{ height: `${Math.max(3, (p.collected / max) * 100)}%` }}
                title={`Collected ${p.label}: ${formatMoney(p.collected)}`}
              />
            </div>
            <span className="text-[10px] text-ink-muted">{p.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[12px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-info/25" /> Invoiced
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-success" /> Collected
        </span>
      </div>
    </div>
  );
}
