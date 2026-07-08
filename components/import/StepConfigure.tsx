"use client";

import type { EntityConfig, ImportConfig, ImportRow, ImportMode } from "@/lib/import/types";

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
  const eligible = rows.filter((r) => !r.excluded && r.action !== "skip");
  const toCreate = eligible.filter((r) => r.action === "create" && r.status !== "error").length;
  const toUpdate = eligible.filter((r) => r.action === "update" && r.status !== "error").length;
  const blocked = eligible.filter((r) => r.status === "error").length;
  const skipped = rows.length - eligible.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duplicate handling (Create New mode)</label>
            <p className="mt-1 text-xs text-slate-400">What to do when a row's {entity.uniqueKey.replace("_", " ")} already exists in the database.</p>
            <select
              value={config.duplicateHandling}
              onChange={(e) => onChange({ ...config, duplicateHandling: e.target.value as ImportConfig["duplicateHandling"] })}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
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
                className="mt-0.5"
              />
              <label htmlFor="autocreate" className="text-sm text-slate-700">
                <span className="font-medium">Auto-create missing customers</span>
                <p className="text-xs text-slate-400">If an invoice references a customer code that doesn't exist yet, create a minimal customer record instead of failing the row.</p>
              </label>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date format</label>
            <p className="mt-1 text-xs text-slate-400">How to interpret ambiguous dates like 03/04/2026.</p>
            <select
              value={config.dateFormat}
              onChange={(e) => onChange({ ...config, dateFormat: e.target.value as ImportConfig["dateFormat"] })}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="auto">Auto-detect (ISO, then day/month/year)</option>
              <option value="YMD">YYYY-MM-DD</option>
              <option value="DMY">DD/MM/YYYY</option>
              <option value="MDY">MM/DD/YYYY</option>
            </select>
          </div>
        </div>

        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Batch size</label>
            <p className="mt-1 text-xs text-slate-400">Rows sent to the database per request. Larger batches are faster; smaller batches isolate errors better.</p>
            <input
              type="number"
              min={50}
              max={2000}
              step={50}
              value={config.batchSize}
              onChange={(e) => onChange({ ...config, batchSize: Math.min(2000, Math.max(50, Number(e.target.value) || 500)) })}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="continue"
              checked={config.continueOnError}
              onChange={(e) => onChange({ ...config, continueOnError: e.target.checked })}
              className="mt-0.5"
            />
            <label htmlFor="continue" className="text-sm text-slate-700">
              <span className="font-medium">Continue after recoverable errors</span>
              <p className="text-xs text-slate-400">Rows that still have unresolved errors are skipped and reported, instead of stopping the whole import.</p>
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Currency</label>
            <p className="mt-1 text-xs text-slate-400">Used only for formatting in reports — amounts are stored as plain numbers.</p>
            <input
              value={config.defaultCurrency}
              onChange={(e) => onChange({ ...config, defaultCurrency: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-brand/30 bg-brand/5 p-5">
        <p className="text-sm font-bold text-slate-900">Ready to import</p>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Will create</p>
            <p className="text-xl font-bold text-emerald-600">{toCreate.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Will update</p>
            <p className="text-xl font-bold text-blue-600">{toUpdate.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Skipped / excluded</p>
            <p className="text-xl font-bold text-slate-500">{skipped.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Blocked by errors</p>
            <p className="text-xl font-bold text-red-600">{blocked.toLocaleString()}</p>
          </div>
        </div>
        {mode !== "create" && <p className="mt-3 text-xs text-slate-500">Mode: {mode === "update" ? "Update Existing" : "Create or Update (Upsert)"}.</p>}
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Back to validation
        </button>
        <button
          type="button"
          disabled={toCreate + toUpdate === 0}
          onClick={onNext}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start import
        </button>
      </div>
    </div>
  );
}
