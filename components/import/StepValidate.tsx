"use client";

import { useMemo, useState } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import type { EntityConfig, ImportRow, RowStatus, RowCategory } from "@/lib/import/types";
import { categorizeRow } from "@/lib/import/validate";

type Filter = "all" | RowCategory;

const STATUS_DOT: Record<RowStatus, string> = {
  valid: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
};

const CARD_DEFS: { key: Filter; label: string; icon: string; tone: string; ring: string }[] = [
  { key: "all", label: "Total", icon: "📋", tone: "text-ink", ring: "ring-brand" },
  { key: "valid", label: "Valid", icon: "✅", tone: "text-success", ring: "ring-success" },
  { key: "error", label: "Errors", icon: "⚠️", tone: "text-danger", ring: "ring-danger" },
  { key: "duplicate", label: "Duplicates", icon: "🗂️", tone: "text-info", ring: "ring-info" },
  { key: "excluded", label: "Excluded", icon: "🚫", tone: "text-ink-muted", ring: "ring-ink-muted" },
];

/*
  Quick filter cards drive the SAME `filter` state that the search box narrows
  further, so cards + free-text search always compose (never fight each other) —
  and the count shown on each card is computed with the identical predicate used
  to actually filter the table, so the number never drifts from what's on screen.
*/
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
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Every row is categorized exactly once (see categorizeRow), so these counts
  // always add up to the total — the cards, the filter they drive, and the row
  // count shown below can never disagree with each other.
  const categorized = useMemo(() => rows.map((r) => ({ row: r, category: categorizeRow(r, entity.uniqueKey) })), [rows, entity.uniqueKey]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, valid: 0, duplicate: 0, error: 0, excluded: 0 };
    for (const { category } of categorized) c[category]++;
    return c;
  }, [categorized, rows.length]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categorized
      .filter(({ category }) => filter === "all" || category === filter)
      .filter(({ row }) => {
        if (!term) return true;
        return Object.values(row.values).join(" ").toLowerCase().includes(term);
      })
      .map(({ row }) => row);
  }, [categorized, filter, search]);

  const blockingErrors = rows.filter((r) => !r.excluded && r.status === "error").length;

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
      <div style={style} className="flex items-center border-b border-hairline px-2 text-xs">
        <div className="grid w-full items-center gap-0" style={{ gridTemplateColumns: gridTemplate }}>
          <input type="checkbox" checked={selected.has(row.rowIndex)} onChange={() => toggleSelected(row.rowIndex)} />
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[row.status]}`} title={row.status} />
          <span className="text-ink-muted">#{row.rowIndex + 1}</span>
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
                      ? "border-danger-border bg-danger-bg"
                      : issue?.level === "warning"
                      ? "border-warning-border bg-warning-bg"
                      : "border-transparent bg-transparent hover:border-hairline"
                  }`}
                />
              </div>
            );
          })}
          <div className="flex flex-col justify-center gap-0.5 py-1 pl-2">
            {row.issues.length === 0 ? (
              <span className="text-ink-muted/60">—</span>
            ) : (
              row.issues.slice(0, 2).map((issue, i) => (
                <p
                  key={i}
                  title={issue.message}
                  className={`truncate text-[11px] leading-tight ${issue.level === "error" ? "text-danger" : "text-warning"}`}
                >
                  <span className="font-semibold">{fieldLabel(issue.field)}:</span> {issue.message}
                </p>
              ))
            )}
            {row.issues.length > 2 && <p className="text-[10px] text-ink-muted">+{row.issues.length - 2} more</p>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Quick filter cards — click any one to instantly narrow the table below.
          The active card is highlighted with a colored ring + tinted background. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CARD_DEFS.map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              aria-pressed={active}
              className={`rounded-xl border p-4 text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover ${
                active ? `border-transparent bg-surface ring-2 ${c.ring}` : "border-hairline bg-surface hover:border-brand/40"
              }`}
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <span aria-hidden>{c.icon}</span>
                {c.label}
              </p>
              <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{counts[c.key].toLocaleString()}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rows…"
            className="rounded-lg border border-hairline px-3 py-1.5 text-xs outline-none focus:border-brand"
          />
          {filter !== "all" && (
            <button type="button" onClick={() => setFilter("all")} className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
              Clear filter ×
            </button>
          )}
        </div>
        <button type="button" onClick={onRevalidate} className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-section">
          Revalidate all
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-ink px-4 py-2.5 text-sm text-white shadow-card">
          <span>{selected.size} row(s) selected</span>
          <button
            type="button"
            className="rounded bg-surface/15 px-3 py-1 text-xs font-medium hover:bg-surface/25"
            onClick={() => {
              onSetExcluded([...selected], true);
              setSelected(new Set());
            }}
          >
            Exclude from import
          </button>
          <button
            type="button"
            className="rounded bg-surface/15 px-3 py-1 text-xs font-medium hover:bg-surface/25"
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

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-card">
        {/* Single scroll container for BOTH the header and the virtualized rows below,
            so dragging the horizontal scrollbar anywhere moves them together. */}
        <div className="overflow-x-auto">
          <div style={{ width: totalWidth }}>
            <div className="border-b border-hairline bg-section px-2 py-2">
              <div className="grid items-center gap-0 text-xs font-semibold text-ink-secondary" style={{ gridTemplateColumns: gridTemplate }}>
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
              <p className="px-4 py-10 text-center text-sm text-ink-muted">No rows match this filter.</p>
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

      <p className="text-xs text-ink-muted">
        Showing {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} rows
        {filter !== "all" && <> — filtered to <strong>{CARD_DEFS.find((c) => c.key === filter)?.label}</strong></>}
        {search && <> matching “{search}”</>}. Edits save on blur — fix a highlighted cell and its message in the Issues column updates instantly.
      </p>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-section">
          Back
        </button>
        <div className="flex items-center gap-3">
          {blockingErrors > 0 && (
            <span className="text-xs text-danger">{blockingErrors} row(s) still have errors — they'll be skipped unless fixed.</span>
          )}
          <button type="button" onClick={onNext} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-dark">
            Continue to import configuration
          </button>
        </div>
      </div>
    </div>
  );
}
