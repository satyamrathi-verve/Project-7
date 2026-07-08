"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import { NotConfigured } from "@/components/NotConfigured";
import { ENTITY_CONFIGS } from "@/lib/import/entities";
import { autoMapHeaders } from "@/lib/import/match";
import { buildInitialRows, fetchDbCheckContext, applyDbChecks, type DbCheckContext } from "@/lib/import/validate";
import { runImport, undoImportRun } from "@/lib/import/runner";
import { appendAuditEntry } from "@/lib/import/templates";
import type {
  CsvFileIssue,
  FieldMapping,
  ImportConfig,
  ImportEntity,
  ImportMode,
  ImportProgressState,
  ImportRow,
  ImportRunResult,
  MappingConfidence,
  ParsedCsv,
} from "@/lib/import/types";
import { DEFAULT_IMPORT_CONFIG } from "@/lib/import/types";
import { Stepper } from "./Stepper";
import { StepChooseType } from "./StepChooseType";
import { StepUpload } from "./StepUpload";
import { StepMapping } from "./StepMapping";
import { StepValidate } from "./StepValidate";
import { StepConfigure } from "./StepConfigure";
import { StepProgress } from "./StepProgress";
import { StepResults } from "./StepResults";

export function ImportWizard() {
  const [step, setStep] = useState(1);
  const [furthest, setFurthest] = useState(1);

  const [entity, setEntity] = useState<ImportEntity | null>(null);
  const [mode, setMode] = useState<ImportMode>("upsert");

  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [csvIssues, setCsvIssues] = useState<CsvFileIssue[]>([]);

  const [mapping, setMapping] = useState<FieldMapping>({});
  const [confidence, setConfidence] = useState<MappingConfidence>({});

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [dbCtx, setDbCtx] = useState<DbCheckContext | null>(null);
  const [checkingDb, setCheckingDb] = useState(false);

  const [config, setConfig] = useState<ImportConfig>(DEFAULT_IMPORT_CONFIG);
  const [progress, setProgress] = useState<ImportProgressState | null>(null);
  const [result, setResult] = useState<ImportRunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const cancelRef = useRef(false);
  const entityConfig = entity ? ENTITY_CONFIGS[entity] : null;

  function goTo(next: number) {
    setStep(next);
    setFurthest((f) => Math.max(f, next));
  }

  function handleChooseType(nextEntity: ImportEntity, nextMode: ImportMode) {
    if (nextEntity !== entity) {
      setParsedCsv(null);
      setRows([]);
      setDbCtx(null);
    }
    setEntity(nextEntity);
    setMode(nextMode);
  }

  function handleParsed(parsed: ParsedCsv, issues: CsvFileIssue[]) {
    setParsedCsv(parsed);
    setCsvIssues(issues);
    if (entityConfig) {
      const { mapping: m, confidence: c } = autoMapHeaders(parsed.headers, entityConfig);
      setMapping(m);
      setConfidence(c);
    }
  }

  async function proceedToValidation() {
    if (!entityConfig || !parsedCsv || !supabase) return;
    setCheckingDb(true);
    setRunError(null);
    try {
      const initial = buildInitialRows(parsedCsv, mapping, entityConfig);
      const ctx = await fetchDbCheckContext(initial, entityConfig, supabase);
      const checked = applyDbChecks(initial, entityConfig, mode, config, ctx);
      setDbCtx(ctx);
      setRows(checked);
      goTo(4);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Couldn't check existing records in Supabase.");
    } finally {
      setCheckingDb(false);
    }
  }

  function handleEditCell(rowIndex: number, field: string, value: string) {
    if (!entityConfig || !dbCtx) return;
    const next = rows.map((r) => (r.rowIndex === rowIndex ? { ...r, values: { ...r.values, [field]: value } } : r));
    setRows(applyDbChecks(next, entityConfig, mode, config, dbCtx));
  }

  function handleSetExcluded(rowIndexes: number[], excluded: boolean) {
    const set = new Set(rowIndexes);
    setRows((prev) => prev.map((r) => (set.has(r.rowIndex) ? { ...r, excluded } : r)));
  }

  function handleRevalidate() {
    if (!entityConfig || !dbCtx) return;
    setRows((prev) => applyDbChecks(prev, entityConfig, mode, config, dbCtx));
  }

  // Duplicate handling / date format / auto-create toggles all change what counts as
  // an error — re-run validation against the same (already-fetched) DB snapshot
  // whenever the user tunes them in Step 5, so Step 4's counts stay trustworthy.
  useEffect(() => {
    if (!entityConfig || !dbCtx || rows.length === 0) return;
    setRows((prev) => applyDbChecks(prev, entityConfig, mode, config, dbCtx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.duplicateHandling, config.autoCreateMissingCustomers, config.dateFormat, mode]);

  async function executeImport(targetRows: ImportRow[], mergeInto: ImportRunResult | null) {
    if (!entityConfig || !dbCtx || !supabase) return;
    cancelRef.current = false;
    setRunError(null);
    goTo(6);
    setProgress(null);

    try {
      const runResult = await runImport(targetRows, entityConfig, config, supabase, dbCtx, {
        onProgress: setProgress,
        shouldCancel: () => cancelRef.current,
      });

      const merged: ImportRunResult = mergeInto
        ? {
            entity: entityConfig.entity,
            created: mergeInto.created + runResult.created,
            updated: mergeInto.updated + runResult.updated,
            skipped: mergeInto.skipped + runResult.skipped,
            failed: runResult.failed,
            durationMs: mergeInto.durationMs + runResult.durationMs,
            rows: [...mergeInto.rows.filter((r) => !targetRows.some((t) => t.rowIndex === r.rowIndex)), ...runResult.rows],
            undo: [...mergeInto.undo, ...runResult.undo],
            cancelled: runResult.cancelled,
          }
        : runResult;

      setResult(merged);
      appendAuditEntry({
        id: `${Date.now()}`,
        entity: entityConfig.entity,
        mode,
        fileName: parsedCsv?.fileName ?? "unknown.csv",
        rowCount: targetRows.length,
        created: runResult.created,
        updated: runResult.updated,
        skipped: runResult.skipped,
        failed: runResult.failed,
        durationMs: runResult.durationMs,
        performedAt: new Date().toISOString(),
        performedBy: "current user",
      });
      goTo(7);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Import failed unexpectedly.");
      goTo(5);
    }
  }

  function handleRetryFailed(rowIndexes: number[]) {
    const set = new Set(rowIndexes);
    const targetRows = rows.filter((r) => set.has(r.rowIndex)).map((r) => ({ ...r, excluded: false }));
    executeImport(targetRows, result);
  }

  async function handleUndo() {
    if (!result || !supabase) return;
    await undoImportRun(result.undo, supabase);
  }

  function handleStartNew() {
    setParsedCsv(null);
    setCsvIssues([]);
    setRows([]);
    setDbCtx(null);
    setProgress(null);
    setResult(null);
    setRunError(null);
    goTo(2);
    setFurthest(2);
  }

  const eligibleRows = useMemo(() => rows.filter((r) => !r.excluded && r.action !== "skip"), [rows]);

  if (!isConfigured) return <NotConfigured />;

  return (
    <div>
      <Stepper current={step} furthest={furthest} onJump={goTo} />

      {runError && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{runError}</p>}

      {step === 1 && <StepChooseType entity={entity} mode={mode} onChange={handleChooseType} onNext={() => goTo(2)} />}

      {step === 2 && entityConfig && (
        <StepUpload entity={entityConfig} parsed={parsedCsv} onParsed={handleParsed} onBack={() => goTo(1)} onNext={() => goTo(3)} />
      )}

      {step === 3 && entityConfig && parsedCsv && (
        <StepMapping
          entity={entityConfig}
          parsed={parsedCsv}
          mapping={mapping}
          confidence={confidence}
          onChange={setMapping}
          onReset={() => {
            const { mapping: m, confidence: c } = autoMapHeaders(parsedCsv.headers, entityConfig);
            setMapping(m);
            setConfidence(c);
          }}
          onBack={() => goTo(2)}
          onNext={proceedToValidation}
        />
      )}

      {step === 3 && checkingDb && (
        <p className="mt-4 text-center text-sm text-slate-400">Checking existing records in Supabase…</p>
      )}

      {step === 4 && entityConfig && (
        <StepValidate
          entity={entityConfig}
          rows={rows}
          onEditCell={handleEditCell}
          onSetExcluded={handleSetExcluded}
          onRevalidate={handleRevalidate}
          onBack={() => goTo(3)}
          onNext={() => goTo(5)}
        />
      )}

      {step === 5 && entityConfig && (
        <StepConfigure
          entity={entityConfig}
          mode={mode}
          rows={rows}
          config={config}
          onChange={setConfig}
          onBack={() => goTo(4)}
          onNext={() => executeImport(eligibleRows, null)}
        />
      )}

      {step === 6 && <StepProgress progress={progress} onCancel={() => (cancelRef.current = true)} />}

      {step === 7 && entityConfig && result && (
        <StepResults entity={entityConfig} rows={rows} result={result} onRetryFailed={handleRetryFailed} onUndo={handleUndo} onStartNew={handleStartNew} />
      )}
    </div>
  );
}
