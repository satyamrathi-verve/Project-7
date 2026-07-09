"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ENTITY_CONFIGS } from "@/lib/import/entities";
import { listAuditLog, deleteAuditEntry, type AuditEntry, type AuditStatus } from "@/lib/import/templates";
import { formatDateTime } from "@/lib/format";

const STATUS_STYLES: Record<AuditStatus, string> = {
  success: "bg-success-bg text-success",
  partial: "bg-warning-bg text-warning",
  failed: "bg-danger-bg text-danger",
};

const STATUS_LABEL: Record<AuditStatus, string> = {
  success: "Success",
  partial: "Partially Successful",
  failed: "Failed",
};

export default function ImportHistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>(() => listAuditLog());
  const [expanded, setExpanded] = useState<string | null>(null);

  function handleDelete(id: string) {
    deleteAuditEntry(id);
    setEntries(listAuditLog());
    if (expanded === id) setExpanded(null);
  }

  return (
    <>
      <PageHeader
        title="Import History"
        subtitle="Every bulk import run in this browser — who ran it, what happened, and what to review."
        action={
          <Link href="/upload" className="rounded-lg border border-ink-muted/40 px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-section">
            ← Back to Upload Report
          </Link>
        }
      />

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-muted/40 bg-surface p-12 text-center">
          <p className="text-sm font-semibold text-ink-secondary">No imports yet</p>
          <p className="mt-1 text-sm text-ink-muted">Run your first CSV import from Upload Report and it'll show up here.</p>
          <Link href="/upload" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Go to Upload Report
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-section text-left">
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
              {entries.map((e) => {
                const imported = e.created + e.updated;
                const isOpen = expanded === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr className="border-b border-hairline/50 last:border-0 hover:bg-section">
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
                          <button type="button" onClick={() => setExpanded(isOpen ? null : e.id)} className="rounded-lg border border-ink-muted/40 px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-section">
                            {isOpen ? "Hide" : "View"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Delete this import history record? This can't be undone.")) handleDelete(e.id);
                            }}
                            className="rounded-lg border border-danger-border px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-bg"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-hairline/50 bg-section">
                        <td colSpan={8} className="px-4 py-4">
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
                              value={`${e.durationMs > 0 ? Math.round((imported / (e.durationMs / 1000))) : 0} rows/s`}
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
                                      <tr key={i} className="border-b border-hairline/50 last:border-0">
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
