"use client";

import { useMemo, useState } from "react";
import type { EntityConfig, FieldMapping, MappingConfidence, ParsedCsv } from "@/lib/import/types";
import { confidenceLabel } from "@/lib/import/match";
import { listMappingTemplates, saveMappingTemplate, deleteMappingTemplate } from "@/lib/import/templates";

const TONE_CLASSES: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-amber-100 text-amber-700",
  none: "bg-slate-100 text-slate-400",
};

export function StepMapping({
  entity,
  parsed,
  mapping,
  confidence,
  onChange,
  onReset,
  onBack,
  onNext,
}: {
  entity: EntityConfig;
  parsed: ParsedCsv;
  mapping: FieldMapping;
  confidence: MappingConfidence;
  onChange: (mapping: FieldMapping) => void;
  onReset: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState(() => listMappingTemplates(entity.entity));

  const mappedFieldKeys = useMemo(() => new Set(Object.values(mapping).filter(Boolean) as string[]), [mapping]);
  const requiredFields = entity.fields.filter((f) => f.required);
  const missingRequired = requiredFields.filter((f) => !mappedFieldKeys.has(f.key));

  function setHeaderTarget(header: string, target: string | null) {
    const next = { ...mapping };
    if (target) {
      // A target field can only be claimed by one column — clear it elsewhere first.
      for (const h of Object.keys(next)) {
        if (next[h] === target) next[h] = null;
      }
    }
    next[header] = target;
    onChange(next);
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

      {missingRequired.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Map all required fields to continue — still missing: <strong>{missingRequired.map((f) => f.label).join(", ")}</strong>
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 font-semibold text-slate-600">CSV column</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Sample value</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Maps to</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {parsed.headers.map((header) => {
              const target = mapping[header] ?? null;
              const score = confidence[header] ?? 0;
              const { label, tone } = confidenceLabel(target ? score : 0);
              const sample = parsed.rows.find((r) => (r[header] ?? "").trim() !== "")?.[header] ?? "";
              return (
                <tr key={header} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{header || <em className="text-slate-400">(blank)</em>}</td>
                  <td className="max-w-[16rem] truncate px-4 py-3 text-slate-500">{sample || <em className="text-slate-300">empty</em>}</td>
                  <td className="px-4 py-3">
                    <select
                      value={target ?? ""}
                      onChange={(e) => setHeaderTarget(header, e.target.value || null)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                    >
                      <option value="">— Ignore this column —</option>
                      {entity.fields.map((f) => (
                        <option key={f.key} value={f.key} disabled={mappedFieldKeys.has(f.key) && mapping[header] !== f.key}>
                          {f.label}
                          {f.required ? " *" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}>{target ? label : "—"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Target fields</p>
        <div className="flex flex-wrap gap-1.5">
          {entity.fields.map((f) => (
            <span
              key={f.key}
              className={`rounded-full px-2.5 py-1 text-xs ${
                mappedFieldKeys.has(f.key) ? "bg-emerald-100 text-emerald-700" : f.required ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {f.label}
              {f.required ? " *" : ""}
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Back
        </button>
        <button
          type="button"
          disabled={missingRequired.length > 0}
          onClick={onNext}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue to validation
        </button>
      </div>
    </div>
  );
}
