import { memo } from "react";
import Link from "next/link";
import type { CustomerRisk } from "@/lib/customerRisk";
import { formatMoney } from "@/lib/format";
import { DashboardCard } from "./DashboardCard";
import { GradientProgressBar } from "./Primitives";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1";

function CustomerRiskCardImpl({ rows }: { rows: CustomerRisk[] }) {
  return (
    <DashboardCard title="Customer Risk" subtitle="Highest-risk customers by collection score">
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No customers with outstanding balances.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const utilTone = r.creditUtilizationPct >= 80 ? "danger" : r.creditUtilizationPct >= 50 ? "warning" : "brand";
            return (
              <li
                key={r.customer.id}
                className="rounded-lg bg-section p-3 transition-colors duration-200 hover:bg-section/70"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link href="/masters/customers" className={`truncate rounded text-sm font-semibold text-ink hover:text-brand ${FOCUS_RING}`}>
                    {r.customer.name}
                  </Link>
                  <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.riskChipClass}`}>
                    {r.riskLabel}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <p className="text-ink-muted">Outstanding</p>
                    <p className="font-semibold tabular-nums text-ink">{formatMoney(r.outstanding)}</p>
                  </div>
                  <div>
                    <p className="text-ink-muted">Credit Used</p>
                    <p className={`font-semibold tabular-nums ${r.creditUtilizationPct >= 80 ? "text-danger" : "text-ink"}`}>
                      {Math.round(r.creditUtilizationPct)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-muted">Avg. Delay</p>
                    <p className="font-semibold tabular-nums text-ink">{r.avgDelayDays === null ? "—" : `${r.avgDelayDays}d`}</p>
                  </div>
                </div>
                <div className="mt-2.5">
                  <GradientProgressBar percent={r.creditUtilizationPct} tone={utilTone} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

export const CustomerRiskCard = memo(CustomerRiskCardImpl);
