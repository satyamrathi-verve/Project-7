"use client";

import { useMemo, useState } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import type { EntityConfig, ImportRow, RowStatus } from "@/lib/import/types";

type StatusFilter = "all" | RowStatus | "excluded";

const STATUS_DOT: Record<RowStatus, string> = {
  valid: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

export function StepValidate({
  entity,
  rows,
  onEditCell,
  onSetExcluded,
  onRevalidate,
  onBack,
  onNext,
}: {
  entity: EntityConfig;
  rows: ImportRow[];
  onEditCell: (rowIndex: number, field: string, value: string) => void;
  onSetExcluded: (rowIndexes: number[], excluded: boolean) => void;
  onRevalidate: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const counts = useMemo(() => {
    const c = { total: rows.length, valid: 0, warning: 0, error: 0, excluded: 0, duplicates: 0 };
    for (const r of rows) {
      if (r.excluded) c.excluded++;
      else c[r.status]++;
      if (r.issues.some((i) => i.field === entity.uniqueKey)) c.duplicates++;
    }
    return c;
  }, [rows, entity.uniqueKey]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "excluded" && !r.excluded) return false;
      if (statusFilter !== "excluded" && r.excluded) return false;
      if (statusFilter !== "all" && statusFilter !== "excluded" && r.status !== statusFilter) return false;
      if (term) {
        const hay = Object.values(r.values).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const blockingErrors = counts.error;

  // Fixed pixel widths (not rem/fr) so the header row and the virtualized list — two
  // separate DOM trees — measure out to the exact same total width. FixedSizeList
  // scrolls horizontally on its own otherwise, which lets the body drift out of sync
  // with the header when there are more columns than fit on screen.
  const CHECKBOX_COL = 40;
  const STATUS_COL = 40;
  const ROW_COL = 64;
  const FIELD_COL = 168;
  const ISSUES_COL = 280;
  const ROW_HEIGHT = 56;
  const columnWidths = [CHECKBOX_COL, STATUS_COL, ROW_COL, ...entity.fields.map(() => FIELD_COL), ISSUES_COL];
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);
  const gridTemplate = columnWidths.map((w) => `${w}px`).join(" ");

  function toggleSelected(rowIndex: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }

  const Row = ({ index, style }: ListChildComponentProps) => {
    const row = filtered[index];
    const fieldLabel = (key: string) => entity.fields.find((f) => f.key === key)?.label ?? key;
    return (
      <div style={style} className="flex items-center border-b border-slate-100 px-2 text-xs">
        <div className="grid w-full items-center gap-0" style={{ gridTemplateColumns: gridTemplate }}>
          <input type="checkbox" checked={selected.has(row.rowIndex)} onChange={() => toggleSelected(row.rowIndex)} />
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[row.status]}`} title={row.status} />
          <span className="text-slate-400">#{row.rowIndex + 1}</span>
          {entity.fields.map((f) => {
            const issue = row.issues.find((i) => i.field === f.key);
            return (
              <div key={f.key} className="pr-2">
                <input
                  defaultValue={row.values[f.key] ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== row.values[f.key]) onEditCell(row.rowIndex, f.key, e.target.value);
                  }}
                  title={issue?.message}
                  className={`w-full rounded border px-1.5 py-1 text-xs outline-none focus:border-brand ${
                    issue?.level === "error"
                      ? "border-red-300 bg-red-50"
                      : issue?.level === "warning"
                      ? "border-amber-300 bg-amber-50"
                      : "border-transparent bg-transparent hover:border-slate-200"
                  }`}
                />
              </div>
            );
          })}
          <div className="flex flex-col justify-center gap-0.5 py-1 pl-2">
            {row.issues.length === 0 ? (
              <span className="text-slate-300">—</span>
            ) : (
              row.issues.slice(0, 2).map((issue, i) => (
                <p
                  key={i}
                  title={issue.message}
                  className={`truncate text-[11px] leading-tight ${issue.level === "error" ? "text-red-600" : "text-amber-700"}`}
                >
                  <span className="font-semibold">{fieldLabel(issue.field)}:</span> {issue.message}
                </p>
              ))
            )}
            {row.issues.length > 2 && <p className="text-[10px] text-slate-400">+{row.issues.length - 2} more</p>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total", value: counts.total, tone: "text-slate-800" },
          { label: "Valid", value: counts.valid, tone: "text-emerald-600" },
          { label: "Warnings", value: counts.warning, tone: "text-amber-600" },
          { label: "Errors", value: counts.error, tone: "text-red-600" },
          { label: "Duplicates", value: counts.duplicates, tone: "text-purple-600" },
          { label: "Excluded", value: counts.excluded, tone: "text-slate-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.tone}`}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rows…"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-brand"
          />
          {(["all", "error", "warning", "valid", "excluded"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
                statusFilter === f ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRevalidate} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          Revalidate all
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-white">
          <span>{selected.size} row(s) selected</span>
          <button
            type="button"
            className="rounded bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25"
            onClick={() => {
              onSetExcluded([...selected], true);
              setSelected(new Set());
            }}
          >
            Exclude from import
          </button>
          <button
            type="button"
            className="rounded bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25"
            onClick={() => {
              onSetExcluded([...selected], false);
              setSelected(new Set());
            }}
          >
            Include in import
          </button>
          <button type="button" className="ml-auto text-xs text-white/70 hover:text-white" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Single scroll container for BOTH the header and the virtualized rows below,
            so dragging the horizontal scrollbar anywhere moves them together. */}
        <div className="overflow-x-auto">
          <div style={{ width: totalWidth }}>
            <div className="border-b border-slate-200 bg-slate-50 px-2 py-2">
              <div className="grid items-center gap-0 text-xs font-semibold text-slate-600" style={{ gridTemplateColumns: gridTemplate }}>
                <span />
                <span>Status</span>
                <span>Row</span>
                {entity.fields.map((f) => (
                  <span key={f.key} className="truncate pr-2">
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                ))}
                <span className="pl-2">Issues</span>
              </div>
            </div>
            {filtered.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">No rows match this filter.</p>
            ) : (
              <FixedSizeList
                height={480}
                itemCount={filtered.length}
                itemSize={ROW_HEIGHT}
                width={totalWidth}
                style={{ overflowX: "hidden" }}
              >
                {Row}
              </FixedSizeList>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Showing {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} rows. Edits save on blur — fix a highlighted cell and its message in the
        Issues column updates instantly.
      </p>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Back
        </button>
        <div className="flex items-center gap-3">
          {blockingErrors > 0 && (
            <span className="text-xs text-red-600">{blockingErrors} row(s) still have errors — they'll be skipped unless fixed.</span>
          )}
          <button type="button" onClick={onNext} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
            Continue to import configuration
          </button>
        </div>
      </div>
    </div>
  );
}
