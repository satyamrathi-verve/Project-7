import { memo } from "react";
import { formatMoney } from "@/lib/format";

export interface DonutSegment {
  label: string;
  value: number;
  color: string; // hex, used directly on the SVG stroke
  colorClass: string; // tailwind bg-* class, used on the legend dot
}

/** Simple multi-segment donut built from stroke-dasharray arcs — no chart library. */
function DistributionDonutImpl({ segments, centerLabel }: { segments: DonutSegment[]; centerLabel: string }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const size = 140;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  if (total <= 0) {
    return <p className="text-sm text-ink-muted">No invoices yet.</p>;
  }

  let offsetAcc = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-none">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="stroke-hairline" fill="none" />
          {segments
            .filter((seg) => seg.value > 0)
            .map((seg) => {
              const fraction = seg.value / total;
              const dash = fraction * circumference;
              const dashArray = `${dash} ${circumference - dash}`;
              const dashOffset = -offsetAcc;
              offsetAcc += dash;
              return (
                <circle
                  key={seg.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  strokeWidth={stroke}
                  stroke={seg.color}
                  fill="none"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  className="cursor-pointer transition-opacity duration-150 hover:opacity-80"
                >
                  <title>
                    {seg.label}: {formatMoney(seg.value)} ({Math.round(fraction * 100)}%)
                  </title>
                </circle>
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-ink-muted">Total</span>
          <span className="text-sm font-bold text-ink">{centerLabel}</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-[12px]">
            <span className={`h-2.5 w-2.5 flex-none rounded-sm ${seg.colorClass}`} />
            <span className="text-ink-muted">{seg.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink">
              {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const DistributionDonut = memo(DistributionDonutImpl);
