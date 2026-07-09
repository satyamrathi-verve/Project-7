"use client";

import { useState } from "react";
import type { EntityConfig, ImportConfig, ImportRow, ImportMode } from "@/lib/import/types";
import { InfoTooltip } from "./InfoTooltip";

const CURRENCIES = [
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "JPY", label: "JPY — Japanese Yen" },
];

function reasonFor(row: ImportRow): string {
  if (row.excluded) return "Manually excluded";
  const err = row.issues.find((i) => i.level === "error");
  return err ? err.message : "Won't be imported";
}

export function StepConfigure({
  entity,
  mode,
  rows,
  config,
  onChange,
  onBack,
  onNext,
}: {
  entity: EntityConfig;
  mode: ImportMode;
  rows: ImportRow[];
  config: ImportConfig;
  onChange: (config: ImportConfig) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [showExcluded, setShowExcluded] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  const excludedRows = rows.filter((r) => r.excluded);
  const blockedRows = rows.filter((r) => !r.excluded && (r.action === "skip" || r.status === "error"));
  const readyRows = rows.filter((r) => !r.excluded && r.action !== "skip" && r.status !== "error");
  const toCreate = readyRows.filter((r) => r.action === "create").length;
  const toUpdate = readyRows.filter((r) => r.action === "update").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5 rounded-xl border border-hairline bg-surface p-5 shadow-card">
          <div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Duplicate handling (Create New mode)</label>
              <InfoTooltip text={`What it does: decides what happens to a row whose ${entity.uniqueKey.replace("_", " ")} already exists. When to use: only matters in "Create New" mode — Update/Upsert always overwrite by design. How to choose: pick "Skip" for a safe re-run of a file you've already imported, "Overwrite" if you intend the file to be the new source of truth, "Fail" if duplicates likely mean a mistake in your file.`} />
            </div>
            <select
              value={config.duplicateHandling}
              onChange={(e) => onChange({ ...config, duplicateHandling: e.target.value as ImportConfig["duplicateHandling"] })}
              className="mt-2 w-full rounded-lg border border-hairline px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="skip">Skip duplicates</option>
              <option value="overwrite">Overwrite duplicates</option>
              <option value="fail">Fail the row (mark as error)</option>
            </select>
          </div>

          {entity.entity === "invoices" && (
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="autocreate"
                checked={config.autoCreateMissingCustomers}
                onChange={(e) => onChange({ ...config, autoCreateMissingCustomers: e.target.checked })}
                className="mt-0.5 accent-brand"
              />
              <label htmlFor="autocreate" className="text-sm text-ink-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-medium text-ink">Auto-create missing customers</span>
                  <InfoTooltip text="What it does: if an invoice's Customer ID doesn't exist yet, a minimal customer record is created automatically instead of failing the row. When to use: turn this on when your invoice file might reference brand-new customers you haven't punched into Customer Master yet. How to choose: leave it off if you want unknown customer codes caught as errors so you can fix typos before anything is created." />
                </span>
                <p className="text-xs text-ink-muted">If an invoice references a customer code that doesn't exist yet, create a minimal customer record instead of failing the row.</p>
              </label>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Date format</label>
              <InfoTooltip text="What it does: tells the importer how to read ambiguous dates like 03/04/2026. When to use: change this if your source system exports dates as DD/MM/YYYY or MM/DD/YYYY instead of the unambiguous ISO format. How to choose: check a known date in your file (e.g. the 25th of a month) to see which format it's actually in, then match it here." />
            </div>
            <p className="mt-1 text-xs text-ink-muted">How to interpret ambiguous dates like 03/04/2026.</p>
            <select
              value={config.dateFormat}
              onChange={(e) => onChange({ ...config, dateFormat: e.target.value as ImportConfig["dateFormat"] })}
              className="mt-2 w-full rounded-lg border border-hairline px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="auto">Auto-detect (ISO, then day/month/year)</option>
              <option value="YMD">YYYY-MM-DD</option>
              <option value="DMY">DD/MM/YYYY</option>
              <option value="MDY">MM/DD/YYYY</option>
            </select>
          </div>
        </div>

        <div className="space-y-5 rounded-xl border border-hairline bg-surface p-5 shadow-card">
          <div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Batch size</label>
              <InfoTooltip text="What it does: how many rows are sent to the database in a single request. When to use the defaults: 500 works well for most files. How to choose: raise it for very large, clean files to import faster; lower it if you're seeing whole batches fail together, so a single bad row affects fewer of its neighbors." />
            </div>
            <p className="mt-1 text-xs text-ink-muted">Rows sent to the database per request. Larger batches are faster; smaller batches isolate errors better.</p>
            <input
              type="number"
              min={50}
              max={2000}
              step={50}
              value={config.batchSize}
              onChange={(e) => onChange({ ...config, batchSize: Math.min(2000, Math.max(50, Number(e.target.value) || 500)) })}
              className="mt-2 w-full rounded-lg border border-hairline px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="continue"
              checked={config.continueOnError}
              onChange={(e) => onChange({ ...config, continueOnError: e.target.checked })}
              className="mt-0.5 accent-brand"
            />
            <label htmlFor="continue" className="text-sm text-ink-secondary">
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium text-ink">Continue after recoverable errors</span>
                <InfoTooltip text="What it does: rows that still have unresolved errors are skipped and reported instead of stopping the whole import. When to use: keep this on for almost every real import. How to choose: only turn it off if you need an all-or-nothing import — e.g. a strict data-migration run where any bad row should halt everything for review." />
              </span>
              <p className="text-xs text-ink-muted">Rows that still have unresolved errors are skipped and reported, instead of stopping the whole import.</p>
            </label>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Currency</label>
              <InfoTooltip text="What it does: labels how amounts are displayed in this import's reports. When to use: this system has no per-record currency column, so it's set once for the whole file rather than per row. How to choose: pick the currency your source file's amounts are actually denominated in." />
            </div>
            <p className="mt-1 text-xs text-ink-muted">Used for formatting in reports — amounts are stored as plain numbers.</p>
            <select
              value={config.defaultCurrency}
              onChange={(e) => onChange({ ...config, defaultCurrency: e.target.value })}
              className="mt-2 w-full rounded-lg border border-hairline px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-brand/30 bg-brand/5 p-5">
        <p className="text-sm font-bold text-ink">Ready to import</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-surface p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-success">✅ Ready to Import</p>
            <p className="mt-1 text-2xl font-bold text-success">{readyRows.length.toLocaleString()}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {toCreate.toLocaleString()} to create, {toUpdate.toLocaleString()} to update
            </p>
          </div>

          <div className="rounded-lg bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">🚫 Excluded</p>
              {excludedRows.length > 0 && (
                <button type="button" onClick={() => setShowExcluded((v) => !v)} className="text-xs font-medium text-brand hover:underline">
                  {showExcluded ? "Hide" : "Review"}
                </button>
              )}
            </div>
            <p className="mt-1 text-2xl font-bold text-ink-muted">{excludedRows.length.toLocaleString()}</p>
            <p className="mt-1 text-xs text-ink-muted">Manually excluded in Step 4.</p>
          </div>

          <div className="rounded-lg bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-danger">⚠️ Blocked</p>
              {blockedRows.length > 0 && (
                <button type="button" onClick={() => setShowBlocked((v) => !v)} className="text-xs font-medium text-brand hover:underline">
                  {showBlocked ? "Hide" : "Review"}
                </button>
              )}
            </div>
            <p className="mt-1 text-2xl font-bold text-danger">{blockedRows.length.toLocaleString()}</p>
            <p className="mt-1 text-xs text-ink-muted">Unresolved errors or duplicate-policy skips.</p>
          </div>
        </div>

        {showExcluded && excludedRows.length > 0 && (
          <ReviewList title="Excluded rows" rows={excludedRows} uniqueKey={entity.uniqueKey} />
        )}
        {showBlocked && blockedRows.length > 0 && (
          <ReviewList title="Blocked rows" rows={blockedRows} uniqueKey={entity.uniqueKey} />
        )}

        {mode !== "create" && <p className="mt-3 text-xs text-ink-muted">Mode: {mode === "update" ? "Update Existing" : "Create or Update (Upsert)"}.</p>}
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-section">
          Back to validation
        </button>
        <button
          type="button"
          disabled={readyRows.length === 0}
          onClick={onNext}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start import
        </button>
      </div>
    </div>
  );
}

function ReviewList({ title, rows, uniqueKey }: { title: string; rows: ImportRow[]; uniqueKey: string }) {
  return (
    <div className="mt-4 rounded-lg border border-hairline bg-surface">
      <p className="border-b border-hairline px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
      <div className="max-h-56 overflow-y-auto">
        <table className="w-full text-xs">
          <tbody>
            {rows.slice(0, 200).map((r) => (
              <tr key={r.rowIndex} className="border-b border-hairline last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-ink-muted">#{r.rowIndex + 1}</td>
                <td className="whitespace-nowrap px-4 py-2 font-medium text-ink-secondary">{r.values[uniqueKey] || "—"}</td>
                <td className="px-4 py-2 text-ink-muted">{reasonFor(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 200 && <p className="px-4 py-2 text-xs text-ink-muted">+{rows.length - 200} more not shown.</p>}
    </div>
  );
}
