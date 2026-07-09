import { CircularRing } from "./Primitives";

/*
  The one "wow" feature: a Collection Health Score, front and center in the KPI
  row so a finance user sees collection risk at a glance without scrolling to
  the fuller Customer Snapshot card. Same real number (lib/collectionHealth.ts),
  just given its own spotlight.
*/
export function CollectionHealthCard({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "rgb(var(--color-success))" : score >= 50 ? "rgb(var(--color-warning))" : "rgb(var(--color-danger))";
  const bg = score >= 80 ? "bg-success/10" : score >= 50 ? "bg-warning/10" : "bg-danger/10";

  return (
    <div
      className={`group rounded-xl border border-hairline bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_30px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-1 hover:border-info-border hover:shadow-[0_4px_14px_rgba(0,0,0,0.08),0_10px_30px_rgba(0,0,0,0.06)]`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${bg}`}>🎯</div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative flex h-14 w-14 flex-none items-center justify-center">
          <CircularRing value={score} size={56} strokeColor={color} />
          <span className="absolute text-base font-bold" style={{ color }}>
            {score}
          </span>
        </div>
        <div>
          <p className="text-[15px] font-semibold" style={{ color }}>
            {label}
          </p>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Collection Health</p>
        </div>
      </div>
    </div>
  );
}
