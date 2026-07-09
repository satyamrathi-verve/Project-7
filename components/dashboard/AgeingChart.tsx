import { memo } from "react";
import { formatMoney } from "@/lib/format";

export interface AgeingBucket {
  label: string;
  value: number;
  colorClass: string;
}

/** Single stacked bar showing how outstanding value is spread across ageing buckets. */
function AgeingChartImpl({ buckets }: { buckets: AgeingBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.value, 0);

  if (total <= 0) {
    return <p className="text-sm text-ink-muted">Nothing outstanding right now.</p>;
  }

  return (
    <div>
      <div className="flex h-8 w-full gap-0.5 overflow-hidden rounded-lg">
        {buckets
          .filter((b) => b.value > 0)
          .map((b) => (
            <div
              key={b.label}
              className={`h-full cursor-pointer transition-all duration-500 ease-premium hover:brightness-110 ${b.colorClass}`}
              style={{ width: `${(b.value / total) * 100}%` }}
              title={`${b.label}: ${formatMoney(b.value)}`}
            />
          ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-2 text-[12px]">
            <span className={`h-2.5 w-2.5 flex-none rounded-sm ${b.colorClass}`} />
            <span className="text-ink-muted">{b.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink">{formatMoney(b.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AgeingChart = memo(AgeingChartImpl);
