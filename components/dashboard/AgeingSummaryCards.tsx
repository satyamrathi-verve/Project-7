import { formatMoney } from "@/lib/format";

export interface AgeingSummaryItem {
  label: string;
  count: number;
  amount: number;
  colorClass: string;
}

export function AgeingSummaryCards({ items }: { items: AgeingSummaryItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-hairline bg-surface p-4 shadow-card transition-all duration-[220ms] ease-premium hover:-translate-y-1 hover:border-brand/20 hover:shadow-card-hover"
        >
          <span className={`inline-block h-2 w-2 rounded-full ${item.colorClass}`} />
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">{item.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-ink">{formatMoney(item.amount)}</p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {item.count} invoice{item.count === 1 ? "" : "s"}
          </p>
        </div>
      ))}
    </div>
  );
}
