"use client";

import { useCallback, useRef, useState } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setFileError(null);
      setProgressRows(0);
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
          dragOver ? "border-brand bg-brand/5" : "border-slate-300 bg-white hover:border-brand/50"
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
        <p className="text-sm font-semibold text-slate-700">Drag & drop a CSV file here, or click to browse</p>
        <p className="mt-1 text-xs text-slate-400">CSV only · UTF-8 · large files are streamed so the page stays responsive</p>
        {loading && <p className="mt-4 text-sm text-brand">Reading file… {progressRows.toLocaleString()} rows so far</p>}
      </div>

      {fileError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{fileError}</p>}

      {parsed && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{parsed.fileName}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatBytes(parsed.fileSizeBytes)} · {parsed.rowCount.toLocaleString()} rows · {parsed.headers.length} columns
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Replace file
            </button>
          </div>

          {parsed.truncated && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This file has more rows than the 100,000-row limit — only the first {parsed.rowCount.toLocaleString()} were loaded.
            </p>
          )}

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Preview — first {Math.min(50, parsed.rows.length).toLocaleString()} of {parsed.rowCount.toLocaleString()} rows
            </p>
            <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-max text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 text-left">
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold text-slate-500">#</th>
                    {parsed.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold text-slate-600">
                        {h || <em className="text-slate-400">(blank)</em>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-1.5 text-slate-400">{i + 1}</td>
                      {parsed.headers.map((h) => (
                        <td key={h} className="max-w-[16rem] truncate whitespace-nowrap px-3 py-1.5 text-slate-700">
                          {row[h] || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.rowCount > 50 && (
              <p className="mt-1.5 text-xs text-slate-400">…and {(parsed.rowCount - 50).toLocaleString()} more rows, not shown here — they'll all be validated in Step 4.</p>
            )}
          </div>

          {issues.length > 0 && (
            <div className="mt-4 space-y-2">
              {issues.map((issue, i) => (
                <p
                  key={i}
                  className={`rounded-lg px-3 py-2 text-xs ${
                    issue.level === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
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

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
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
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Back
        </button>
        <button
          type="button"
          disabled={!parsed || hasBlockingIssue}
          onClick={onNext}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue to field mapping
        </button>
      </div>
    </div>
  );
}
