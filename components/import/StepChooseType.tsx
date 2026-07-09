import Link from "next/link";
import { ENTITY_LIST } from "@/lib/import/entities";
import type { ImportEntity, ImportMode } from "@/lib/import/types";
import { Collapsible } from "./Collapsible";

const MODES: { value: ImportMode; label: string; description: string }[] = [
  { value: "create", label: "Create New", description: "Add brand-new records only. Rows matching an existing code will be flagged so you don't create duplicates." },
  { value: "update", label: "Update Existing", description: "Change records that already exist. Rows with no matching existing record will be flagged as errors." },
  { value: "upsert", label: "Create or Update (Upsert)", description: "The safest default — new codes are created, existing codes are updated in place." },
];

const ENTITY_ICON: Record<string, string> = { customers: "🏢", invoices: "🧾" };

export function StepChooseType({
  entity,
  mode,
  onChange,
  onNext,
}: {
  entity: ImportEntity | null;
  mode: ImportMode;
  onChange: (entity: ImportEntity, mode: ImportMode) => void;
  onNext: () => void;
}) {
  const selectedConfig = entity ? ENTITY_LIST.find((c) => c.entity === entity) ?? null : null;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink-secondary">What are you importing?</h3>
        </div>
        <Link
          href="/upload/history"
          className="flex flex-none items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-xs font-medium text-ink-secondary shadow-card hover:bg-section"
        >
          🕒 Import History
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ENTITY_LIST.map((cfg) => {
          const selected = entity === cfg.entity;
          return (
            <button
              key={cfg.entity}
              type="button"
              onClick={() => onChange(cfg.entity, mode)}
              className={`rounded-xl border p-5 text-left transition-all duration-150 ${
                selected
                  ? "border-brand bg-brand/5 ring-1 ring-brand"
                  : "border-hairline bg-surface shadow-card hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card-hover"
              }`}
            >
              <p className="flex items-center gap-2 text-base font-bold text-ink">
                <span aria-hidden>{ENTITY_ICON[cfg.entity] ?? "📁"}</span>
                {cfg.label}
              </p>
              <p className="mt-1 text-sm text-ink-muted">{cfg.description}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
                {cfg.fields.filter((f) => f.required).length} required field(s) · {cfg.fields.length} total
              </p>
            </button>
          );
        })}
      </div>

      {selectedConfig && (
        <Collapsible
          title={`Field requirements for ${selectedConfig.label}`}
          subtitle="What you need before you prepare your file — expand any time to check again"
          defaultOpen
          badge={
            <span className="flex-none rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
              {selectedConfig.fields.filter((f) => f.required).length} required
            </span>
          }
        >
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Before you prepare your file</p>
              <ul className="space-y-2">
                {selectedConfig.mandatoryHighlights.map((h) => (
                  <li key={h.label} className="flex gap-2 text-sm text-ink-secondary">
                    <span className="mt-0.5 flex-none rounded bg-danger-bg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">Required</span>
                    <span>
                      <span className="font-semibold text-ink">{h.label}</span>
                      {h.note && <span className="text-ink-muted"> — {h.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">All supported fields</p>
              <div className="overflow-hidden rounded-lg border border-hairline">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline bg-section text-left">
                      <th className="px-4 py-2.5 font-semibold text-ink-secondary">Field</th>
                      <th className="px-4 py-2.5 font-semibold text-ink-secondary">Status</th>
                      <th className="px-4 py-2.5 font-semibold text-ink-secondary">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedConfig.fields.map((f) => (
                      <tr key={f.key} className="border-b border-hairline last:border-0">
                        <td className="px-4 py-2.5 font-medium text-ink">{f.label}</td>
                        <td className="px-4 py-2.5">
                          {f.required ? (
                            <span className="rounded-full bg-danger-bg px-2 py-1 text-xs font-semibold text-danger">Required *</span>
                          ) : (
                            <span className="rounded-full bg-section px-2 py-1 text-xs font-medium text-ink-muted">Optional</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-ink-muted">{f.help ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Collapsible>
      )}

      {entity && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink-secondary">Import mode</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map((m) => {
              const selected = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => onChange(entity, m.value)}
                  className={`rounded-xl border p-4 text-left transition-all duration-150 ${
                    selected
                      ? "border-brand bg-brand/5 ring-1 ring-brand"
                      : "border-hairline bg-surface shadow-card hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card-hover"
                  }`}
                >
                  <p className="text-sm font-bold text-ink">{m.label}</p>
                  <p className="mt-1 text-xs text-ink-muted">{m.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!entity}
          onClick={onNext}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
