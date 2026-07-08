import Papa from "papaparse";
import type { CsvFileIssue, ParsedCsv } from "./types";

/** Hard ceiling so a mis-picked multi-GB file can't hang the browser tab. */
const MAX_ROWS = 100_000;

function normalizeHeader(h: string): string {
  return h.trim();
}

/**
 * Streams a CSV file in the browser with Papaparse (chunked, off the main thread
 * isn't possible without a Worker, but Papaparse's `step` callback yields per row so
 * the tab stays responsive even for very large files) and resolves once the whole
 * file has been read into memory as plain string rows.
 *
 * We still buffer the parsed rows client-side (not just count them) because Step 4
 * needs random-access editing over the full data set. For files beyond MAX_ROWS we
 * truncate and surface that clearly rather than silently dropping rows.
 */
export function parseCsvFile(
  file: File,
  onProgress?: (rowsSoFar: number) => void
): Promise<{ parsed: ParsedCsv; issues: CsvFileIssue[] }> {
  return new Promise((resolve, reject) => {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      reject(new Error("Only .csv files are supported."));
      return;
    }
    if (file.size === 0) {
      reject(new Error("This file is empty."));
      return;
    }

    const rows: Record<string, string>[] = [];
    let headers: string[] = [];
    let truncated = false;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      encoding: "UTF-8",
      transformHeader: normalizeHeader,
      step: (result, parser) => {
        if (headers.length === 0) {
          headers = result.meta.fields ?? [];
        }
        if (rows.length >= MAX_ROWS) {
          truncated = true;
          parser.abort();
          return;
        }
        rows.push(result.data);
        if (onProgress && rows.length % 500 === 0) onProgress(rows.length);
      },
      complete: () => {
        onProgress?.(rows.length);
        const issues = validateCsvShape(headers, rows);
        resolve({
          parsed: {
            fileName: file.name,
            fileSizeBytes: file.size,
            headers,
            rows,
            rowCount: rows.length,
            truncated,
          },
          issues,
        });
      },
      error: (err) => reject(err),
    });
  });
}

function validateCsvShape(headers: string[], rows: Record<string, string>[]): CsvFileIssue[] {
  const issues: CsvFileIssue[] = [];

  if (headers.length === 0) {
    issues.push({ level: "error", message: "No header row was detected. The first line must contain column names." });
    return issues;
  }

  const seen = new Map<string, number>();
  for (const h of headers) {
    const key = h.trim().toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const dupes = [...seen.entries()].filter(([, count]) => count > 1).map(([k]) => k);
  if (dupes.length > 0) {
    issues.push({ level: "error", message: `Duplicate column headers: ${dupes.join(", ")}. Rename them so every column is unique.` });
  }

  const blankHeaders = headers.filter((h) => h.trim() === "");
  if (blankHeaders.length > 0) {
    issues.push({ level: "warning", message: `${blankHeaders.length} column(s) have no header name and will be ignored.` });
  }

  if (rows.length === 0) {
    issues.push({ level: "error", message: "The file has headers but no data rows." });
  }

  return issues;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Builds a downloadable sample CSV for an entity from its EntityConfig.sampleRows. */
export function buildSampleCsv(headers: string[], sampleRows: Record<string, string>[]): string {
  return Papa.unparse({ fields: headers, data: sampleRows.map((r) => headers.map((h) => r[h] ?? "")) });
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
