/*
  Shared types for the CSV bulk-import wizard (app/upload). Kept entity-agnostic so
  adding a new import type (Products, Vendors, Payments…) only means adding an
  EntityConfig in lib/import/entities.ts — nothing here needs to change.
*/

export type ImportEntity = "customers" | "invoices";

export type ImportMode = "create" | "update" | "upsert";

export type FieldType = "text" | "number" | "date" | "email" | "enum";

export interface FieldDef {
  /** Target field key in the database row we build. */
  key: string;
  label: string;
  required: boolean;
  type: FieldType;
  enumValues?: string[];
  /** Lowercase, alphanumeric-normalized synonyms used for auto-mapping. */
  synonyms: string[];
  help?: string;
}

/** A business-level requirement shown on Step 1 — doesn't always map 1:1 to a FieldDef. */
export interface MandatoryHighlight {
  label: string;
  note: string;
}

export interface EntityConfig {
  entity: ImportEntity;
  label: string;
  description: string;
  table: string;
  /** Field whose value must be unique — drives duplicate/update matching. */
  uniqueKey: string;
  fields: FieldDef[];
  sampleRows: Record<string, string>[];
  /** Plain-language "what you need before you start" list shown on Step 1. */
  mandatoryHighlights: MandatoryHighlight[];
  /**
   * Rules that span more than one field (e.g. "email OR phone"), which a single
   * FieldDef.required can't express. Runs after per-field validation.
   */
  crossFieldValidate?: (values: Record<string, string>) => { field: string; level: "error" | "warning"; message: string }[];
}

export interface ParsedCsv {
  fileName: string;
  fileSizeBytes: number;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  truncated: boolean;
}

export interface CsvFileIssue {
  level: "error" | "warning";
  message: string;
}

/** csvHeader -> target field key, or null when a column is intentionally ignored. */
export type FieldMapping = Record<string, string | null>;

/** csvHeader -> 0-100 confidence score from the auto-mapper. */
export type MappingConfidence = Record<string, number>;

export type RowStatus = "valid" | "warning" | "error";

/**
 * Mutually exclusive, exhaustive bucket for a row — every row falls into exactly one,
 * so summing the five categories always equals the total row count. Drives both the
 * Step 4 summary cards and the filter they control, so counts can never drift from
 * what's actually shown in the table.
 */
export type RowCategory = "excluded" | "duplicate" | "missing" | "invalid" | "valid";

export interface RowIssue {
  /** Target field key, or "_row" for a whole-row problem. */
  field: string;
  message: string;
  level: "warning" | "error";
}

export type RowAction = "create" | "update" | "skip";

export interface ImportRow {
  rowIndex: number;
  /** Target field key -> current (editable) string value. */
  values: Record<string, string>;
  status: RowStatus;
  issues: RowIssue[];
  action: RowAction;
  /** Previous DB row, when this row matched an existing record by uniqueKey. */
  existing: Record<string, unknown> | null;
  excluded: boolean;
}

export interface ImportConfig {
  duplicateHandling: "skip" | "overwrite" | "fail";
  autoCreateMissingCustomers: boolean;
  dateFormat: "auto" | "YMD" | "DMY" | "MDY";
  defaultCurrency: string;
  batchSize: number;
  continueOnError: boolean;
}

export const DEFAULT_IMPORT_CONFIG: ImportConfig = {
  duplicateHandling: "skip",
  autoCreateMissingCustomers: true,
  dateFormat: "auto",
  defaultCurrency: "INR",
  batchSize: 500,
  continueOnError: true,
};

export interface ImportProgressState {
  stage: "preparing" | "importing" | "done" | "cancelled";
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
  startedAt: number;
  etaSeconds: number | null;
  rowsPerSecond: number;
  currentBatch: number;
  totalBatches: number;
}

export interface ImportResultRow {
  rowIndex: number;
  key: string;
  action: RowAction | "failed";
  error?: string;
}

export interface UndoRecord {
  table: string;
  createdIds: string[];
  updatedPrev: { id: string; prev: Record<string, unknown> }[];
  createdChildTable?: string;
  createdChildIds?: string[];
}

export interface ImportRunResult {
  entity: ImportEntity;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
  rows: ImportResultRow[];
  undo: UndoRecord[];
  cancelled: boolean;
}

export interface MappingTemplate {
  id: string;
  name: string;
  entity: ImportEntity;
  mapping: FieldMapping;
  savedAt: string;
}
