import { ENTITY_LIST } from "@/lib/import/entities";
import type { ImportEntity, ImportMode } from "@/lib/import/types";

const MODES: { value: ImportMode; label: string; description: string }[] = [
  { value: "create", label: "Create New", description: "Add brand-new records only. Rows matching an existing code will be flagged so you don't create duplicates." },
  { value: "update", label: "Update Existing", description: "Change records that already exist. Rows with no matching existing record will be flagged as errors." },
  { value: "upsert", label: "Create or Update (Upsert)", description: "The safest default — new codes are created, existing codes are updated in place." },
];

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
  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">What are you importing?</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {ENTITY_LIST.map((cfg) => {
            const selected = entity === cfg.entity;
            return (
              <button
                key={cfg.entity}
                type="button"
                onClick={() => onChange(cfg.entity, mode)}
                className={`rounded-xl border p-5 text-left transition-colors ${
                  selected ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-slate-200 bg-white hover:border-brand/50"
                }`}
              >
                <p className="text-base font-bold text-slate-900">{cfg.label}</p>
                <p className="mt-1 text-sm text-slate-500">{cfg.description}</p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {cfg.fields.filter((f) => f.required).length} required field(s) · {cfg.fields.length} total
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {entity && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Import mode</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map((m) => {
              const selected = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => onChange(entity, m.value)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    selected ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-slate-200 bg-white hover:border-brand/50"
                  }`}
                >
                  <p className="text-sm font-bold text-slate-900">{m.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{m.description}</p>
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
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
