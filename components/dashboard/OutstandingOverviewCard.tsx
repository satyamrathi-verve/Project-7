import { formatMoney } from "@/lib/format";

export function OutstandingOverviewCard({
  outstanding,
  collectedToday,
  expectedThisWeek,
  expectedThisMonth,
  collectedMTD,
  invoicedMTD,
}: {
  outstanding: number;
  collectedToday: number;
  expectedThisWeek: number;
  expectedThisMonth: number;
  collectedMTD: number;
  invoicedMTD: number;
}) {
  const progressPct = invoicedMTD > 0 ? Math.min(100, Math.round((collectedMTD / invoicedMTD) * 100)) : 0;

  return (
    <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
      <h3 className="text-lg font-semibold text-ink">Outstanding Overview</h3>
      <p className="text-[13px] text-ink-muted">Where receivables stand right now</p>

      <p className="mt-4 text-4xl font-bold tabular-nums tracking-tight text-ink">{formatMoney(outstanding)}</p>
      <p className="mt-1 text-[13px] text-ink-muted">Total outstanding across all open invoices</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <MiniStat label="Collected Today" value={formatMoney(collectedToday)} />
        <MiniStat label="Expected This Week" value={formatMoney(expectedThisWeek)} />
        <MiniStat label="Expected This Month" value={formatMoney(expectedThisMonth)} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-ink-muted">Collection Progress (MTD)</span>
          <span className="font-semibold text-ink">{progressPct}%</span>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-black/[0.04] shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-info to-brand transition-[width] duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[12px] text-ink-muted">
          {formatMoney(collectedMTD)} collected of {formatMoney(invoicedMTD)} invoiced this month
        </p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-section px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
