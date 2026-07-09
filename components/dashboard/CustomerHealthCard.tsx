import { formatMoney } from "@/lib/format";

export interface HealthSegment {
  label: "Excellent" | "Good" | "Average" | "High Risk";
  count: number;
  outstanding: number;
  colorClass: string;
  barClass: string;
}

export function CustomerHealthCard({ segments }: { segments: HealthSegment[] }) {
  const totalCustomers = segments.reduce((s, seg) => s + seg.count, 0);

  return (
    <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
      <h3 className="text-lg font-semibold text-ink">Customer Health Score</h3>
      <p className="text-[13px] text-ink-muted">{totalCustomers} customers with invoices, segmented by collection risk</p>

      <div className="mt-4 space-y-3">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-3">
            <span className={`w-20 flex-none text-[13px] font-medium ${seg.colorClass}`}>{seg.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.04]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${seg.barClass}`}
                style={{ width: totalCustomers ? `${(seg.count / totalCustomers) * 100}%` : "0%" }}
              />
            </div>
            <span className="w-10 flex-none text-right text-[13px] font-semibold tabular-nums text-ink">{seg.count}</span>
            <span className="w-24 flex-none text-right text-[12px] tabular-nums text-ink-muted">{formatMoney(seg.outstanding)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
