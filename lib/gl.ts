/*
  GL Master enrichment helpers.

  The real `gl_accounts` table only has: code, name, type, parent_group.
  A finance team still needs to *reason* about mapping, posting, AR usage and
  validation — so we DERIVE those classifications from the real columns here
  (never written back to the backend). Anything the user can toggle (archive /
  active) is kept front-end-only in localStorage, exactly like the sign-in gate.
*/
import type { GLAccount } from "./types";

export type Accent = "blue" | "green" | "orange" | "red" | "purple";
export type SyncStatus = "synced" | "pending" | "error";
export type Severity = "ok" | "warn" | "error";

export const TYPE_META: Record<
  GLAccount["type"],
  { label: string; accent: Accent; emoji: string; unit: string; dot: string; chip: string }
> = {
  asset: { label: "Asset", accent: "blue", emoji: "🏦", unit: "Finance", dot: "bg-info", chip: "bg-info-bg text-info" },
  liability: { label: "Liability", accent: "orange", emoji: "📉", unit: "Treasury", dot: "bg-warning", chip: "bg-warning-bg text-warning" },
  income: { label: "Income", accent: "green", emoji: "📈", unit: "Revenue", dot: "bg-success", chip: "bg-success-bg text-success" },
  expense: { label: "Expense", accent: "red", emoji: "💳", unit: "Operations", dot: "bg-danger", chip: "bg-danger-bg text-danger" },
};

export interface Validation {
  label: string;
  ok: boolean;
  severity: Severity;
  fix?: string;
}

export interface Enriched extends GLAccount {
  category: string;
  mapped: boolean;
  active: boolean;
  usedInAr: boolean;
  businessUnit: string;
  syncStatus: SyncStatus;
  validations: Validation[];
  issues: number;
  modifiedInSession: boolean;
}

export function enrichAccount(
  a: GLAccount,
  ctx: { archived: Set<string>; hasGstAccount: boolean; modified: Set<string> }
): Enriched {
  const meta = TYPE_META[a.type];
  const mapped = !!(a.parent_group && a.parent_group.trim());
  const active = !ctx.archived.has(a.id);
  const usedInAr =
    a.type === "income" ||
    a.code === "1100" ||
    (a.parent_group ?? "").toLowerCase().includes("receivable");

  const needsTax = a.type === "income" || a.type === "expense";
  const validations: Validation[] = [
    { label: "Account type set", ok: true, severity: "ok" },
    {
      label: mapped ? "Mapped to a group" : "Missing group mapping",
      ok: mapped,
      severity: mapped ? "ok" : "warn",
      fix: mapped ? undefined : "Assign parent group",
    },
    {
      label: active ? "Posting rule active" : "Account archived — posting blocked",
      ok: active,
      severity: active ? "ok" : "warn",
    },
  ];
  if (needsTax) {
    validations.push({
      label: ctx.hasGstAccount ? "Tax code available" : "Missing tax code",
      ok: ctx.hasGstAccount,
      severity: ctx.hasGstAccount ? "ok" : "warn",
      fix: ctx.hasGstAccount ? undefined : "Link a GST account",
    });
  }
  if (usedInAr) {
    validations.push({ label: "Used in AR posting", ok: true, severity: "ok" });
  }

  const issues = validations.filter((v) => !v.ok).length;
  const syncStatus: SyncStatus = !active ? "pending" : mapped ? "synced" : "error";

  return {
    ...a,
    category: mapped ? (a.parent_group as string) : "Unmapped",
    mapped,
    active,
    usedInAr,
    businessUnit: meta.unit,
    syncStatus,
    validations,
    issues,
    modifiedInSession: ctx.modified.has(a.id),
  };
}

/** Deterministic tiny sparkline from the account code so KPI cards feel alive without randomness. */
export function seedSpark(seed: string, len = 12): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    out.push(40 + (h % 60));
  }
  return out;
}
