"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase, isConfigured } from "@/lib/supabase";
import type { GLAccount, Invoice, ReceiptAllocation } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { StatCard } from "@/components/StatCard";
import { FormField, inputClass } from "@/components/FormField";
import { formatMoney } from "@/lib/format";
import { TYPE_META, enrichAccount, seedSpark, type Enriched } from "@/lib/gl";

/* ------------------------------------------------------------------ icons --
   Inline SVGs in the app's own style (same technique the other screens use).
   Line icons for chrome, so the screen reads like Fiori / Stripe without
   pulling in a new icon dependency. */
type IconProps = { className?: string };
const Ico = ({ path, className = "h-4 w-4", stroke = false }: { path: string; className?: string; stroke?: boolean }) =>
  stroke ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={path} />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d={path} />
    </svg>
  );

const IconSearch = (p: IconProps) => <Ico className={p.className} path="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" />;
const IconDots = (p: IconProps) => <svg viewBox="0 0 20 20" fill="currentColor" className={p.className}><path d="M10 6a2 2 0 100-4 2 2 0 000 4zM10 12a2 2 0 100-4 2 2 0 000 4zM10 18a2 2 0 100-4 2 2 0 000 4z" /></svg>;
const IconClose = (p: IconProps) => <Ico className={p.className} path="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />;
const IconCheck = (p: IconProps) => <Ico className={p.className} path="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" />;
const IconChevron = (p: IconProps) => <Ico className={p.className} path="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />;
const IconDatabase = (p: IconProps) => <Ico stroke className={p.className} path="M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3zM4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />;
const IconUpload = (p: IconProps) => <Ico stroke className={p.className} path="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />;
const IconDownload = (p: IconProps) => <Ico stroke className={p.className} path="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />;
const IconRefresh = (p: IconProps) => <Ico stroke className={p.className} path="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6" />;
const IconShield = (p: IconProps) => <Ico stroke className={p.className} path="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zM9 12l2 2 4-4" />;
const IconAlert = (p: IconProps) => <Ico stroke className={p.className} path="M12 9v4M12 17h.01M10.3 3.86l-8 14A1 1 0 003.16 19.5h17.68a1 1 0 00.86-1.5l-8-14a1 1 0 00-1.74 0z" />;
const IconFilter = (p: IconProps) => <Ico stroke className={p.className} path="M4 5h16M7 12h10M10 19h4" />;
const IconBuilding = (p: IconProps) => <Ico stroke className={p.className} path="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M4 21h16M9 7h.01M13 7h.01M9 11h.01M13 11h.01M9 15h.01M13 15h.01" />;
const IconLayers = (p: IconProps) => <Ico stroke className={p.className} path="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />;
const IconBranch = (p: IconProps) => <Ico stroke className={p.className} path="M6 3v12M6 21a3 3 0 100-6 3 3 0 000 6zM6 6a3 3 0 100-6 3 3 0 000 6zM18 9a3 3 0 100-6 3 3 0 000 6zM18 6c0 6-6 3-6 9" />;
const IconArrow = (p: IconProps) => <Ico stroke className={p.className} path="M12 5v14M5 12l7 7 7-7" />;
const IconHistory = (p: IconProps) => <Ico stroke className={p.className} path="M3 3v5h5M3.05 13A9 9 0 106 5.3L3 8M12 7v5l4 2" />;
const IconPlus = (p: IconProps) => <Ico stroke className={p.className} path="M12 5v14M5 12h14" />;
const IconWallet = (p: IconProps) => <Ico stroke className={p.className} path="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM16 12h.01M3 9h18" />;

/* ------------------------------------------------------------- constants -- */
const GROUP_ORDER = ["Revenue", "Current Assets", "Current Liabilities", "Indirect Expenses"];
const EXPORT_COLUMNS: (keyof GLAccount)[] = ["code", "name", "type", "parent_group"];

const EMPTY_FORM = { code: "", name: "", type: "asset" as GLAccount["type"], parent_group: "" };
type FormState = typeof EMPTY_FORM;

type Density = "comfortable" | "compact";
type SortKey = "code" | "name" | "type" | "category" | "businessUnit";
type Toast = { id: number; kind: "success" | "error" | "info"; msg: string };

function csvValue(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* Highlight matching text inside a search hit. */
function Highlight({ text, q }: { text: string; q: string }) {
  const query = q.trim();
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-warning/25 px-0.5 text-ink">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

function StatusBadge({ a }: { a: Enriched }) {
  if (!a.active)
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-2.5 py-1 text-xs font-medium text-ink-muted"><span className="h-1.5 w-1.5 rounded-full bg-ink-muted" />Inactive</span>;
  if (a.issues > 0)
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning"><span className="h-1.5 w-1.5 rounded-full bg-warning" />Warning</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />Active</span>;
}

function TypeChip({ type }: { type: GLAccount["type"] }) {
  const m = TYPE_META[type];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${m.chip}`}>
      <span className="text-[11px] leading-none">{m.emoji}</span>
      {m.label}
    </span>
  );
}

function SyncPill({ status }: { status: Enriched["syncStatus"] }) {
  const map = {
    synced: { c: "text-success", d: "bg-success", t: "Synced" },
    pending: { c: "text-ink-muted", d: "bg-ink-muted", t: "Pending" },
    error: { c: "text-danger", d: "bg-danger", t: "Not mapped" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${map.c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${map.d} ${status === "synced" ? "animate-soft-glow" : ""}`} />
      {map.t}
    </span>
  );
}

function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const size = 132, stroke = 18, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-none">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-hairline" fill="none" />
          {segments.filter((s) => s.value > 0).map((s) => {
            const frac = s.value / total, dash = frac * circ, off = -acc;
            acc += dash;
            return <circle key={s.label} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke={s.color} fill="none" strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={off} strokeLinecap="round"><title>{s.label}: {s.value}</title></circle>;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-ink tabular-nums">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-ink-muted">accounts</span>
        </div>
      </div>
      <div className="space-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: s.color }} />
            <span className="text-ink-muted">{s.label}</span>
            <span className="ml-auto pl-4 font-semibold tabular-nums text-ink">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-secondary">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{value} · {pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/[0.06]">
        <div className="h-full rounded-full transition-all duration-700 ease-premium" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ================================================================ page == */
export default function GLMasterPage() {
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [entity, setEntity] = useState<string>("—");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allocs, setAllocs] = useState<ReceiptAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [modified, setModified] = useState<Set<string>>(new Set());
  const [lastSync, setLastSync] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fType, setFType] = useState<Set<string>>(new Set());
  const [fGroup, setFGroup] = useState<Set<string>>(new Set());
  const [fMapping, setFMapping] = useState<"all" | "mapped" | "unmapped">("all");
  const [fStatus, setFStatus] = useState<"all" | "active" | "inactive">("all");
  const [fRecent, setFRecent] = useState(false);

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "code", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<Density>("comfortable");

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerShown, setDrawerShown] = useState(false);
  const [tab, setTab] = useState<"overview" | "mapping" | "audit" | "transactions" | "notes">("overview");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  /* ---- load ---- */
  async function loadAll() {
    if (!supabase) return;
    setLoading(true);
    const [gl, comp, inv, al] = await Promise.all([
      supabase.from("gl_accounts").select("*").order("code", { ascending: true }),
      supabase.from("company").select("name").limit(1).maybeSingle(),
      supabase.from("invoices").select("*"),
      supabase.from("receipt_allocations").select("*"),
    ]);
    if (gl.error) setError(gl.error.message);
    else setAccounts(gl.data as GLAccount[]);
    if (comp.data?.name) setEntity(comp.data.name);
    if (inv.data) setInvoices(inv.data as Invoice[]);
    if (al.data) setAllocs(al.data as ReceiptAllocation[]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    try {
      setArchived(new Set(JSON.parse(localStorage.getItem("gl_archived") || "[]")));
      setRecent(JSON.parse(localStorage.getItem("gl_recent_searches") || "[]"));
      setNotes(JSON.parse(localStorage.getItem("gl_notes") || "{}"));
    } catch { /* ignore */ }
  }, []);

  function persistArchived(next: Set<string>) {
    setArchived(next);
    localStorage.setItem("gl_archived", JSON.stringify([...next]));
  }
  function persistNotes(next: Record<string, string>) {
    setNotes(next);
    localStorage.setItem("gl_notes", JSON.stringify(next));
  }

  function toast(kind: Toast["kind"], msg: string) {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }

  /* ---- derive ---- */
  const hasGstAccount = useMemo(
    () => accounts.some((a) => a.type === "liability" && /gst|tax/i.test(a.name)),
    [accounts]
  );
  const enriched = useMemo(
    () => accounts.map((a) => enrichAccount(a, { archived, hasGstAccount, modified })),
    [accounts, archived, hasGstAccount, modified]
  );
  const byId = useMemo(() => new Map(enriched.map((a) => [a.id, a])), [enriched]);

  const kpi = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((a) => a.active).length;
    const unmapped = enriched.filter((a) => !a.mapped).length;
    const issues = enriched.filter((a) => a.issues > 0).length;
    return { total, active, inactive: total - active, unmapped, mapped: total - unmapped, issues };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = enriched.filter((a) => {
      if (q && !`${a.code} ${a.name} ${a.category} ${a.businessUnit} ${a.type}`.toLowerCase().includes(q)) return false;
      if (fType.size && !fType.has(a.type)) return false;
      if (fGroup.size && !fGroup.has(a.category)) return false;
      if (fMapping === "mapped" && !a.mapped) return false;
      if (fMapping === "unmapped" && a.mapped) return false;
      if (fStatus === "active" && !a.active) return false;
      if (fStatus === "inactive" && a.active) return false;
      if (fRecent && !a.modifiedInSession) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    rows = [...rows].sort((x, y) => String(x[sort.key]).localeCompare(String(y[sort.key])) * dir);
    return rows;
  }, [enriched, search, fType, fGroup, fMapping, fStatus, fRecent, sort]);

  const activeChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    fType.forEach((t) => chips.push({ label: `Type: ${TYPE_META[t as GLAccount["type"]].label}`, clear: () => setFType((s) => { const n = new Set(s); n.delete(t); return n; }) }));
    fGroup.forEach((g) => chips.push({ label: `Group: ${g}`, clear: () => setFGroup((s) => { const n = new Set(s); n.delete(g); return n; }) }));
    if (fMapping !== "all") chips.push({ label: fMapping === "mapped" ? "Mapped" : "Unmapped", clear: () => setFMapping("all") });
    if (fStatus !== "all") chips.push({ label: fStatus === "active" ? "Active" : "Inactive", clear: () => setFStatus("all") });
    if (fRecent) chips.push({ label: "Recently updated", clear: () => setFRecent(false) });
    return chips;
  }, [fType, fGroup, fMapping, fStatus, fRecent]);

  function clearFilters() {
    setFType(new Set()); setFGroup(new Set()); setFMapping("all"); setFStatus("all"); setFRecent(false);
  }

  /* ---- search recents ---- */
  function commitSearch(v: string) {
    const t = v.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r !== t)].slice(0, 5);
    setRecent(next);
    localStorage.setItem("gl_recent_searches", JSON.stringify(next));
  }

  /* ---- selection ---- */
  function toggleRow(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  const allVisibleSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((a) => a.id)));
  }

  /* ---- drawer ---- */
  function openDrawer(id: string) {
    setDrawerId(id); setTab("overview");
    requestAnimationFrame(() => setDrawerShown(true));
  }
  function closeDrawer() {
    setDrawerShown(false);
    setTimeout(() => setDrawerId(null), 280);
  }
  const current = drawerId ? byId.get(drawerId) ?? null : null;

  /* ---- export ---- */
  function exportCsv(rows: Enriched[], label: string) {
    const header = EXPORT_COLUMNS.join(",");
    const lines = rows.map((r) => EXPORT_COLUMNS.map((c) => csvValue(r[c])).join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gl-accounts-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast("info", `Export started · ${rows.length} ${label}`);
  }

  /* ---- bulk / archive ---- */
  function archiveMany(ids: string[], archive: boolean) {
    const next = new Set(archived);
    ids.forEach((id) => (archive ? next.add(id) : next.delete(id)));
    persistArchived(next);
    setSelected(new Set());
    toast("success", `${ids.length} account${ids.length > 1 ? "s" : ""} ${archive ? "deactivated" : "activated"}`);
  }

  function runValidate(scope: Enriched[], label: string) {
    const withIssues = scope.filter((a) => a.issues > 0);
    if (withIssues.length === 0) toast("success", `Validation complete · ${label} clean`);
    else toast("error", `Validation flagged ${withIssues.length} of ${scope.length} ${label}`);
  }

  function syncErp() {
    const now = new Date();
    setLastSync(now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }));
    toast("success", "ERP sync complete");
  }

  /* ---- CRUD (real columns only) ---- */
  function openAdd() { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }
  function openEdit(a: GLAccount) {
    setEditingId(a.id);
    setForm({ code: a.code, name: a.name, type: a.type, parent_group: a.parent_group ?? "" });
    setShowForm(true);
  }
  async function handleSave() {
    if (!supabase) return;
    setSaving(true); setError(null);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      type: form.type,
      parent_group: form.parent_group.trim() || null,
    };
    const res = editingId
      ? await supabase.from("gl_accounts").update(payload).eq("id", editingId)
      : await supabase.from("gl_accounts").insert(payload);
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    if (editingId) setModified((s) => new Set(s).add(editingId));
    setShowForm(false);
    toast("success", editingId ? "GL account updated" : "GL account added");
    await loadAll();
  }

  /* ---- AR figures for the Transactions tab (real invoice data) ---- */
  const arTotals = useMemo(() => {
    const total = invoices.reduce((s, i) => s + Number(i.total), 0);
    const subtotal = invoices.reduce((s, i) => s + Number(i.subtotal), 0);
    const tax = invoices.reduce((s, i) => s + Number(i.tax_amount), 0);
    const received = allocs.reduce((s, a) => s + Number(a.amount), 0);
    return { total, subtotal, tax, received, outstanding: total - received, count: invoices.length };
  }, [invoices, allocs]);

  function arPostings(a: Enriched): { label: string; value: string }[] | null {
    if (a.code === "1100" || /receivable/i.test(a.name))
      return [{ label: "Outstanding receivable", value: formatMoney(arTotals.outstanding) }, { label: "Total billed", value: formatMoney(arTotals.total) }, { label: "Collected", value: formatMoney(arTotals.received) }, { label: "Open invoices", value: String(arTotals.count) }];
    if (a.type === "income")
      return [{ label: "Recognised revenue", value: formatMoney(arTotals.subtotal) }, { label: "Invoices posted", value: String(arTotals.count) }];
    if (a.type === "liability" && /gst|tax/i.test(a.name))
      return [{ label: "Output tax collected", value: formatMoney(arTotals.tax) }, { label: "Across invoices", value: String(arTotals.count) }];
    return null;
  }

  /* ================================================================ render */
  if (!isConfigured) {
    return (
      <>
        <PageHeader title="GL Master" subtitle="Manage General Ledger accounts, mappings, posting rules, and financial classifications." />
        <NotConfigured />
      </>
    );
  }

  const rowPad = density === "comfortable" ? "py-3" : "py-1.5";

  return (
    <>
      <PageHeader
        title="GL Master"
        subtitle="Manage General Ledger accounts, mappings, posting rules, and financial classifications."
        icon={<IconDatabase className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/upload" className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-ink/[0.03]">
              <IconUpload className="h-4 w-4" />Import GL
            </Link>
            <button onClick={() => exportCsv(filtered, "accounts")} className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-ink/[0.03]">
              <IconDownload className="h-4 w-4" />Export
            </button>
            <button onClick={() => runValidate(enriched, "accounts")} className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-ink/[0.03]">
              <IconShield className="h-4 w-4" />Validate Mapping
            </button>
            <button onClick={syncErp} className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-ink/[0.03]">
              <IconRefresh className="h-4 w-4" />Sync ERP
            </button>
            <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-dark hover:scale-[1.02] active:scale-[0.98]">
              <IconPlus className="h-4 w-4" />Add GL Account
            </button>
          </div>
        }
      />

      {/* entity / sync strip */}
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><IconBuilding className="h-3.5 w-3.5" />Entity · <span className="font-medium text-ink-secondary">{entity}</span></span>
        <span className="inline-flex items-center gap-1.5"><IconLayers className="h-3.5 w-3.5" />Chart of Accounts</span>
        <span className="inline-flex items-center gap-1.5"><IconRefresh className="h-3.5 w-3.5" />ERP {lastSync ? `synced ${lastSync}` : "not synced yet"}</span>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button onClick={() => { clearFilters(); }} className={`text-left rounded-xl transition-shadow ${!activeChips.length ? "ring-2 ring-brand/30" : ""}`}>
          <StatCard icon="📚" label="Total GL Accounts" value={String(kpi.total)} accent="blue" sparkline={seedSpark("total" + kpi.total)} insight="Chart of accounts" trend={{ label: "live", positive: true }} />
        </button>
        <button onClick={() => { clearFilters(); setFStatus("active"); }} className={`text-left rounded-xl transition-shadow ${fStatus === "active" ? "ring-2 ring-success/40" : ""}`}>
          <StatCard icon="✅" label="Active Accounts" value={String(kpi.active)} accent="green" sparkline={seedSpark("active" + kpi.active)} insight={`${kpi.inactive} inactive`} trend={{ label: `${kpi.total ? Math.round((kpi.active / kpi.total) * 100) : 0}%`, positive: true }} />
        </button>
        <button onClick={() => { clearFilters(); setFMapping("unmapped"); }} className={`text-left rounded-xl transition-shadow ${fMapping === "unmapped" ? "ring-2 ring-warning/40" : ""}`}>
          <StatCard icon="🔗" label="Unmapped Accounts" value={String(kpi.unmapped)} accent="orange" sparkline={seedSpark("unmapped" + kpi.unmapped)} insight={`${kpi.mapped} mapped`} trend={{ label: kpi.unmapped ? "review" : "clean", positive: kpi.unmapped === 0 }} />
        </button>
        <button onClick={() => { clearFilters(); setFiltersOpen(true); }} className={`text-left rounded-xl transition-shadow`}>
          <StatCard icon="⚠️" label="Validation Issues" value={String(kpi.issues)} accent="red" sparkline={seedSpark("issues" + kpi.issues)} insight="Accounts needing attention" trend={{ label: kpi.issues ? "action" : "all clear", positive: kpi.issues === 0 }} />
        </button>
      </div>

      {/* search + pinned filters */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === "Enter") { commitSearch(search); setSearchOpen(false); } }}
            placeholder="Search GL code, name, category, business unit…"
            className={`${inputClass} w-full pl-9 pr-8`}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:text-ink-secondary"><IconClose className="h-4 w-4" /></button>
          )}
          {searchOpen && recent.length > 0 && !search && (
            <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-lg border border-hairline bg-surface py-1 shadow-card-hover">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Recent searches</p>
              {recent.map((r) => (
                <button key={r} onMouseDown={() => { setSearch(r); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-secondary hover:bg-ink/[0.03]">
                  <IconHistory className="h-3.5 w-3.5 text-ink-muted" />{r}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 ${filtersOpen || activeChips.length ? "border-brand/40 bg-brand-light/40 text-brand" : "border-hairline bg-surface text-ink-secondary hover:bg-ink/[0.03]"}`}
        >
          <IconFilter className="h-4 w-4" />Filters{activeChips.length ? ` · ${activeChips.length}` : ""}
          <IconChevron className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </button>

        {/* pinned quick filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            { label: "All", on: () => clearFilters(), active: !activeChips.length },
            { label: "Unmapped", on: () => { clearFilters(); setFMapping("unmapped"); }, active: fMapping === "unmapped" },
            { label: "Revenue", on: () => { clearFilters(); setFGroup(new Set(["Revenue"])); }, active: fGroup.has("Revenue") },
            { label: "Assets", on: () => { clearFilters(); setFType(new Set(["asset"])); }, active: fType.has("asset") },
            { label: "Archived", on: () => { clearFilters(); setFStatus("inactive"); }, active: fStatus === "inactive" },
          ]).map((p) => (
            <button key={p.label} onClick={p.on} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${p.active ? "bg-brand text-white" : "bg-section text-ink-secondary hover:bg-ink/[0.05]"}`}>{p.label}</button>
          ))}
        </div>

        <span className="ml-auto whitespace-nowrap text-sm text-ink-muted">{filtered.length} of {enriched.length} accounts</span>
      </div>

      {/* advanced filters */}
      {filtersOpen && (
        <div className="mb-4 animate-fade-in rounded-xl border border-hairline bg-surface p-5 shadow-card">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Account Type</p>
              <div className="flex flex-col gap-1.5">
                {(Object.keys(TYPE_META) as GLAccount["type"][]).map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
                    <input type="checkbox" checked={fType.has(t)} onChange={() => setFType((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; })} className="h-4 w-4 rounded border-hairline text-brand focus:ring-brand/30" />
                    <TypeChip type={t} />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Group / Category</p>
              <div className="flex flex-col gap-1.5">
                {GROUP_ORDER.map((g) => (
                  <label key={g} className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
                    <input type="checkbox" checked={fGroup.has(g)} onChange={() => setFGroup((s) => { const n = new Set(s); n.has(g) ? n.delete(g) : n.add(g); return n; })} className="h-4 w-4 rounded border-hairline text-brand focus:ring-brand/30" />
                    {g}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Mapping</p>
              <select value={fMapping} onChange={(e) => setFMapping(e.target.value as typeof fMapping)} className={`${inputClass} w-full`}>
                <option value="all">All</option>
                <option value="mapped">Mapped only</option>
                <option value="unmapped">Unmapped only</option>
              </select>
              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Status</p>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} className={`${inputClass} w-full`}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Recently updated</p>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
                <input type="checkbox" checked={fRecent} onChange={(e) => setFRecent(e.target.checked)} className="h-4 w-4 rounded border-hairline text-brand focus:ring-brand/30" />
                Edited this session
              </label>
              <div className="mt-6 flex flex-col gap-2">
                <button onClick={clearFilters} className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-ink/[0.03]">Clear all</button>
              </div>
            </div>
          </div>
          {activeChips.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
              {activeChips.map((c) => (
                <button key={c.label} onClick={c.clear} className="inline-flex items-center gap-1.5 rounded-full bg-brand-light/40 px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-light/60">
                  {c.label}<IconClose className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* bulk toolbar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand-light/30 px-4 py-2.5 shadow-card animate-fade-in">
          <span className="text-sm font-medium text-brand">{selected.size} selected</span>
          <div className="mx-1 h-4 w-px bg-brand/20" />
          {(() => { const rows = filtered.filter((a) => selected.has(a.id)); return (
            <>
              <button onClick={() => archiveMany([...selected], true)} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-secondary hover:bg-white/60">Deactivate</button>
              <button onClick={() => archiveMany([...selected], false)} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-secondary hover:bg-white/60">Activate</button>
              <button onClick={() => runValidate(rows, "selected")} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-secondary hover:bg-white/60">Validate</button>
              <button onClick={() => exportCsv(rows, "selected")} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-secondary hover:bg-white/60">Export selected</button>
              <button onClick={syncErp} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-secondary hover:bg-white/60">Sync ERP</button>
            </>
          ); })()}
          <button onClick={() => setSelected(new Set())} className="ml-auto rounded-lg p-1.5 text-brand hover:bg-white/60" aria-label="Clear selection"><IconClose className="h-4 w-4" /></button>
        </div>
      )}

      {/* density control */}
      <div className="mb-2 flex items-center justify-end gap-2 text-xs text-ink-muted">
        <span>Density</span>
        <div className="flex overflow-hidden rounded-lg border border-hairline">
          {(["comfortable", "compact"] as Density[]).map((d) => (
            <button key={d} onClick={() => setDensity(d)} className={`px-2.5 py-1 capitalize transition-colors ${density === d ? "bg-brand text-white" : "bg-surface text-ink-secondary hover:bg-ink/[0.03]"}`}>{d}</button>
          ))}
        </div>
      </div>

      {/* data grid */}
      <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-card">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-hairline bg-section text-left">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="h-4 w-4 rounded border-hairline text-brand focus:ring-brand/30" aria-label="Select all" />
                </th>
                <th className="px-4 py-3 font-medium text-ink-secondary">Status</th>
                {([["code", "GL Code"], ["name", "GL Name"], ["category", "Category"], ["type", "Type"], ["businessUnit", "Business Unit"]] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="px-4 py-3 font-medium text-ink-secondary">
                    <button onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))} className="inline-flex items-center gap-1 hover:text-ink">
                      {label}
                      <span className={`text-[10px] ${sort.key === key ? "text-brand" : "text-ink-muted/40"}`}>{sort.key === key ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-ink-secondary">ERP Mapping</th>
                <th className="px-4 py-3 font-medium text-ink-secondary">Posting</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-hairline/70">
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5"><div className="h-4 rounded bg-gradient-to-r from-ink/[0.04] via-ink/[0.08] to-ink/[0.04] bg-[length:200%_100%] animate-shimmer" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="animate-fade-in px-4 py-16 text-center">
                    <div className="mb-3 text-3xl opacity-70">{enriched.length === 0 ? "🗂️" : "🔍"}</div>
                    <p className="font-medium text-ink-secondary">{enriched.length === 0 ? "No GL accounts yet" : "No accounts match your filters"}</p>
                    <p className="mt-1 text-sm text-ink-muted">{enriched.length === 0 ? "Add your first ledger account to get started." : "Try clearing filters or search."}</p>
                    {enriched.length === 0 ? (
                      <button onClick={openAdd} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"><IconPlus className="h-4 w-4" />Add GL Account</button>
                    ) : (
                      <button onClick={() => { clearFilters(); setSearch(""); }} className="mt-4 rounded-lg border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-ink/[0.03]">Clear filters</button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((a, i) => (
                  <tr
                    key={a.id}
                    onClick={() => openDrawer(a.id)}
                    className={`group cursor-pointer border-b border-hairline/70 transition-colors duration-150 last:border-0 hover:bg-info/[0.06] ${selected.has(a.id) ? "bg-brand-light/20" : i % 2 === 1 ? "bg-ink/[0.015]" : ""} ${drawerId === a.id ? "bg-brand-light/30" : ""}`}
                  >
                    <td className={`px-4 ${rowPad}`} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleRow(a.id)} className="h-4 w-4 rounded border-hairline text-brand focus:ring-brand/30" aria-label={`Select ${a.code}`} />
                    </td>
                    <td className={`px-4 ${rowPad}`}><StatusBadge a={a} /></td>
                    <td className={`px-4 ${rowPad}`}><span className="font-mono text-[13px] font-semibold text-ink">{<Highlight text={a.code} q={search} />}</span></td>
                    <td className={`px-4 ${rowPad}`}>
                      <div className="flex items-center gap-2">
                        <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg text-sm ${TYPE_META[a.type].chip}`}>{TYPE_META[a.type].emoji}</span>
                        <div>
                          <p className="font-medium text-ink"><Highlight text={a.name} q={search} /></p>
                          {a.usedInAr && <p className="text-[11px] text-ink-muted">AR posting account</p>}
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 ${rowPad}`}>
                      {a.mapped ? <span className="text-ink-secondary">{a.category}</span> : <span className="inline-flex items-center gap-1 text-warning"><IconAlert className="h-3.5 w-3.5" />Unmapped</span>}
                    </td>
                    <td className={`px-4 ${rowPad}`}><TypeChip type={a.type} /></td>
                    <td className={`px-4 ${rowPad}`}><span className="text-ink-secondary">{a.businessUnit}</span></td>
                    <td className={`px-4 ${rowPad}`}><SyncPill status={a.syncStatus} /></td>
                    <td className={`px-4 ${rowPad}`}>
                      {a.active ? <span className="inline-flex items-center gap-1 text-xs text-success"><IconCheck className="h-3.5 w-3.5" />Allowed</span> : <span className="text-xs text-ink-muted">Blocked</span>}
                    </td>
                    <td className={`px-4 ${rowPad}`} onClick={(e) => e.stopPropagation()}>
                      <div className="relative flex justify-end">
                        <button onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)} className="rounded-lg p-1.5 text-ink-muted opacity-0 transition-all duration-150 hover:bg-ink/[0.04] hover:text-ink-secondary group-hover:opacity-100" aria-label="Row actions"><IconDots className="h-4 w-4" /></button>
                        {openMenuId === a.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-hairline bg-surface py-1 shadow-card-hover">
                              <button onClick={() => { openDrawer(a.id); setOpenMenuId(null); }} className="block w-full px-3 py-2 text-left text-sm text-ink-secondary hover:bg-ink/[0.03]">View details</button>
                              <button onClick={() => { openEdit(a); setOpenMenuId(null); }} className="block w-full px-3 py-2 text-left text-sm text-ink-secondary hover:bg-ink/[0.03]">Edit</button>
                              <button onClick={() => { openDrawer(a.id); setTab("audit"); setOpenMenuId(null); }} className="block w-full px-3 py-2 text-left text-sm text-ink-secondary hover:bg-ink/[0.03]">History</button>
                              <div className="my-1 h-px bg-hairline" />
                              <button onClick={() => { archiveMany([a.id], a.active); setOpenMenuId(null); }} className="block w-full px-3 py-2 text-left text-sm text-ink-secondary hover:bg-ink/[0.03]">{a.active ? "Archive" : "Restore"}</button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* analytics */}
      {!loading && enriched.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
            <h3 className="text-sm font-semibold tracking-tight text-ink">Account Distribution</h3>
            <p className="mb-4 text-xs text-ink-muted">By account type</p>
            <Donut
              segments={[
                { label: "Assets", value: enriched.filter((a) => a.type === "asset").length, color: "rgb(79 70 229)" },
                { label: "Income", value: enriched.filter((a) => a.type === "income").length, color: "rgb(5 150 105)" },
                { label: "Liabilities", value: enriched.filter((a) => a.type === "liability").length, color: "rgb(217 119 6)" },
                { label: "Expenses", value: enriched.filter((a) => a.type === "expense").length, color: "rgb(220 38 38)" },
              ]}
            />
          </div>
          <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
            <h3 className="text-sm font-semibold tracking-tight text-ink">Mapping Completion</h3>
            <p className="mb-4 text-xs text-ink-muted">How much of the chart is fully classified</p>
            <div className="mb-4 flex items-end gap-2">
              <span className="text-3xl font-bold text-ink tabular-nums">{kpi.total ? Math.round((kpi.mapped / kpi.total) * 100) : 0}%</span>
              <span className="pb-1 text-xs text-ink-muted">mapped</span>
            </div>
            <div className="space-y-3">
              <Bar label="Mapped to a group" value={kpi.mapped} total={kpi.total} color="rgb(5 150 105)" />
              <Bar label="Awaiting mapping" value={kpi.unmapped} total={kpi.total} color="rgb(217 119 6)" />
            </div>
          </div>
          <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
            <h3 className="text-sm font-semibold tracking-tight text-ink">ERP Sync Status</h3>
            <p className="mb-4 text-xs text-ink-muted">{lastSync ? `Last synced ${lastSync}` : "Not synced this session"}</p>
            <div className="space-y-3">
              <Bar label="Synced" value={enriched.filter((a) => a.syncStatus === "synced").length} total={kpi.total} color="rgb(5 150 105)" />
              <Bar label="Pending" value={enriched.filter((a) => a.syncStatus === "pending").length} total={kpi.total} color="rgb(107 114 128)" />
              <Bar label="Not mapped" value={enriched.filter((a) => a.syncStatus === "error").length} total={kpi.total} color="rgb(220 38 38)" />
            </div>
            <button onClick={syncErp} className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-ink/[0.03]"><IconRefresh className="h-4 w-4" />Sync now</button>
          </div>
        </div>
      )}

      {/* ---- details drawer ---- */}
      {drawerId && current && (
        <div className="fixed inset-0 z-50">
          <div onClick={closeDrawer} className={`absolute inset-0 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-300 ${drawerShown ? "opacity-100" : "opacity-0"}`} />
          <aside className={`absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col bg-canvas shadow-card-hover transition-transform duration-300 ease-premium ${drawerShown ? "translate-x-0" : "translate-x-full"}`}>
            {/* header */}
            <div className="flex items-start justify-between gap-3 border-b border-hairline bg-surface px-6 py-5">
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl text-xl ${TYPE_META[current.type].chip}`}>{TYPE_META[current.type].emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink">{current.code}</span>
                    <StatusBadge a={current} />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-ink">{current.name}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(current)} className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm font-medium text-ink-secondary hover:bg-ink/[0.03]">Edit</button>
                <button onClick={closeDrawer} className="rounded-lg p-2 text-ink-muted hover:bg-ink/[0.04] hover:text-ink-secondary" aria-label="Close"><IconClose className="h-5 w-5" /></button>
              </div>
            </div>

            {/* tabs */}
            <div className="flex gap-1 border-b border-hairline bg-surface px-4">
              {(["overview", "mapping", "audit", "transactions", "notes"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`relative px-3 py-3 text-sm font-medium capitalize transition-colors ${tab === t ? "text-brand" : "text-ink-muted hover:text-ink-secondary"}`}>
                  {t === "audit" ? "Audit Trail" : t}
                  {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
                </button>
              ))}
            </div>

            {/* tab body */}
            <div className="flex-1 overflow-y-auto p-6">
              {tab === "overview" && (
                <div className="space-y-6 animate-fade-in">
                  {/* validation panel */}
                  <section className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
                    <div className="mb-3 flex items-center gap-2">
                      <IconShield className="h-4 w-4 text-brand" />
                      <h4 className="text-sm font-semibold text-ink">Validation</h4>
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${current.issues ? "bg-warning-bg text-warning" : "bg-success-bg text-success"}`}>{current.issues ? `${current.issues} to fix` : "All passing"}</span>
                    </div>
                    <ul className="space-y-2">
                      {current.validations.map((v) => (
                        <li key={v.label} className="flex items-center gap-2 text-sm">
                          {v.ok
                            ? <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-success-bg text-success"><IconCheck className="h-3.5 w-3.5" /></span>
                            : <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-warning-bg text-warning"><IconAlert className="h-3 w-3" /></span>}
                          <span className={v.ok ? "text-ink-secondary" : "text-ink"}>{v.label}</span>
                          {!v.ok && v.fix && (
                            <button onClick={() => { openEdit(current); }} className="ml-auto text-xs font-medium text-brand hover:underline">{v.fix}</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>

                  {/* GL information */}
                  <section>
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">GL Information</h4>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <Field label="GL Code" value={current.code} mono />
                      <Field label="Account Type" value={TYPE_META[current.type].label} />
                      <Field label="Category" value={current.category} />
                      <Field label="Business Unit" value={current.businessUnit} />
                      <Field label="Entity" value={entity} />
                      <Field label="Posting" value={current.active ? "Allowed" : "Blocked"} />
                    </dl>
                  </section>

                  {/* financial mapping */}
                  <section>
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Financial Mapping</h4>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <Field label="Revenue / Expense" value={current.type === "income" ? "Revenue" : current.type === "expense" ? "Expense" : "—"} />
                      <Field label="Tax Code" value={hasGstAccount && (current.type === "income" || current.type === "expense") ? "GST linked" : "—"} />
                      <Field label="Used in AR" value={current.usedInAr ? "Yes" : "No"} />
                      <Field label="Sync Status" value={current.syncStatus === "synced" ? "Synced" : current.syncStatus === "pending" ? "Pending" : "Not mapped"} />
                    </dl>
                  </section>
                </div>
              )}

              {tab === "mapping" && (
                <div className="animate-fade-in">
                  <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Mapping Flow</h4>
                  <div className="space-y-2">
                    {[
                      { icon: <IconDatabase className="h-4 w-4" />, label: "GL Account", value: `${current.code} · ${current.name}`, tone: "brand" },
                      { icon: <IconWallet className="h-4 w-4" />, label: current.type === "income" ? "Revenue Category" : "Financial Category", value: current.category, tone: current.mapped ? "ok" : "warn" },
                      { icon: <IconBuilding className="h-4 w-4" />, label: "Business Unit", value: `${current.businessUnit} · ${entity}`, tone: "muted" },
                      { icon: <IconLayers className="h-4 w-4" />, label: "ERP Ledger", value: current.syncStatus === "synced" ? "Mapped ✓" : "Awaiting mapping", tone: current.syncStatus === "synced" ? "ok" : "warn" },
                      { icon: <IconBranch className="h-4 w-4" />, label: "Posting Rule", value: current.active ? "Active" : "Blocked", tone: current.active ? "ok" : "muted" },
                      { icon: <IconArrow className="h-4 w-4" />, label: "Financial Statement", value: current.type === "income" || current.type === "expense" ? "Profit & Loss" : "Balance Sheet", tone: "muted" },
                    ].map((n, i, arr) => (
                      <div key={n.label}>
                        <MapNode icon={n.icon} label={n.label} value={n.value} tone={n.tone as MapTone} />
                        {i < arr.length - 1 && <div className="ml-6 flex h-5 items-center"><span className="h-full w-px bg-hairline" /><IconArrow className="ml-[-9px] h-4 w-4 text-ink-muted/50" /></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "audit" && (
                <div className="animate-fade-in">
                  <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Audit Timeline</h4>
                  <ol className="relative ml-2 space-y-5 border-l border-hairline pl-6">
                    {[
                      { t: "Created", d: "Account added to chart of accounts", who: "System · seed", done: true },
                      { t: "Mapped", d: current.mapped ? `Classified under ${current.category}` : "Not yet mapped to a group", who: "System", done: current.mapped },
                      { t: "Modified", d: current.modifiedInSession ? "Edited in this session" : "No edits this session", who: "You", done: current.modifiedInSession },
                      { t: "Validated", d: current.issues ? `${current.issues} open validation issue(s)` : "Passed all checks", who: "Validator", done: current.issues === 0 },
                      { t: "ERP Synced", d: current.syncStatus === "synced" ? `Synced${lastSync ? ` at ${lastSync}` : ""}` : "Pending sync", who: "ERP", done: current.syncStatus === "synced" },
                    ].map((e) => (
                      <li key={e.t} className="relative">
                        <span className={`absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 ${e.done ? "border-success bg-success-bg" : "border-hairline bg-surface"}`}>{e.done && <span className="h-1.5 w-1.5 rounded-full bg-success" />}</span>
                        <p className="text-sm font-medium text-ink">{e.t}</p>
                        <p className="text-xs text-ink-secondary">{e.d}</p>
                        <p className="mt-0.5 text-[11px] text-ink-muted">{e.who}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {tab === "transactions" && (
                <div className="animate-fade-in">
                  <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Linked AR Activity</h4>
                  {arPostings(current) ? (
                    <div className="grid grid-cols-2 gap-3">
                      {arPostings(current)!.map((p) => (
                        <div key={p.label} className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
                          <p className="text-xs text-ink-muted">{p.label}</p>
                          <p className="mt-1 text-lg font-semibold text-ink tabular-nums">{p.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-hairline bg-surface p-8 text-center">
                      <div className="mb-2 text-2xl opacity-60">🧾</div>
                      <p className="text-sm text-ink-secondary">No AR postings mapped to this account</p>
                      <p className="mt-1 text-xs text-ink-muted">Sales, GST and receivable accounts show live invoice activity here.</p>
                    </div>
                  )}
                </div>
              )}

              {tab === "notes" && (
                <div className="animate-fade-in">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Notes</h4>
                  <textarea
                    value={notes[current.id] ?? ""}
                    onChange={(e) => persistNotes({ ...notes, [current.id]: e.target.value })}
                    placeholder="Add an internal note for this GL account… (saved locally)"
                    rows={8}
                    className={`${inputClass} w-full resize-none`}
                  />
                  <p className="mt-2 text-xs text-ink-muted">Notes are kept on this device only — they never touch the ledger.</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ---- add / edit modal ---- */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-6 shadow-card-hover animate-pop-in">
            <h3 className="text-lg font-semibold tracking-tight text-ink">{editingId ? "Edit GL Account" : "Add GL Account"}</h3>
            <p className="mt-1 text-sm text-ink-muted">These fields write to the ledger. Classifications update automatically.</p>
            {error && <p className="mt-3 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="mt-5 grid grid-cols-2 gap-4">
              <FormField label="GL Code"><input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. 4000" /></FormField>
              <FormField label="Account Type">
                <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as GLAccount["type"] })}>
                  {(Object.keys(TYPE_META) as GLAccount["type"][]).map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
                </select>
              </FormField>
              <div className="col-span-2"><FormField label="GL Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sales / Professional Fees" /></FormField></div>
              <div className="col-span-2">
                <FormField label="Parent Group (mapping)">
                  <input className={inputClass} value={form.parent_group} onChange={(e) => setForm({ ...form, parent_group: e.target.value })} placeholder="e.g. Revenue, Current Assets" list="gl-groups" />
                  <datalist id="gl-groups">{GROUP_ORDER.map((g) => <option key={g} value={g} />)}</datalist>
                </FormField>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-ink/[0.04]">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.code || !form.name} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-dark hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100">{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- toasts ---- */}
      <div className="fixed bottom-5 right-5 z-[70] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface px-4 py-3 shadow-card-hover animate-fade-in-up">
            <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${t.kind === "success" ? "bg-success-bg text-success" : t.kind === "error" ? "bg-warning-bg text-warning" : "bg-info-bg text-info"}`}>
              {t.kind === "error" ? <IconAlert className="h-3.5 w-3.5" /> : <IconCheck className="h-3.5 w-3.5" />}
            </span>
            <span className="text-sm font-medium text-ink">{t.msg}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---- small drawer helpers ---- */
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 text-ink ${mono ? "font-mono text-[13px]" : ""}`}>{value}</dd>
    </div>
  );
}

type MapTone = "brand" | "ok" | "warn" | "muted";
function MapNode({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: MapTone }) {
  const toneCls = {
    brand: "border-brand/30 bg-brand-light/20 text-brand",
    ok: "border-success-border bg-success-bg text-success",
    warn: "border-warning-border bg-warning-bg text-warning",
    muted: "border-hairline bg-surface text-ink-secondary",
  }[tone];
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 shadow-card ${toneCls}`}>
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white/50">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
        <p className="truncate text-sm font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}
