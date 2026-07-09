import Link from "next/link";
import type { CustomerRisk } from "@/lib/customerRisk";
import { formatMoney } from "@/lib/format";

export function CustomerRiskCard({ rows }: { rows: CustomerRisk[] }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
      <h3 className="text-lg font-semibold text-ink">Customer Risk</h3>
      <p className="text-[13px] text-ink-muted">Highest-risk customers by collection score</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No customers with outstanding balances.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.customer.id} className="rounded-lg bg-section p-3">
              <div className="flex items-center justify-between gap-2">
                <Link href="/masters/customers" className="truncate text-sm font-semibold text-ink hover:text-brand">
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
                  <p className="font-semibold tabular-nums text-ink">
                    {r.avgDelayDays === null ? "—" : `${r.avgDelayDays}d`}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
