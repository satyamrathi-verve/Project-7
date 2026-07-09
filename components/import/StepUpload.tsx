"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { EntityConfig } from "@/lib/import/types";
import type { ParsedCsv, CsvFileIssue } from "@/lib/import/types";
import { parseCsvFile, buildSampleCsv, downloadTextFile, formatBytes } from "@/lib/import/csv";

export function StepUpload({
  entity,
  parsed,
  onParsed,
  onBack,
  onNext,
}: {
  entity: EntityConfig;
  parsed: ParsedCsv | null;
  onParsed: (parsed: ParsedCsv, issues: CsvFileIssue[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressRows, setProgressRows] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [issues, setIssues] = useState<CsvFileIssue[]>([]);
  const [previewSearch, setPreviewSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setFileError(null);
      setProgressRows(0);
      setPreviewSearch("");
      try {
        const { parsed: result, issues: fileIssues } = await parseCsvFile(file, setProgressRows);
        setIssues(fileIssues);
        onParsed(result, fileIssues);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Couldn't read that file.");
      } finally {
        setLoading(false);
      }
    },
    [onParsed]
  );

  const hasBlockingIssue = issues.some((i) => i.level === "error");

  // Searches the FULL file (not just the first 50 rows), so you can confirm a
  // specific record made it into the file before committing to mapping/validation.
  // Indexes are carried alongside each row (rather than re-derived with indexOf)
  // so filtering a 100k-row file on every keystroke stays cheap.
  const matchedRows = useMemo(() => {
    if (!parsed) return [];
    const term = previewSearch.trim().toLowerCase();
    const indexed = parsed.rows.map((row, index) => ({ row, index }));
    if (!term) return indexed;
    return indexed.filter(({ row }) => Object.values(row).join(" ").toLowerCase().includes(term));
  }, [parsed, previewSearch]);
  const visibleRows = matchedRows.slice(0, 50);

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? "border-brand bg-brand/5" : "border-hairline bg-surface hover:border-brand/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <p className="text-sm font-semibold text-ink-secondary">📤 Drag &amp; drop a CSV file here, or click to browse</p>
        <p className="mt-1 text-xs text-ink-muted">CSV only · UTF-8 · large files are streamed so the page stays responsive</p>
        {loading && <p className="mt-4 text-sm text-brand">Reading file… {progressRows.toLocaleString()} rows so far</p>}
      </div>

      {fileError && <p className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger">{fileError}</p>}

      {parsed && (
        <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink">{parsed.fileName}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {formatBytes(parsed.fileSizeBytes)} · {parsed.rowCount.toLocaleString()} rows · {parsed.headers.length} columns
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-section"
            >
              Replace file
            </button>
          </div>

          {parsed.truncated && (
            <p className="mt-3 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning">
              This file has more rows than the 100,000-row limit — only the first {parsed.rowCount.toLocaleString()} were loaded.
            </p>
          )}

          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Preview — {previewSearch ? `${matchedRows.length.toLocaleString()} matching, showing first ${visibleRows.length.toLocaleString()}` : `first ${visibleRows.length.toLocaleString()} of ${parsed.rowCount.toLocaleString()} rows`}
              </p>
              <input
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                placeholder="Filter preview…"
                className="rounded-lg border border-hairline px-2.5 py-1 text-xs outline-none focus:border-brand"
              />
            </div>
            <div className="max-h-80 overflow-auto rounded-lg border border-hairline">
              <table className="w-full min-w-max text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-section text-left">
                    <th className="whitespace-nowrap border-b border-hairline px-3 py-2 font-semibold text-ink-muted">#</th>
                    {parsed.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap border-b border-hairline px-3 py-2 font-semibold text-ink-secondary">
                        {h || <em className="text-ink-muted">(blank)</em>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={parsed.headers.length + 1} className="px-4 py-8 text-center text-ink-muted">
                        No rows match “{previewSearch}”.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map(({ row, index }) => (
                      <tr key={index} className="border-b border-hairline last:border-0 hover:bg-section">
                        <td className="whitespace-nowrap px-3 py-1.5 text-ink-muted">{index + 1}</td>
                        {parsed.headers.map((h) => (
                          <td key={h} className="max-w-[16rem] truncate whitespace-nowrap px-3 py-1.5 text-ink-secondary">
                            {row[h] || <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {matchedRows.length > 50 && (
              <p className="mt-1.5 text-xs text-ink-muted">…and {(matchedRows.length - 50).toLocaleString()} more matching rows, not shown here — they'll all be validated in Step 4.</p>
            )}
          </div>

          {issues.length > 0 && (
            <div className="mt-4 space-y-2">
              {issues.map((issue, i) => (
                <p
                  key={i}
                  className={`rounded-lg px-3 py-2 text-xs ${
                    issue.level === "error" ? "border border-danger-border bg-danger-bg text-danger" : "border border-warning-border bg-warning-bg text-warning"
                  }`}
                >
                  {issue.level === "error" ? "⚠ " : "ⓘ "}
                  {issue.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-hairline bg-section p-4 text-sm text-ink-secondary">
        Not sure of the format?{" "}
        <button
          type="button"
          onClick={() =>
            downloadTextFile(
              `${entity.entity}-sample.csv`,
              buildSampleCsv(entity.fields.map((f) => f.key), entity.sampleRows)
            )
          }
          className="font-medium text-brand hover:underline"
        >
          Download a sample {entity.label.toLowerCase()} CSV
        </button>{" "}
        to see the expected columns.
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-section">
          Back
        </button>
        <button
          type="button"
          disabled={!parsed || hasBlockingIssue}
          onClick={onNext}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue to field mapping
        </button>
      </div>
    </div>
  );
}
