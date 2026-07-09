"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ENTITY_CONFIGS } from "@/lib/import/entities";
import { listAuditLog, deleteAuditEntry, type AuditEntry, type AuditStatus } from "@/lib/import/templates";
import { formatDateTime } from "@/lib/format";

const STATUS_STYLES: Record<AuditStatus, string> = {
  success: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
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
          <Link href="/upload" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            ← Back to Upload Report
          </Link>
        }
      />

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm font-semibold text-slate-600">No imports yet</p>
          <p className="mt-1 text-sm text-slate-400">Run your first CSV import from Upload Report and it'll show up here.</p>
          <Link href="/upload" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Go to Upload Report
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600">Date &amp; Time</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Imported By</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Type</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Total</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Imported</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Failed</th>
                <th className="px-4 py-3 font-semibold text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const imported = e.created + e.updated;
                const isOpen = expanded === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(e.performedAt)}</td>
                      <td className="px-4 py-3 text-slate-700">{e.performedBy || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{ENTITY_CONFIGS[e.entity]?.label ?? e.entity}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[e.status]}`}>{STATUS_LABEL[e.status]}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{e.rowCount.toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium text-emerald-600">{imported.toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium text-red-600">{e.failed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setExpanded(isOpen ? null : e.id)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                            {isOpen ? "Hide" : "View"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Delete this import history record? This can't be undone.")) handleDelete(e.id);
                            }}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-slate-100 bg-slate-50">
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
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Sample of failed rows ({e.failedSample.length}{e.failed > e.failedSample.length ? ` of ${e.failed}` : ""})
                              </p>
                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="w-full text-xs">
                                  <tbody>
                                    {e.failedSample.map((f, i) => (
                                      <tr key={i} className="border-b border-slate-100 last:border-0">
                                        <td className="whitespace-nowrap px-3 py-1.5 font-medium text-slate-700">{f.key}</td>
                                        <td className="px-3 py-1.5 text-red-600">{f.error}</td>
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
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
