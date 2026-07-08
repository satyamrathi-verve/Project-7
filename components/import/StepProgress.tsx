import type { ImportProgressState } from "@/lib/import/types";

export function StepProgress({ progress, onCancel }: { progress: ImportProgressState | null; onCancel: () => void }) {
  const pct = progress && progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;
  const stageLabel =
    progress?.stage === "preparing"
      ? "Preparing…"
      : progress?.stage === "cancelled"
      ? "Cancelled"
      : progress?.stage === "done"
      ? "Finishing up…"
      : "Importing rows…";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-brand">{stageLabel}</p>
        <p className="mt-2 text-4xl font-bold text-slate-900">{pct}%</p>
        <div className="mx-auto mt-4 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {(progress?.processed ?? 0).toLocaleString()} of {(progress?.total ?? 0).toLocaleString()} rows processed
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Batch" value={`${progress?.currentBatch ?? 0} / ${progress?.totalBatches ?? 0}`} />
        <Stat label="Succeeded" value={(progress?.succeeded ?? 0).toLocaleString()} tone="text-emerald-600" />
        <Stat label="Failed" value={(progress?.failed ?? 0).toLocaleString()} tone="text-red-600" />
        <Stat label="Speed" value={`${progress?.rowsPerSecond ?? 0} rows/s`} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
        {progress?.etaSeconds != null ? `Estimated time remaining: ${formatEta(progress.etaSeconds)}` : "Calculating time remaining…"}
      </div>

      {progress?.stage === "importing" && (
        <div className="flex justify-center">
          <button type="button" onClick={onCancel} className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
            Cancel import
          </button>
        </div>
      )}
      <p className="text-center text-xs text-slate-400">
        You can safely close this tab after cancelling — rows already written stay written; nothing after the current batch is touched.
      </p>
    </div>
  );
}

function Stat({ label, value, tone = "text-slate-800" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
