import { memo } from "react";
import { formatMoney } from "@/lib/format";
import { DashboardCard } from "./DashboardCard";

export interface HealthSegment {
  label: "Excellent" | "Good" | "Average" | "High Risk";
  count: number;
  outstanding: number;
  colorClass: string;
  barClass: string;
}

function CustomerHealthCardImpl({ segments }: { segments: HealthSegment[] }) {
  const totalCustomers = segments.reduce((s, seg) => s + seg.count, 0);

  return (
    <DashboardCard
      title="Customer Health Score"
      subtitle={`${totalCustomers} customer${totalCustomers === 1 ? "" : "s"} with invoices, segmented by collection risk`}
    >
      <div className="space-y-3">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-3">
            <span className={`w-20 flex-none text-[13px] font-medium ${seg.colorClass}`}>{seg.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.04]">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-premium ${seg.barClass}`}
                style={{ width: totalCustomers ? `${(seg.count / totalCustomers) * 100}%` : "0%" }}
              />
            </div>
            <span className="w-10 flex-none text-right text-[13px] font-semibold tabular-nums text-ink">{seg.count}</span>
            <span className="w-24 flex-none text-right text-[12px] tabular-nums text-ink-muted">{formatMoney(seg.outstanding)}</span>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

export const CustomerHealthCard = memo(CustomerHealthCardImpl);
