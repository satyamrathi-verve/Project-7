import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EntityConfig,
  FieldMapping,
  ImportConfig,
  ImportEntity,
  ImportMode,
  ImportRow,
  ParsedCsv,
  RowCategory,
  RowIssue,
} from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseDateFlexible(raw: string, format: ImportConfig["dateFormat"]): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  const slashDMY = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;

  const tryYMD = () => (iso.test(s) ? s : null);
  const trySlash = (dayFirst: boolean) => {
    const m = s.match(slashDMY);
    if (!m) return null;
    const [, p1, p2, year] = m;
    const day = dayFirst ? p1 : p2;
    const month = dayFirst ? p2 : p1;
    const d = Number(day);
    const mo = Number(month);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  // ISO (YYYY-MM-DD) is never ambiguous, so it's always accepted regardless of which
  // format the user picked — the format setting only disambiguates slash-separated
  // dates. Previously an explicit DMY/MDY choice skipped the ISO check entirely,
  // which broke re-imports of the app's own exports (Postgres/Supabase dates are ISO).
  if (format === "YMD") return tryYMD();
  if (format === "DMY") return tryYMD() ?? trySlash(true);
  if (format === "MDY") return tryYMD() ?? trySlash(false);

  // auto: ISO first (unambiguous), then DMY (most common outside the US), then MDY.
  return tryYMD() ?? trySlash(true) ?? trySlash(false) ?? null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Step 1: pure, offline validation — shape/type/required checks only. No DB calls. */
export function buildInitialRows(parsed: ParsedCsv, mapping: FieldMapping, entity: EntityConfig): ImportRow[] {
  const mappedHeaders = Object.entries(mapping).filter(([, target]) => target != null) as [string, string][];

  return parsed.rows.map((raw, rowIndex) => {
    const values: Record<string, string> = {};
    for (const field of entity.fields) values[field.key] = "";
    for (const [header, target] of mappedHeaders) {
      values[target] = (raw[header] ?? "").trim();
    }

    const issues = validateFieldShapes(values, entity, DEFAULT_CONFIG_FOR_SHAPE);
    return finalizeRow(rowIndex, values, issues, null, "create");
  });
}

// Shape validation never needs the real config's dateFormat choice to catch a truly
// malformed cell, so a fixed "auto" pass is enough at this stage; the DB pass below
// re-validates dates using the user's chosen format.
const DEFAULT_CONFIG_FOR_SHAPE: Pick<ImportConfig, "dateFormat"> = { dateFormat: "auto" };

function validateFieldShapes(
  values: Record<string, string>,
  entity: EntityConfig,
  cfg: Pick<ImportConfig, "dateFormat">
): RowIssue[] {
  const issues: RowIssue[] = [];

  for (const field of entity.fields) {
    const raw = values[field.key] ?? "";

    if (field.required && raw === "") {
      issues.push({ field: field.key, level: "error", message: `${field.label} is required.` });
      continue;
    }
    if (raw === "") continue;

    switch (field.type) {
      case "number":
        if (Number.isNaN(Number(raw))) {
          issues.push({ field: field.key, level: "error", message: `${field.label} must be a number.` });
        } else if (Number(raw) < 0 && (field.key === "total" || field.key === "subtotal" || field.key === "credit_limit")) {
          issues.push({ field: field.key, level: "error", message: `${field.label} cannot be negative.` });
        }
        break;
      case "date":
        if (!parseDateFlexible(raw, cfg.dateFormat)) {
          issues.push({ field: field.key, level: "error", message: `${field.label} isn't a recognized date. Use YYYY-MM-DD or set the date format in Import Configuration.` });
        }
        break;
      case "email":
        if (!EMAIL_RE.test(raw)) {
          issues.push({ field: field.key, level: "warning", message: `${field.label} doesn't look like a valid email.` });
        }
        break;
      case "enum":
        if (field.enumValues && !field.enumValues.includes(raw.toLowerCase())) {
          issues.push({ field: field.key, level: "warning", message: `${field.label} "${raw}" isn't one of ${field.enumValues.join(", ")} — will default to "${field.enumValues[0]}".` });
        }
        break;
    }
  }

  if (entity.entity === "invoices" && values.subtotal !== "") {
    // Subtotal is optional (computed from Invoice Amount − Tax when blank) — only
    // worth cross-checking when the file actually supplied one.
    const subtotal = Number(values.subtotal);
    const tax = Number(values.tax_amount || 0);
    const total = values.total ? Number(values.total) : null;
    if (total != null && !Number.isNaN(total) && !Number.isNaN(subtotal) && !Number.isNaN(tax)) {
      const expected = subtotal + tax;
      if (Math.abs(expected - total) > 0.5) {
        issues.push({ field: "total", level: "warning", message: `Invoice Amount (${total}) doesn't match Subtotal + Tax (${expected.toFixed(2)}).` });
      }
    }
  }

  if (entity.crossFieldValidate) {
    issues.push(...entity.crossFieldValidate(values));
  }

  return issues;
}

/**
 * Buckets a row into exactly one category (priority order: excluded > duplicate >
 * error), so the Step 4 summary cards, their click-to-filter behavior, and the
 * visible row count always agree with each other. Warning-only rows (e.g. a
 * slightly-off email) still count as "valid" — they aren't blocking and will still
 * import — matching the classic Errors / Duplicates / Valid split.
 */
export function categorizeRow(row: ImportRow, uniqueKey: string): RowCategory {
  if (row.excluded) return "excluded";
  if (row.issues.some((i) => i.field === uniqueKey)) return "duplicate";
  if (row.status === "error") return "error";
  return "valid";
}

function finalizeRow(
  rowIndex: number,
  values: Record<string, string>,
  issues: RowIssue[],
  existing: Record<string, unknown> | null,
  action: ImportRow["action"]
): ImportRow {
  const hasError = issues.some((i) => i.level === "error");
  const hasWarning = issues.some((i) => i.level === "warning");
  return {
    rowIndex,
    values,
    issues,
    status: hasError ? "error" : hasWarning ? "warning" : "valid",
    existing,
    action,
    excluded: false,
  };
}

export interface DbCheckContext {
  existingByKey: Map<string, Record<string, unknown>>;
  customersByCode: Map<string, Record<string, unknown>>;
}

/** Step 2: queries Supabase for existing rows so duplicate/update matching is accurate. */
export async function fetchDbCheckContext(
  rows: ImportRow[],
  entity: EntityConfig,
  client: SupabaseClient
): Promise<DbCheckContext> {
  const keys = [...new Set(rows.map((r) => r.values[entity.uniqueKey]).filter(Boolean))];
  const existingByKey = new Map<string, Record<string, unknown>>();

  for (const batch of chunk(keys, 300)) {
    if (batch.length === 0) continue;
    const { data } = await client.from(entity.table).select("*").in(entity.uniqueKey, batch);
    for (const row of data ?? []) existingByKey.set(String((row as Record<string, unknown>)[entity.uniqueKey]), row as Record<string, unknown>);
  }

  const customersByCode = new Map<string, Record<string, unknown>>();
  if (entity.entity === "invoices") {
    const codes = [...new Set(rows.map((r) => r.values.customer_code).filter(Boolean))];
    for (const batch of chunk(codes, 300)) {
      if (batch.length === 0) continue;
      const { data } = await client.from("customers").select("*").in("code", batch);
      for (const row of data ?? []) customersByCode.set(String((row as Record<string, unknown>).code), row as Record<string, unknown>);
    }
  }

  return { existingByKey, customersByCode };
}

/**
 * Re-validates every row against real DB state + the chosen import mode/config:
 * duplicate handling, "update" rows with no match, invoice customer lookups, etc.
 * Pure/synchronous so it can also be called instantly after an inline cell edit.
 */
export function applyDbChecks(
  rows: ImportRow[],
  entity: EntityConfig,
  mode: ImportMode,
  config: ImportConfig,
  ctx: DbCheckContext
): ImportRow[] {
  // Two passes: first find, per key, which row is the "winner" (last occurrence —
  // matches how a human re-punching the same code twice would expect the later
  // value to stick) so only one row per key is ever sent to the database. Sending
  // two rows with the same unique key in one upsert() call fails the whole batch
  // (Postgres: "ON CONFLICT DO UPDATE command cannot affect row a second time").
  const lastIndexForKey = new Map<string, number>();
  const firstIndexForKey = new Map<string, number>();
  for (const row of rows) {
    const key = row.values[entity.uniqueKey];
    if (!key) continue;
    if (!firstIndexForKey.has(key)) firstIndexForKey.set(key, row.rowIndex);
    lastIndexForKey.set(key, row.rowIndex);
  }

  return rows.map((row) => {
    const key = row.values[entity.uniqueKey];
    const issues: RowIssue[] = validateFieldShapes(row.values, entity, config);
    const existing = key ? ctx.existingByKey.get(key) ?? null : null;
    let action: ImportRow["action"] = "create";

    const isSupersededDuplicate = key ? lastIndexForKey.get(key) !== row.rowIndex : false;
    if (key && (isSupersededDuplicate || firstIndexForKey.get(key) !== lastIndexForKey.get(key))) {
      if (isSupersededDuplicate) {
        issues.push({
          field: entity.uniqueKey,
          level: config.duplicateHandling === "fail" ? "error" : "warning",
          message: `Duplicate ${entity.uniqueKey} "${key}" — row ${(lastIndexForKey.get(key) ?? 0) + 1} in this file will be used instead of this one.`,
        });
      } else {
        issues.push({
          field: entity.uniqueKey,
          level: config.duplicateHandling === "fail" ? "error" : "warning",
          message: `Duplicate ${entity.uniqueKey} "${key}" also appears on row ${(firstIndexForKey.get(key) ?? 0) + 1} — this row's values will be used.`,
        });
      }
    }

    if (isSupersededDuplicate) {
      return { ...finalizeRow(row.rowIndex, row.values, issues, existing, "skip"), excluded: row.excluded };
    }

    if (mode === "create") {
      if (existing) {
        if (config.duplicateHandling === "fail") {
          issues.push({ field: entity.uniqueKey, level: "error", message: `${entity.uniqueKey} "${key}" already exists. Switch to Update or Upsert, or change duplicate handling.` });
          action = "skip";
        } else if (config.duplicateHandling === "skip") {
          issues.push({ field: entity.uniqueKey, level: "warning", message: `${entity.uniqueKey} "${key}" already exists — this row will be skipped.` });
          action = "skip";
        } else {
          issues.push({ field: entity.uniqueKey, level: "warning", message: `${entity.uniqueKey} "${key}" already exists — this row will overwrite it.` });
          action = "update";
        }
      } else {
        action = "create";
      }
    } else if (mode === "update") {
      if (!existing) {
        issues.push({ field: entity.uniqueKey, level: "error", message: `No existing ${entity.label.toLowerCase().slice(0, -1)} found with ${entity.uniqueKey} "${key}" to update.` });
        action = "skip";
      } else {
        action = "update";
      }
    } else {
      action = existing ? "update" : "create";
    }

    if (entity.entity === "invoices" && row.values.customer_code) {
      const customer = ctx.customersByCode.get(row.values.customer_code);
      if (!customer) {
        if (config.autoCreateMissingCustomers) {
          issues.push({ field: "customer_code", level: "warning", message: `Customer "${row.values.customer_code}" doesn't exist yet — a new customer record will be created.` });
        } else {
          issues.push({ field: "customer_code", level: "error", message: `Customer "${row.values.customer_code}" not found. Enable "auto-create missing customers" or fix the code.` });
        }
      }
    }

    const finalized = finalizeRow(row.rowIndex, row.values, issues, existing, action);
    return { ...finalized, excluded: row.excluded };
  });
}
