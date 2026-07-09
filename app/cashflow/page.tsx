"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Invoice, Customer, ReceiptAllocation } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { StatCard } from "@/components/StatCard";
import { inputClass } from "@/components/FormField";
import { formatMoney, formatDate } from "@/lib/format";
import { buildRows, bucketize, defaultExpected, seedFor, type Bucket, type Granularity } from "@/lib/cashflow";

/* --------------------------------------------------------------- icons -- */
type IconProps = { className?: string };
const Ico = ({ path, className = "h-4 w-4", stroke = false }: { path: string; className?: string; stroke?: boolean }) =>
  stroke ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}><path d={path} /></svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}><path fillRule="evenodd" clipRule="evenodd" d={path} /></svg>
  );
const IconClose = (p: IconProps) => <Ico className={p.className} path="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />;
const IconCheck = (p: IconProps) => <Ico className={p.className} path="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" />;
const IconChevron = (p: IconProps) => <Ico className={p.className} path="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />;
const IconDownload = (p: IconProps) => <Ico stroke className={p.className} path="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />;
const IconRefresh = (p: IconProps) => <Ico stroke className={p.className} path="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6" />;
const IconAlert = (p: IconProps) => <Ico stroke className={p.className} path="M12 9v4M12 17h.01M10.3 3.86l-8 14A1 1 0 003.16 19.5h17.68a1 1 0 00.86-1.5l-8-14a1 1 0 00-1.74 0z" />;
const IconSliders = (p: IconProps) => <Ico stroke className={p.className} path="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />;
const IconCalendar = (p: IconProps) => <Ico stroke className={p.className} path="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />;
const IconTrending = (p: IconProps) => <Ico stroke className={p.className} path="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" />;
const IconWallet = (p: IconProps) => <Ico stroke className={p.className} path="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM16 12h.01M3 9h18" />;
const IconUsers = (p: IconProps) => <Ico stroke className={p.className} path="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />;
const IconArrow = (p: IconProps) => <Ico stroke className={p.className} path="M5 12h14M12 5l7 7-7 7" />;

type Toast = { id: number; kind: "success" | "error" | "info"; msg: string };

/* mini bucket sparkline seed reused for KPI cards (deterministic) */
function csvValue(v: unknown) { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

/* --------------------------------------------------- projection chart -- */
function ProjectionChart({ buckets, expectedOf, onPick, activeKey }: { buckets: Bucket[]; expectedOf: (b: Bucket) => number; onPick: (k: string) => void; activeKey: string | null }) {
  const w = 720, h = 240, padB = 44, padT = 12, padL = 8, padR = 8;
  const innerW = w - padL - padR, innerH = h - padB - padT;
  const maxOut = Math.max(...buckets.map((b) => b.outstanding), 1);
  const gap = 14;
  const bw = Math.max(18, (innerW - gap * (buckets.length - 1)) / buckets.length);
  // cumulative expected line
  let acc = 0;
  const cum = buckets.map((b) => (acc += expectedOf(b)));
  const maxCum = Math.max(...cum, 1);
  const x = (i: number) => padL + i * (bw + gap);
  const cx = (i: number) => x(i) + bw / 2;
  const cy = (v: number) => padT + innerH - (v / maxCum) * innerH;
  const linePts = cum.map((v, i) => `${cx(i)},${cy(v)}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[240px] w-full min-w-[640px]">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={padL} x2={w - padR} y1={padT + innerH - g * innerH} y2={padT + innerH - g * innerH} className="stroke-hairline" strokeWidth={1} strokeDasharray="3 4" />
        ))}
        {buckets.map((b, i) => {
          const outH = (b.outstanding / maxOut) * innerH;
          const exp = expectedOf(b);
          const expH = (Math.min(exp, b.outstanding) / maxOut) * innerH;
          const active = activeKey === b.key;
          return (
            <g key={b.key} className="cursor-pointer" onClick={() => onPick(b.key)}>
              <rect x={x(i)} y={padT + innerH - outH} width={bw} height={outH} rx={5} className={b.overdue ? "fill-warning/20" : "fill-info/12"} />
              <rect x={x(i)} y={padT + innerH - expH} width={bw} height={expH} rx={5} className={b.overdue ? "fill-warning" : "fill-brand"} opacity={active ? 1 : 0.9} />
              {active && <rect x={x(i) - 2} y={padT} width={bw + 4} height={innerH} rx={6} className="fill-brand/5 stroke-brand/30" strokeWidth={1} />}
              <text x={cx(i)} y={h - 26} textAnchor="middle" className="fill-ink-secondary text-[9px]">{b.label.length > 9 ? b.label.slice(0, 8) + "…" : b.label}</text>
              <text x={cx(i)} y={h - 14} textAnchor="middle" className="fill-ink-muted text-[8px]">{b.rows.length} inv</text>
            </g>
          );
        })}
        <polyline points={linePts} fill="none" stroke="rgb(var(--color-success))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {cum.map((v, i) => <circle key={i} cx={cx(i)} cy={cy(v)} r={2.5} className="fill-success" />)}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand" />Expected inflow</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-info/20" />Outstanding</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-warning" />Overdue (at risk)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-success" />Cumulative collection</span>
      </div>
    </div>
  );
}

/* ================================================================ page == */
export default function CashflowPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allocs, setAllocs] = useState<ReceiptAllocation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [horizon, setHorizon] = useState(8);
  const [confidence, setConfidence] = useState(90);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [controlsOpen, setControlsOpen] = useState(false);

  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const [drawerShown, setDrawerShown] = useState(false);
  const [tab, setTab] = useState<"invoices" | "customers" | "assumptions">("invoices");

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const today = useMemo(() => new Date(), []);

  async function loadAll() {
    if (!supabase) return;
    setLoading(true);
    const [inv, al, cu] = await Promise.all([
      supabase.from("invoices").select("*"),
      supabase.from("receipt_allocations").select("*"),
      supabase.from("customers").select("*").order("name"),
    ]);
    if (inv.error) setError(inv.error.message);
    else setInvoices(inv.data as Invoice[]);
    if (al.data) setAllocs(al.data as ReceiptAllocation[]);
    if (cu.data) setCustomers(cu.data as Customer[]);
    setLoading(false);
  }
  useEffect(() => {
    loadAll();
    try { setOverrides(JSON.parse(localStorage.getItem("cf_overrides") || "{}")); } catch { /* ignore */ }
  }, []);

  function persistOverrides(next: Record<string, number>) {
    setOverrides(next);
    localStorage.setItem("cf_overrides", JSON.stringify(next));
  }
  function toast(kind: Toast["kind"], msg: string) {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }

  /* ---- derive ---- */
  const rows = useMemo(() => {
    const all = buildRows(invoices, allocs, customers, today);
    return customerFilter === "all" ? all : all.filter((r) => r.invoice.customer_id === customerFilter);
  }, [invoices, allocs, customers, today, customerFilter]);

  const buckets = useMemo(() => bucketize(rows, granularity, horizon, today), [rows, granularity, horizon, today]);
  const expectedOf = (b: Bucket) => (b.key in overrides ? overrides[b.key] : defaultExpected(b, confidence));

  const kpi = useMemo(() => {
    const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
    const overdue = rows.filter((r) => r.overdue).reduce((s, r) => s + r.outstanding, 0);
    const due30 = rows.filter((r) => r.daysToDue >= 0 && r.daysToDue <= 30).reduce((s, r) => s + r.outstanding, 0);
    const projected = buckets.reduce((s, b) => s + expectedOf(b), 0);
    return { totalOutstanding, overdue, due30, projected, count: rows.length };
  }, [rows, buckets, overrides, confidence]);

  const customerBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.customerName, (m.get(r.customerName) ?? 0) + r.outstanding);
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const custWithBalance = useMemo(() => {
    const ids = new Set(buildRows(invoices, allocs, customers, today).map((r) => r.invoice.customer_id));
    return customers.filter((c) => ids.has(c.id));
  }, [invoices, allocs, customers, today]);

  const edited = Object.keys(overrides).length;

  /* ---- drawer ---- */
  function openDrawer(k: string) { setDrawerKey(k); setTab("invoices"); requestAnimationFrame(() => setDrawerShown(true)); }
  function closeDrawer() { setDrawerShown(false); setTimeout(() => setDrawerKey(null), 280); }
  const current = drawerKey ? buckets.find((b) => b.key === drawerKey) ?? null : null;

  function setExpected(key: string, value: number) { persistOverrides({ ...overrides, [key]: Math.max(0, Math.round(value)) }); }
  function clearOverride(key: string) { const n = { ...overrides }; delete n[key]; persistOverrides(n); }
  function resetAll() { persistOverrides({}); setConfidence(90); toast("info", "Assumptions reset to defaults"); }

  function switchGranularity(g: Granularity) { setGranularity(g); setHorizon(g === "weekly" ? 8 : 6); }

  function exportCsv() {
    const header = ["period", "range", "invoices", "outstanding", "expected", "gap"];
    const lines = buckets.map((b) => [b.key, b.sub || b.label, b.rows.length, b.outstanding, expectedOf(b), b.outstanding - expectedOf(b)].map(csvValue).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cashflow-projection-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast("info", "Export started");
  }

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Cashflow Projection" subtitle="Forward-looking collection forecast from open invoices." />
        <NotConfigured />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Cashflow Projection"
        subtitle="Forward-looking collection forecast from open invoices, grouped by due date."
        icon={<IconTrending className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {edited > 0 && (
              <button onClick={resetAll} className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-ink/[0.03]">
                <IconRefresh className="h-4 w-4" />Reset ({edited})
              </button>
            )}
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-ink/[0.03]">
              <IconDownload className="h-4 w-4" />Export
            </button>
            <button onClick={() => setControlsOpen((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 ${controlsOpen ? "border-brand/40 bg-brand-light/40 text-brand" : "border-hairline bg-surface text-ink-secondary hover:bg-ink/[0.03]"}`}>
              <IconSliders className="h-4 w-4" />Assumptions
            </button>
          </div>
        }
      />

      {/* context strip */}
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><IconCalendar className="h-3.5 w-3.5" />As of <span className="font-medium text-ink-secondary">{formatDate(today.toISOString())}</span></span>
        <span className="inline-flex items-center gap-1.5"><IconWallet className="h-3.5 w-3.5" />{kpi.count} open invoice{kpi.count === 1 ? "" : "s"}</span>
        <span className="inline-flex items-center gap-1.5"><IconTrending className="h-3.5 w-3.5" />{confidence}% base collection confidence</span>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button onClick={() => setCustomerFilter("all")} className={`text-left rounded-xl transition-shadow ${customerFilter === "all" ? "ring-2 ring-brand/30" : ""}`}>
          <StatCard icon="💰" label="Total Outstanding" value={formatMoney(kpi.totalOutstanding)} accent="blue" sparkline={seedFor("out" + Math.round(kpi.totalOutstanding))} insight={`${kpi.count} invoices`} />
        </button>
        <button onClick={() => setControlsOpen(true)} className="text-left rounded-xl">
          <StatCard icon="📈" label="Projected Inflow" value={formatMoney(kpi.projected)} accent="green" sparkline={seedFor("proj" + Math.round(kpi.projected))} insight={`${kpi.totalOutstanding ? Math.round((kpi.projected / kpi.totalOutstanding) * 100) : 0}% of book`} trend={{ label: "forecast", positive: true }} />
        </button>
        <button onClick={() => { const od = buckets.find((b) => b.overdue); if (od) openDrawer(od.key); }} className="text-left rounded-xl">
          <StatCard icon="⚠️" label="Overdue Now" value={formatMoney(kpi.overdue)} accent="red" sparkline={seedFor("od" + Math.round(kpi.overdue))} insight="Past due — at risk" trend={{ label: kpi.overdue ? "collect" : "none", positive: kpi.overdue === 0 }} />
        </button>
        <button onClick={() => switchGranularity("weekly")} className="text-left rounded-xl">
          <StatCard icon="🗓️" label="Due Next 30 Days" value={formatMoney(kpi.due30)} accent="purple" sparkline={seedFor("d30" + Math.round(kpi.due30))} insight="Near-term inflow" />
        </button>
      </div>

      {/* controls / assumptions */}
      {controlsOpen && (
        <div className="mb-4 animate-fade-in rounded-xl border border-hairline bg-surface p-5 shadow-card">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Base collection confidence</p>
              <div className="flex items-center gap-3">
                <input type="range" min={40} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="flex-1 accent-[rgb(var(--color-brand))]" />
                <span className="w-12 text-right text-sm font-semibold tabular-nums text-ink">{confidence}%</span>
              </div>
              <p className="mt-2 text-xs text-ink-muted">Overdue buckets default 25 points lower. Edited periods keep your amount.</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Horizon</p>
              <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className={`${inputClass} w-full`}>
                {(granularity === "weekly" ? [4, 6, 8, 12] : [3, 6, 9, 12]).map((n) => <option key={n} value={n}>{n} {granularity === "weekly" ? "weeks" : "months"}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Customer</p>
              <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={`${inputClass} w-full`}>
                <option value="all">All customers</option>
                {custWithBalance.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* granularity toggle */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex overflow-hidden rounded-lg border border-hairline text-sm">
          {(["weekly", "monthly"] as Granularity[]).map((g) => (
            <button key={g} onClick={() => switchGranularity(g)} className={`px-4 py-1.5 capitalize transition-colors ${granularity === g ? "bg-brand text-white" : "bg-surface text-ink-secondary hover:bg-ink/[0.03]"}`}>{g}</button>
          ))}
        </div>
        {customerFilter !== "all" && (
          <button onClick={() => setCustomerFilter("all")} className="inline-flex items-center gap-1.5 rounded-full bg-brand-light/40 px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-light/60">
            {customers.find((c) => c.id === customerFilter)?.name}<IconClose className="h-3 w-3" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-hairline bg-surface p-6 shadow-card">
          <div className="h-[240px] rounded-lg bg-gradient-to-r from-ink/[0.04] via-ink/[0.08] to-ink/[0.04] bg-[length:200%_100%] animate-shimmer" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface p-16 text-center shadow-card">
          <div className="mb-3 text-3xl opacity-70">💸</div>
          <p className="font-medium text-ink-secondary">No outstanding invoices to project</p>
          <p className="mt-1 text-sm text-ink-muted">Once there are open or partial invoices, their collection forecast appears here.</p>
        </div>
      ) : (
        <>
          {/* chart */}
          <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-ink">Expected Collections</h3>
                <p className="text-xs text-ink-muted">Click a period to inspect its invoices and adjust the forecast.</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-ink-muted">Projected over horizon</p>
                <p className="text-lg font-bold text-ink tabular-nums">{formatMoney(kpi.projected)}</p>
              </div>
            </div>
            <ProjectionChart buckets={buckets} expectedOf={expectedOf} onPick={openDrawer} activeKey={drawerKey} />
          </div>

          {/* projection grid */}
          <div className="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface shadow-card">
            <div className="max-h-[460px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-hairline bg-section text-left">
                    <th className="px-4 py-3 font-medium text-ink-secondary">Period</th>
                    <th className="px-4 py-3 font-medium text-ink-secondary">Invoices</th>
                    <th className="px-4 py-3 text-right font-medium text-ink-secondary">Outstanding</th>
                    <th className="px-4 py-3 text-right font-medium text-ink-secondary">Expected</th>
                    <th className="px-4 py-3 text-right font-medium text-ink-secondary">Gap / At-risk</th>
                    <th className="px-4 py-3 text-right font-medium text-ink-secondary">Cumulative</th>
                    <th className="w-8 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(() => { let cum = 0; return buckets.map((b, i) => {
                    const exp = expectedOf(b); cum += exp;
                    const gap = b.outstanding - exp;
                    const over = b.key in overrides;
                    return (
                      <tr key={b.key} onClick={() => openDrawer(b.key)} className={`group cursor-pointer border-b border-hairline/70 transition-colors duration-150 last:border-0 hover:bg-info/[0.06] ${drawerKey === b.key ? "bg-brand-light/30" : i % 2 === 1 ? "bg-ink/[0.015]" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 flex-none rounded-sm ${b.overdue ? "bg-warning" : b.beyond ? "bg-ink-muted" : "bg-brand"}`} />
                            <div>
                              <p className="font-medium text-ink">{b.label}</p>
                              {b.sub && <p className="text-[11px] text-ink-muted">{b.sub}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-secondary">{b.rows.length}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-ink-secondary">{formatMoney(b.outstanding)}</td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {over && <span className="h-1.5 w-1.5 rounded-full bg-brand" title="Edited" />}
                            <span className="text-ink-muted">₹</span>
                            <input
                              type="number"
                              value={exp}
                              onChange={(e) => setExpected(b.key, Number(e.target.value))}
                              className="w-28 rounded-lg border border-hairline bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                            />
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums ${gap > 0 ? "text-warning" : "text-success"}`}>{gap > 0 ? formatMoney(gap) : "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">{formatMoney(cum)}</td>
                        <td className="px-4 py-3 text-right"><IconChevron className="h-4 w-4 -rotate-90 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" /></td>
                      </tr>
                    );
                  }); })()}
                </tbody>
                <tfoot>
                  <tr className="border-t border-hairline bg-section font-semibold">
                    <td className="px-4 py-3 text-ink">Total</td>
                    <td className="px-4 py-3 text-ink-secondary">{rows.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{formatMoney(kpi.totalOutstanding)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-brand">{formatMoney(kpi.projected)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-warning">{formatMoney(Math.max(0, kpi.totalOutstanding - kpi.projected))}</td>
                    <td className="px-4 py-3" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* analytics */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold tracking-tight text-ink">Top Customers by Outstanding</h3>
              <p className="mb-4 text-xs text-ink-muted">Where the receivables are concentrated</p>
              <div className="space-y-3">
                {customerBreakdown.slice(0, 6).map((c) => {
                  const pct = kpi.totalOutstanding ? Math.round((c.value / kpi.totalOutstanding) * 100) : 0;
                  return (
                    <div key={c.name}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="truncate pr-3 text-ink-secondary">{c.name}</span>
                        <span className="flex-none font-semibold tabular-nums text-ink">{formatMoney(c.value)} · {pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink/[0.06]"><div className="h-full rounded-full bg-brand transition-all duration-700 ease-premium" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold tracking-tight text-ink">Collection Health</h3>
              <p className="mb-4 text-xs text-ink-muted">Book split by timing risk</p>
              {(() => {
                const overdue = kpi.overdue;
                const near = kpi.due30;
                const later = Math.max(0, kpi.totalOutstanding - overdue - near);
                const total = kpi.totalOutstanding || 1;
                const rowsA = [
                  { label: "Overdue (at risk)", value: overdue, color: "rgb(var(--color-warning))" },
                  { label: "Due within 30 days", value: near, color: "rgb(var(--color-brand))" },
                  { label: "Due later", value: later, color: "rgb(var(--color-success))" },
                ];
                return (
                  <div className="space-y-3">
                    <div className="flex h-3 overflow-hidden rounded-full">
                      {rowsA.map((r) => <div key={r.label} style={{ width: `${(r.value / total) * 100}%`, background: r.color }} title={`${r.label}: ${formatMoney(r.value)}`} />)}
                    </div>
                    {rowsA.map((r) => (
                      <div key={r.label} className="flex items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: r.color }} />
                        <span className="text-ink-muted">{r.label}</span>
                        <span className="ml-auto font-semibold tabular-nums text-ink">{formatMoney(r.value)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* ---- period drawer ---- */}
      {drawerKey && current && (
        <div className="fixed inset-0 z-50">
          <div onClick={closeDrawer} className={`absolute inset-0 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-300 ${drawerShown ? "opacity-100" : "opacity-0"}`} />
          <aside className={`absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col bg-canvas shadow-card-hover transition-transform duration-300 ease-premium ${drawerShown ? "translate-x-0" : "translate-x-full"}`}>
            <div className="flex items-start justify-between gap-3 border-b border-hairline bg-surface px-6 py-5">
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl text-xl ${current.overdue ? "bg-warning-bg text-warning" : "bg-brand-light/40 text-brand"}`}>{current.overdue ? "⚠️" : "🗓️"}</span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-ink">{current.label}</h3>
                  <p className="text-sm text-ink-muted">{current.sub || `${current.rows.length} invoice(s)`}</p>
                </div>
              </div>
              <button onClick={closeDrawer} className="rounded-lg p-2 text-ink-muted hover:bg-ink/[0.04] hover:text-ink-secondary" aria-label="Close"><IconClose className="h-5 w-5" /></button>
            </div>

            {/* summary */}
            <div className="grid grid-cols-3 gap-3 border-b border-hairline bg-surface px-6 py-4">
              <div><p className="text-xs text-ink-muted">Outstanding</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{formatMoney(current.outstanding)}</p></div>
              <div><p className="text-xs text-ink-muted">Expected</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-brand">{formatMoney(expectedOf(current))}</p></div>
              <div><p className="text-xs text-ink-muted">Gap</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-warning">{formatMoney(Math.max(0, current.outstanding - expectedOf(current)))}</p></div>
            </div>

            {/* tabs */}
            <div className="flex gap-1 border-b border-hairline bg-surface px-4">
              {(["invoices", "customers", "assumptions"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`relative px-3 py-3 text-sm font-medium capitalize transition-colors ${tab === t ? "text-brand" : "text-ink-muted hover:text-ink-secondary"}`}>
                  {t}
                  {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {tab === "invoices" && (
                <div className="animate-fade-in space-y-2">
                  {current.rows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-hairline bg-surface p-8 text-center"><div className="mb-2 text-2xl opacity-60">🧾</div><p className="text-sm text-ink-secondary">No invoices in this period</p></div>
                  ) : (
                    [...current.rows].sort((a, b) => b.outstanding - a.outstanding).map((r) => (
                      <div key={r.invoice.id} className="flex items-center justify-between rounded-xl border border-hairline bg-surface p-3 shadow-card">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{r.customerName}</p>
                          <p className="text-xs text-ink-muted">{r.invoice.invoice_no} · due {formatDate(r.invoice.due_date)}{r.overdue ? ` · ${Math.abs(r.daysToDue)}d overdue` : ""}</p>
                        </div>
                        <div className="flex-none pl-3 text-right">
                          <p className="text-sm font-semibold tabular-nums text-ink">{formatMoney(r.outstanding)}</p>
                          <span className={`text-[11px] font-medium capitalize ${r.overdue ? "text-warning" : "text-ink-muted"}`}>{r.invoice.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === "customers" && (
                <div className="animate-fade-in space-y-3">
                  {(() => {
                    const m = new Map<string, number>();
                    for (const r of current.rows) m.set(r.customerName, (m.get(r.customerName) ?? 0) + r.outstanding);
                    const list = [...m.entries()].sort((a, b) => b[1] - a[1]);
                    const tot = current.outstanding || 1;
                    return list.length === 0 ? <p className="text-sm text-ink-muted">No customers in this period.</p> : list.map(([name, v]) => (
                      <div key={name}>
                        <div className="mb-1 flex items-center justify-between text-xs"><span className="truncate pr-3 text-ink-secondary">{name}</span><span className="flex-none font-semibold tabular-nums text-ink">{formatMoney(v)}</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-ink/[0.06]"><div className="h-full rounded-full bg-brand" style={{ width: `${(v / tot) * 100}%` }} /></div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {tab === "assumptions" && (
                <div className="animate-fade-in space-y-5">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Expected collection this period</p>
                    <div className="flex items-center gap-2">
                      <span className="text-ink-muted">₹</span>
                      <input type="number" value={expectedOf(current)} onChange={(e) => setExpected(current.key, Number(e.target.value))} className={`${inputClass} w-full tabular-nums`} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input type="range" min={0} max={current.outstanding || 1} value={Math.min(expectedOf(current), current.outstanding)} onChange={(e) => setExpected(current.key, Number(e.target.value))} className="flex-1 accent-[rgb(var(--color-brand))]" />
                      <span className="w-12 text-right text-xs font-semibold tabular-nums text-ink">{current.outstanding ? Math.round((expectedOf(current) / current.outstanding) * 100) : 0}%</span>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted">Default is {current.overdue ? `${Math.max(0, confidence - 25)}%` : `${confidence}%`} of outstanding. Your edit is saved on this device only.</p>
                  </div>
                  {current.key in overrides && (
                    <button onClick={() => clearOverride(current.key)} className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-ink/[0.03]"><IconRefresh className="h-4 w-4" />Reset to default</button>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* toasts */}
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
