"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { supabase, isConfigured } from "@/lib/supabase";
import { ENTITY_CONFIGS } from "@/lib/import/entities";
import { listAuditLog, deleteAuditEntry, type AuditEntry, type AuditStatus } from "@/lib/import/templates";
import { undoImportRun } from "@/lib/import/runner";
import { formatDateTime } from "@/lib/format";
import type { ImportEntity } from "@/lib/import/types";

const STATUS_STYLES: Record<AuditStatus, string> = {
  success: "bg-success-bg text-success",
  partial: "bg-warning-bg text-warning",
  failed: "bg-danger-bg text-danger",
  cancelled: "bg-section text-ink-muted",
};

const STATUS_LABEL: Record<AuditStatus, string> = {
  success: "Success",
  partial: "Partially Successful",
  failed: "Failed",
  cancelled: "Cancelled",
};

type EntityFilter = "all" | ImportEntity;
type StatusFilter = "all" | AuditStatus;

export default function ImportHistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>(() => listAuditLog());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (entityFilter !== "all" && e.entity !== entityFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (term && !e.fileName.toLowerCase().includes(term) && !e.performedBy.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [entries, search, entityFilter, statusFilter]);

  async function handleDelete(entry: AuditEntry) {
    const hasData = entry.undo?.length > 0 && entry.undo.some((u) => u.createdIds.length > 0 || u.updatedPrev.length > 0);
    const confirmMessage = hasData
      ? `Delete "${entry.fileName}" from history AND remove the ${entry.created + entry.updated} record(s) it imported? This permanently removes that data from the system and can't be undone.`
      : `Delete "${entry.fileName}" from history? This entry has no recoverable import data to remove (it was created before data-tracking, or nothing was actually created/updated).`;
    if (!window.confirm(confirmMessage)) return;

    setDeleteError(null);
    setDeletingId(entry.id);
    try {
      if (hasData) {
        if (!supabase) throw new Error("Supabase isn't configured — can't remove the imported data.");
        await undoImportRun(entry.undo, supabase);
      }
      deleteAuditEntry(entry.id);
      setEntries(listAuditLog());
      if (expanded === entry.id) setExpanded(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't remove the imported data. The history entry was left in place so you can retry.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!isConfigured) return <NotConfigured />;

  return (
    <>
      <PageHeader
        title="Import History"
        subtitle="Every bulk import run in this browser — who ran it, what happened, and what to review."
        action={
          <Link href="/upload" className="rounded-lg border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-secondary shadow-card hover:bg-section">
            ← Back to Upload Report
          </Link>
        }
      />

      {deleteError && (
        <p className="mb-4 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger">⚠ {deleteError}</p>
      )}

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center shadow-card">
          <p className="text-sm font-semibold text-ink-secondary">No imports yet</p>
          <p className="mt-1 text-sm text-ink-muted">Run your first CSV import from Upload Report and it'll show up here.</p>
          <Link href="/upload" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-card hover:bg-brand-dark">
            Go to Upload Report
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file name or imported by…"
              className="rounded-lg border border-hairline px-3 py-1.5 text-xs outline-none focus:border-brand"
            />
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value as EntityFilter)}
              className="rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-brand"
            >
              <option value="all">All import types</option>
              {Object.values(ENTITY_CONFIGS).map((c) => (
                <option key={c.entity} value={c.entity}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-brand"
            >
              <option value="all">All statuses</option>
              {(Object.keys(STATUS_LABEL) as AuditStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            {(search || entityFilter !== "all" || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setEntityFilter("all");
                  setStatusFilter("all");
                }}
                className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                Clear filters ×
              </button>
            )}
            <span className="text-xs text-ink-muted">
              Showing {filtered.length.toLocaleString()} of {entries.length.toLocaleString()} imports
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-hairline bg-surface p-10 text-center text-sm text-ink-muted shadow-card">
              No imports match this filter.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline bg-section text-left">
                    <th className="px-4 py-3 font-semibold text-ink-secondary">File</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Date &amp; Time</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Imported By</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Type</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Status</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Total</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Imported</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Failed</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const imported = e.created + e.updated;
                    const isOpen = expanded === e.id;
                    const isDeleting = deletingId === e.id;
                    return (
                      <Fragment key={e.id}>
                        <tr className="border-b border-hairline last:border-0 hover:bg-section">
                          <td className="max-w-[12rem] truncate px-4 py-3 font-medium text-ink" title={e.fileName}>
                            📄 {e.fileName}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-ink-secondary">{formatDateTime(e.performedAt)}</td>
                          <td className="px-4 py-3 text-ink-secondary">{e.performedBy || "—"}</td>
                          <td className="px-4 py-3 text-ink-secondary">{ENTITY_CONFIGS[e.entity]?.label ?? e.entity}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[e.status]}`}>{STATUS_LABEL[e.status]}</span>
                          </td>
                          <td className="px-4 py-3 text-ink-secondary">{e.rowCount.toLocaleString()}</td>
                          <td className="px-4 py-3 font-medium text-success">{imported.toLocaleString()}</td>
                          <td className="px-4 py-3 font-medium text-danger">{e.failed.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setExpanded(isOpen ? null : e.id)}
                                className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-section"
                              >
                                {isOpen ? "Hide" : "View"}
                              </button>
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => handleDelete(e)}
                                className="rounded-lg border border-danger-border px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-bg disabled:cursor-wait disabled:opacity-50"
                              >
                                {isDeleting ? "Deleting…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-hairline bg-section">
                            <td colSpan={9} className="px-4 py-4">
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <Detail label="File" value={e.fileName} />
                                <Detail label="Mode" value={e.mode} />
                                <Detail label="Created" value={e.created.toLocaleString()} />
                                <Detail label="Updated" value={e.updated.toLocaleString()} />
                                <Detail label="Skipped" value={e.skipped.toLocaleString()} />
                                <Detail label="Failed" value={e.failed.toLocaleString()} />
                                <Detail label="Duration" value={`${(e.durationMs / 1000).toFixed(1)}s`} />
                                <Detail
                                  label="Speed"
                                  value={`${e.durationMs > 0 ? Math.round(imported / (e.durationMs / 1000)) : 0} rows/s`}
                                />
                              </div>
                              {e.failedSample.length > 0 && (
                                <div className="mt-4">
                                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                    Sample of failed rows ({e.failedSample.length}{e.failed > e.failedSample.length ? ` of ${e.failed}` : ""})
                                  </p>
                                  <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
                                    <table className="w-full text-xs">
                                      <tbody>
                                        {e.failedSample.map((f, i) => (
                                          <tr key={i} className="border-b border-hairline last:border-0">
                                            <td className="whitespace-nowrap px-3 py-1.5 font-medium text-ink-secondary">{f.key}</td>
                                            <td className="px-3 py-1.5 text-danger">{f.error}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
