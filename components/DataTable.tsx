import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  /** Optional custom cell; defaults to String(row[key]). */
  render?: (row: T) => ReactNode;
  className?: string;
}

/*
  A plain, reusable table. Copy this pattern for every list screen (invoices,
  receipts, GL accounts…). Pass your columns and rows; it handles the empty state.
*/
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty = "Nothing here yet.",
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-hairline bg-section text-left">
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-3 font-medium text-ink-secondary ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="animate-fade-in px-4 py-14 text-center text-ink-muted">
                <div className="mb-2 text-2xl opacity-70">📭</div>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-hairline/70 transition-colors duration-150 last:border-0 hover:bg-info/[0.06] ${
                  i % 2 === 1 ? "bg-ink/[0.015]" : ""
                }`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 text-ink-secondary ${c.className ?? ""}`}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
