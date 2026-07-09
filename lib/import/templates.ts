import type { FieldMapping, ImportEntity, MappingTemplate, UndoRecord } from "./types";

/*
  Mapping templates and the audit trail live in localStorage, not Supabase — CLAUDE.md
  rule #1 is "never touch the backend / never create tables," and a settings table
  for this is not worth breaking that rule for. Trade-off: templates are per-browser,
  not shared across the team. See the "future extensibility" notes in the wizard for
  how this would move server-side (a plain `import_mapping_templates` table, added by
  whoever owns the backend, not by a screen-building teammate).
*/

const TEMPLATES_KEY = "ar-import-mapping-templates";
const AUDIT_KEY = "ar-import-audit-log";

export function listMappingTemplates(entity: ImportEntity): MappingTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    const all: MappingTemplate[] = raw ? JSON.parse(raw) : [];
    return all.filter((t) => t.entity === entity).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export function saveMappingTemplate(entity: ImportEntity, name: string, mapping: FieldMapping): MappingTemplate {
  const template: MappingTemplate = {
    id: `${entity}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    entity,
    mapping,
    savedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(TEMPLATES_KEY);
      const all: MappingTemplate[] = raw ? JSON.parse(raw) : [];
      all.push(template);
      window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(all));
    } catch {
      // Storage full or unavailable — the wizard still works without saved templates.
    }
  }
  return template;
}

export function deleteMappingTemplate(id: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    const all: MappingTemplate[] = raw ? JSON.parse(raw) : [];
    window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(all.filter((t) => t.id !== id)));
  } catch {
    // ignore
  }
}

export type AuditStatus = "success" | "failed" | "partial" | "cancelled";

export interface AuditEntry {
  id: string;
  entity: ImportEntity;
  mode: string;
  fileName: string;
  rowCount: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
  performedAt: string;
  performedBy: string;
  status: AuditStatus;
  /** First few failed rows, kept small so the log doesn't bloat localStorage. */
  failedSample: { key: string; error: string }[];
  /**
   * The exact created/updated row IDs this run touched — lets Import History's
   * Delete actually remove the imported data (not just the log entry). See
   * lib/import/runner.ts: undoImportRun() deletes createdIds and restores
   * updatedPrev. Safe to re-run against already-removed rows (no-op, not an error).
   */
  undo: UndoRecord[];
}

export function appendAuditEntry(entry: AuditEntry) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(AUDIT_KEY);
    const all: AuditEntry[] = raw ? JSON.parse(raw) : [];
    all.unshift(entry);
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify(all.slice(0, 200)));
  } catch {
    // ignore
  }
}

export function listAuditLog(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteAuditEntry(id: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(AUDIT_KEY);
    const all: AuditEntry[] = raw ? JSON.parse(raw) : [];
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify(all.filter((e) => e.id !== id)));
  } catch {
    // ignore
  }
}

export function clearAuditLog() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUDIT_KEY);
  } catch {
    // ignore
  }
}
