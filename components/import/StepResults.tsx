"use client";

import { useState } from "react";
import Papa from "papaparse";
import Link from "next/link";
import type { EntityConfig, ImportRow, ImportRunResult } from "@/lib/import/types";
import { downloadTextFile } from "@/lib/import/csv";
import { StatCard } from "@/components/StatCard";

const RECORD_LINKS: Record<string, string | null> = {
  customers: "/masters/customers",
  invoices: "/invoices",
};

export function StepResults({
  entity,
  rows,
  result,
  onRetryFailed,
  onUndo,
  onStartNew,
}: {
  entity: EntityConfig;
  rows: ImportRow[];
  result: ImportRunResult;
  onRetryFailed: (rowIndexes: number[]) => void;
  onUndo: () => Promise<void>;
  onStartNew: () => void;
}) {
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

  const failedRows = result.rows.filter((r) => r.action === "failed");
  const successRows = result.rows.filter((r) => r.action === "create" || r.action === "update");
  const canUndo = !undone && (result.created > 0 || result.updated > 0);
  const recordLink = RECORD_LINKS[entity.entity];
  const speed = result.durationMs > 0 ? Math.round((result.created + result.updated) / (result.durationMs / 1000)) : 0;

  function downloadErrorReport() {
    const data = failedRows.map((r) => {
      const row = rows.find((x) => x.rowIndex === r.rowIndex);
      return { row: r.rowIndex + 1, key: r.key, error: r.error ?? "", ...(row?.values ?? {}) };
    });
    downloadTextFile(`${entity.entity}-import-errors.csv`, Papa.unparse(data));
  }

  function downloadSuccessReport() {
    const data = successRows.map((r) => ({ row: r.rowIndex + 1, key: r.key, action: r.action }));
    downloadTextFile(`${entity.entity}-import-success.csv`, Papa.unparse(data));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-success-border bg-success-bg p-6 text-center">
        <p className="text-2xl font-bold text-success">{result.cancelled ? "Import cancelled" : "Import complete"} {result.cancelled ? "⏸" : "✅"}</p>
        <p className="mt-1 text-sm text-success">
          {result.created + result.updated} of {result.rows.length + result.skipped} rows processed in {(result.durationMs / 1000).toFixed(1)}s
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon="✚" label="Created" value={result.created.toLocaleString()} accent="green" />
        <StatCard icon="✎" label="Updated" value={result.updated.toLocaleString()} accent="blue" />
        <StatCard icon="⤳" label="Skipped" value={result.skipped.toLocaleString()} accent="orange" />
        <StatCard icon="✕" label="Failed" value={result.failed.toLocaleString()} accent="red" />
      </div>

      <div className="grid grid-cols-2 gap-4 text-center text-sm text-ink-muted sm:grid-cols-2">
        <div className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
          Total duration: <span className="font-semibold text-ink">{(result.durationMs / 1000).toFixed(1)}s</span>
        </div>
        <div className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
          Processing speed: <span className="font-semibold text-ink">{speed} rows/s</span>
        </div>
      </div>

      {failedRows.length > 0 && (
        <div className="rounded-xl border border-danger-border bg-surface p-5 shadow-card">
          <p className="text-sm font-bold text-danger">{failedRows.length} row(s) failed</p>
          <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-hairline">
            <table className="w-full text-xs">
              <tbody>
                {failedRows.slice(0, 200).map((r) => (
                  <tr key={r.rowIndex} className="border-b border-hairline last:border-0">
                    <td className="px-3 py-2 text-ink-muted">#{r.rowIndex + 1}</td>
                    <td className="px-3 py-2 font-medium text-ink-secondary">{r.key}</td>
                    <td className="px-3 py-2 text-danger">{r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => onRetryFailed(failedRows.map((r) => r.rowIndex))}
            className="mt-3 rounded-lg bg-danger px-4 py-2 text-xs font-medium text-white hover:opacity-90"
          >
            Retry failed rows
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 rounded-xl border border-hairline bg-surface p-5 shadow-card">
        <button type="button" onClick={downloadErrorReport} disabled={failedRows.length === 0} className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-section disabled:cursor-not-allowed disabled:opacity-40">
          Download error report
        </button>
        <button type="button" onClick={downloadSuccessReport} disabled={successRows.length === 0} className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-section disabled:cursor-not-allowed disabled:opacity-40">
          Download success report
        </button>
        {recordLink && (
          <Link href={recordLink} className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-section">
            View imported records
          </Link>
        )}
        <Link href="/upload/history" className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-section">
          View Import History
        </Link>
        <button
          type="button"
          disabled={!canUndo || undoing}
          onClick={async () => {
            setUndoing(true);
            await onUndo();
            setUndoing(false);
            setUndone(true);
          }}
          className="rounded-lg border border-danger-border px-4 py-2 text-sm font-medium text-danger hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          {undone ? "Undone" : undoing ? "Undoing…" : "Undo this import"}
        </button>
        <button type="button" onClick={onStartNew} className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-card hover:bg-brand-dark">
          Import another file
        </button>
      </div>

      <p className="text-xs text-ink-muted">
        "Undo" deletes every record this run created and restores the previous values of every record it updated — it isn't a database transaction rollback (that
        would need a backend function this project intentionally doesn't add), so it only works immediately after the run, before other changes are made to the same
        records.
      </p>
    </div>
  );
}
