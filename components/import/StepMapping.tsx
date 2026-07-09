"use client";

import { useMemo, useState } from "react";
import type { EntityConfig, FieldMapping, MappingConfidence, ParsedCsv } from "@/lib/import/types";
import { confidenceLabel } from "@/lib/import/match";
import { listMappingTemplates, saveMappingTemplate, deleteMappingTemplate } from "@/lib/import/templates";

const CONFIDENCE_TONE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-amber-100 text-amber-700",
  none: "bg-slate-100 text-slate-400",
};

/*
  One row per DESTINATION field (not per CSV column) — each import type only ever
  shows its own fields (EntityConfig.fields is already scoped per entity, see
  lib/import/entities.ts), and the whole "which CSV column feeds this?" +
  "is it required?" + "is it mapped?" picture lives in a single table instead of
  being split across a separate required-fields list and a column-mapping list.
  This also makes mapping tolerant of any CSV column layout: a field's dropdown
  just offers every header in the file, so renamed/reordered/extra columns are a
  non-issue — you only ever pick the one that actually feeds each field.
*/
export function StepMapping({
  entity,
  parsed,
  mapping,
  confidence,
  autoMapping,
  onChange,
  onReset,
  onBack,
  onNext,
}: {
  entity: EntityConfig;
  parsed: ParsedCsv;
  mapping: FieldMapping;
  confidence: MappingConfidence;
  /** The mapping autoMapHeaders originally suggested — used only to label confidence as "auto" vs "manual". */
  autoMapping: FieldMapping;
  onChange: (mapping: FieldMapping) => void;
  onReset: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState(() => listMappingTemplates(entity.entity));

  const headerForField = useMemo(() => {
    const m = new Map<string, string>();
    for (const [header, target] of Object.entries(mapping)) {
      if (target) m.set(target, header);
    }
    return m;
  }, [mapping]);

  const claimedHeaders = useMemo(() => new Set(Object.values(mapping).filter(Boolean) as string[]).size, [mapping]);
  const orderedFields = useMemo(() => [...entity.fields].sort((a, b) => Number(b.required) - Number(a.required)), [entity.fields]);
  const missingRequiredCount = entity.fields.filter((f) => f.required && !headerForField.has(f.key)).length;

  function setFieldSource(fieldKey: string, header: string | null) {
    const next = { ...mapping };
    // A destination field can only be fed by one column — clear any prior claim.
    for (const h of Object.keys(next)) {
      if (next[h] === fieldKey) next[h] = null;
    }
    if (header) next[header] = fieldKey;
    onChange(next);
  }

  function sampleFor(header: string): string {
    return parsed.rows.find((r) => (r[header] ?? "").trim() !== "")?.[header] ?? "";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mapping templates</span>
          {templates.length === 0 ? (
            <span className="text-xs text-slate-400">None saved yet</span>
          ) : (
            templates.map((t) => (
              <span key={t.id} className="flex items-center gap-1 rounded-full bg-slate-100 pl-3 pr-1 py-1 text-xs text-slate-600">
                <button type="button" className="font-medium hover:text-brand" onClick={() => onChange(t.mapping)}>
                  {t.name}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${t.name}`}
                  className="rounded-full px-1.5 text-slate-400 hover:bg-slate-200 hover:text-red-600"
                  onClick={() => {
                    deleteMappingTemplate(t.id);
                    setTemplates(listMappingTemplates(entity.entity));
                  }}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Name this mapping…"
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand"
          />
          <button
            type="button"
            disabled={!templateName.trim()}
            onClick={() => {
              saveMappingTemplate(entity.entity, templateName.trim(), mapping);
              setTemplateName("");
              setTemplates(listMappingTemplates(entity.entity));
            }}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-30"
          >
            Save mapping
          </button>
          <button type="button" onClick={onReset} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Reset to auto-map
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">CSV mapping for {entity.label}</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">
            {claimedHeaders} of {parsed.headers.length} CSV columns used
          </span>
          {missingRequiredCount > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">{missingRequiredCount} required field(s) missing</span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 font-semibold text-slate-600">Destination field</th>
              <th className="px-4 py-3 font-semibold text-slate-600">CSV column</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Sample value</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Mapping status</th>
            </tr>
          </thead>
          <tbody>
            {orderedFields.map((f) => {
              const selectedHeader = headerForField.get(f.key) ?? "";
              const isAutoMatch = selectedHeader !== "" && autoMapping[selectedHeader] === f.key;
              const { label: confLabel, tone } = confidenceLabel(isAutoMatch ? confidence[selectedHeader] ?? 0 : 0);
              const isMissingRequired = f.required && !selectedHeader;

              return (
                <tr key={f.key} className={`border-b border-slate-100 last:border-0 ${isMissingRequired ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{f.label}</span>
                      {f.required ? (
                        <span className="flex-none rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">Required</span>
                      ) : (
                        <span className="flex-none rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Optional</span>
                      )}
                    </div>
                    {f.help && <p className="mt-0.5 text-xs text-slate-400">{f.help}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={selectedHeader}
                      onChange={(e) => setFieldSource(f.key, e.target.value || null)}
                      className={`rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand ${
                        isMissingRequired ? "border-red-300" : "border-slate-300"
                      }`}
                    >
                      <option value="">— Not mapped —</option>
                      {parsed.headers.map((h) => (
                        <option key={h} value={h} disabled={Boolean(mapping[h]) && mapping[h] !== f.key}>
                          {h || "(blank header)"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-slate-500">
                    {selectedHeader ? sampleFor(selectedHeader) || <em className="text-slate-300">empty</em> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {selectedHeader ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Mapped</span>
                      ) : f.required ? (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Missing — required</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-400">Unmapped — optional</span>
                      )}
                      {selectedHeader && isAutoMatch && confidence[selectedHeader] > 0 && (
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${CONFIDENCE_TONE[tone]}`}>{confLabel}</span>
                      )}
                      {selectedHeader && !isAutoMatch && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">Manual</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Back
        </button>
        <button
          type="button"
          disabled={missingRequiredCount > 0}
          onClick={onNext}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue to validation
        </button>
      </div>
    </div>
  );
}
