import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EntityConfig,
  ImportConfig,
  ImportProgressState,
  ImportResultRow,
  ImportRow,
  ImportRunResult,
  UndoRecord,
} from "./types";
import type { DbCheckContext } from "./validate";
import { parseDateFlexible } from "./validate";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildCustomerPayload(values: Record<string, string>) {
  return {
    code: values.code,
    name: values.name,
    contact_person: values.contact_person || null,
    email: values.email || null,
    phone: values.phone || null,
    address: values.address || null,
    gstin: values.gstin || null,
    pan: values.pan || null,
    credit_limit: values.credit_limit ? Number(values.credit_limit) : 0,
    credit_days: values.credit_days ? Number(values.credit_days) : 30,
    opening_balance: values.opening_balance ? Number(values.opening_balance) : 0,
  };
}

function buildInvoicePayload(values: Record<string, string>, customerId: string, customerCreditDays: number, dateFormat: ImportConfig["dateFormat"]) {
  const invoiceDate = parseDateFlexible(values.invoice_date, dateFormat)!;
  const dueDate = values.due_date ? parseDateFlexible(values.due_date, dateFormat) : null;
  const subtotal = Number(values.subtotal || 0);
  const taxAmount = values.tax_amount ? Number(values.tax_amount) : 0;
  const total = values.total ? Number(values.total) : subtotal + taxAmount;
  const status = values.status && ["open", "partial", "paid", "overdue"].includes(values.status.toLowerCase())
    ? values.status.toLowerCase()
    : "open";

  return {
    invoice_no: values.invoice_no,
    invoice_date: invoiceDate,
    customer_id: customerId,
    due_date: dueDate ?? addDays(invoiceDate, customerCreditDays),
    subtotal,
    tax_amount: taxAmount,
    total,
    status,
    notes: values.notes || null,
  };
}

export interface RunnerCallbacks {
  onProgress: (state: ImportProgressState) => void;
  shouldCancel: () => boolean;
}

/**
 * Executes the import in batches against Supabase.
 *
 * There's no real database transaction here — the anon Supabase client can't run
 * multi-statement transactions, and adding one would mean a server-side RPC/Edge
 * Function, which is backend surface this project's rules keep hands off. Instead:
 * every batch call uses `.upsert(..., { onConflict: uniqueKey })`, which is atomic
 * *per batch* (Postgres does the insert-or-update in one statement), and we record
 * exactly which rows we created or changed so Step 7 can offer a real "Undo this
 * import" that deletes what we created and restores what we overwrote.
 */
export async function runImport(
  rows: ImportRow[],
  entity: EntityConfig,
  config: ImportConfig,
  client: SupabaseClient,
  ctx: DbCheckContext,
  callbacks: RunnerCallbacks
): Promise<ImportRunResult> {
  const startedAt = Date.now();
  const eligible = rows.filter((r) => !r.excluded && r.action !== "skip");
  const blocked = eligible.filter((r) => r.status === "error");
  const ready = eligible.filter((r) => r.status !== "error");

  if (blocked.length > 0 && !config.continueOnError) {
    throw new Error(`${blocked.length} row(s) still have unresolved errors. Fix them or enable "continue after recoverable errors."`);
  }

  const total = ready.length;
  const batches = chunk(ready, Math.max(1, config.batchSize));
  const resultRows: ImportResultRow[] = blocked.map((r) => ({
    rowIndex: r.rowIndex,
    key: r.values[entity.uniqueKey],
    action: "failed",
    error: r.issues.find((i) => i.level === "error")?.message ?? "Unresolved validation error.",
  }));

  let created = 0;
  let updated = 0;
  let failed = 0;
  let processed = 0;
  let cancelled = false;

  const customerIdByCode = new Map<string, string>();
  for (const [code, row] of ctx.customersByCode) customerIdByCode.set(code, String(row.id));
  const customerCreditDaysByCode = new Map<string, number>();
  for (const [code, row] of ctx.customersByCode) customerCreditDaysByCode.set(code, Number(row.credit_days ?? 30));

  const undoCustomers: UndoRecord = { table: "customers", createdIds: [], updatedPrev: [] };
  const undoMain: UndoRecord = { table: entity.table, createdIds: [], updatedPrev: [] };

  const report = (stage: ImportProgressState["stage"]) => {
    const elapsedSec = Math.max((Date.now() - startedAt) / 1000, 0.001);
    const rowsPerSecond = processed / elapsedSec;
    const remaining = total - processed;
    callbacks.onProgress({
      stage,
      processed,
      total,
      succeeded: created + updated,
      failed,
      startedAt,
      etaSeconds: rowsPerSecond > 0 ? Math.round(remaining / rowsPerSecond) : null,
      rowsPerSecond: Math.round(rowsPerSecond * 10) / 10,
      currentBatch: 0,
      totalBatches: batches.length,
    });
  };

  report("preparing");

  for (let b = 0; b < batches.length; b++) {
    if (callbacks.shouldCancel()) {
      cancelled = true;
      break;
    }
    const batch = batches[b];

    try {
      if (entity.entity === "customers") {
        await runCustomerBatch(batch, config, client, undoCustomers, resultRows);
      } else {
        await runInvoiceBatch(batch, config, client, customerIdByCode, customerCreditDaysByCode, undoCustomers, undoMain, resultRows);
      }
    } catch {
      // Batch-level failure already isolated to per-row failures inside the helpers below.
    }

    for (const r of batch) {
      const outcome = resultRows.find((x) => x.rowIndex === r.rowIndex);
      if (outcome?.action === "create") created++;
      else if (outcome?.action === "update") updated++;
      else if (outcome?.action === "failed") failed++;
    }
    processed += batch.length;

    callbacks.onProgress({
      stage: "importing",
      processed,
      total,
      succeeded: created + updated,
      failed,
      startedAt,
      etaSeconds: null,
      rowsPerSecond: Math.round((processed / Math.max((Date.now() - startedAt) / 1000, 0.001)) * 10) / 10,
      currentBatch: b + 1,
      totalBatches: batches.length,
    });
  }

  const skippedCount = rows.length - eligible.length + (cancelled ? total - processed : 0);

  report(cancelled ? "cancelled" : "done");

  return {
    entity: entity.entity,
    created,
    updated,
    skipped: skippedCount,
    failed: failed + blocked.length,
    durationMs: Date.now() - startedAt,
    rows: resultRows,
    undo: [undoMain, ...(undoCustomers.createdIds.length || undoCustomers.updatedPrev.length ? [undoCustomers] : [])],
    cancelled,
  };
}

async function runCustomerBatch(
  batch: ImportRow[],
  config: ImportConfig,
  client: SupabaseClient,
  undo: UndoRecord,
  resultRows: ImportResultRow[]
) {
  const payloads = batch.map((r) => buildCustomerPayload(r.values));
  const { data, error } = await client.from("customers").upsert(payloads, { onConflict: "code" }).select("id, code");

  if (error) {
    await fallbackPerRow(batch, config, resultRows, async (row) => {
      const { data: d, error: e } = await client
        .from("customers")
        .upsert(buildCustomerPayload(row.values), { onConflict: "code" })
        .select("id, code")
        .single();
      if (e) throw e;
      return d;
    }, undo);
    return;
  }

  const byCode = new Map((data ?? []).map((d) => [String((d as Record<string, unknown>).code), (d as Record<string, unknown>).id as string]));
  for (const row of batch) {
    const id = byCode.get(row.values.code);
    resultRows.push({ rowIndex: row.rowIndex, key: row.values.code, action: row.action === "skip" ? "skip" : row.action });
    if (!id) continue;
    if (row.action === "create") undo.createdIds.push(id);
    else if (row.action === "update" && row.existing) undo.updatedPrev.push({ id, prev: row.existing });
  }
}

async function runInvoiceBatch(
  batch: ImportRow[],
  config: ImportConfig,
  client: SupabaseClient,
  customerIdByCode: Map<string, string>,
  customerCreditDaysByCode: Map<string, number>,
  undoCustomers: UndoRecord,
  undoInvoices: UndoRecord,
  resultRows: ImportResultRow[]
) {
  // Resolve/auto-create any customers this batch references before touching invoices.
  const missingCodes = [...new Set(batch.map((r) => r.values.customer_code).filter((c) => c && !customerIdByCode.has(c)))];
  if (missingCodes.length > 0 && config.autoCreateMissingCustomers) {
    const newCustomers = missingCodes.map((code) => ({ code, name: code, credit_limit: 0, credit_days: 30, opening_balance: 0 }));
    const { data } = await client.from("customers").upsert(newCustomers, { onConflict: "code" }).select("id, code, credit_days");
    for (const c of data ?? []) {
      const rec = c as Record<string, unknown>;
      customerIdByCode.set(String(rec.code), String(rec.id));
      customerCreditDaysByCode.set(String(rec.code), Number(rec.credit_days ?? 30));
      undoCustomers.createdIds.push(String(rec.id));
    }
  }

  const resolvable = batch.filter((r) => customerIdByCode.has(r.values.customer_code));
  const unresolved = batch.filter((r) => !customerIdByCode.has(r.values.customer_code));
  for (const row of unresolved) {
    resultRows.push({ rowIndex: row.rowIndex, key: row.values.invoice_no, action: "failed", error: `Customer "${row.values.customer_code}" could not be resolved.` });
  }

  const payloads = resolvable.map((r) =>
    buildInvoicePayload(r.values, customerIdByCode.get(r.values.customer_code)!, customerCreditDaysByCode.get(r.values.customer_code) ?? 30, config.dateFormat)
  );

  const { data, error } = await client.from("invoices").upsert(payloads, { onConflict: "invoice_no" }).select("id, invoice_no");

  if (error) {
    await fallbackPerRow(resolvable, config, resultRows, async (row) => {
      const { data: d, error: e } = await client
        .from("invoices")
        .upsert(
          buildInvoicePayload(row.values, customerIdByCode.get(row.values.customer_code)!, customerCreditDaysByCode.get(row.values.customer_code) ?? 30, config.dateFormat),
          { onConflict: "invoice_no" }
        )
        .select("id, invoice_no")
        .single();
      if (e) throw e;
      return d;
    }, undoInvoices, async (row, id) => {
      if (row.action === "create") await insertDefaultLineItem(client, id, row.values);
    });
    return;
  }

  const byNo = new Map((data ?? []).map((d) => [String((d as Record<string, unknown>).invoice_no), (d as Record<string, unknown>).id as string]));
  const newlyCreatedIds: { id: string; subtotal: string; notes: string }[] = [];

  for (const row of resolvable) {
    const id = byNo.get(row.values.invoice_no);
    resultRows.push({ rowIndex: row.rowIndex, key: row.values.invoice_no, action: row.action === "skip" ? "skip" : row.action });
    if (!id) continue;
    if (row.action === "create") {
      undoInvoices.createdIds.push(id);
      newlyCreatedIds.push({ id, subtotal: row.values.subtotal, notes: row.values.notes });
    } else if (row.action === "update" && row.existing) {
      undoInvoices.updatedPrev.push({ id, prev: row.existing });
    }
  }

  if (newlyCreatedIds.length > 0) {
    await client.from("invoice_items").insert(
      newlyCreatedIds.map((r) => ({
        invoice_id: r.id,
        description: r.notes || "Imported invoice",
        qty: 1,
        rate: Number(r.subtotal || 0),
        amount: Number(r.subtotal || 0),
      }))
    );
  }
}

async function insertDefaultLineItem(client: SupabaseClient, invoiceId: string, values: Record<string, string>) {
  await client.from("invoice_items").insert({
    invoice_id: invoiceId,
    description: values.notes || "Imported invoice",
    qty: 1,
    rate: Number(values.subtotal || 0),
    amount: Number(values.subtotal || 0),
  });
}

/**
 * When a whole-batch upsert fails (one bad row can fail the statement), and the user
 * asked to continue past recoverable errors, we retry the batch one row at a time so
 * the good rows still land and only the genuinely bad ones get reported as failed.
 */
async function fallbackPerRow(
  batch: ImportRow[],
  config: ImportConfig,
  resultRows: ImportResultRow[],
  execOne: (row: ImportRow) => Promise<Record<string, unknown> | null>,
  undo: UndoRecord,
  afterSuccess?: (row: ImportRow, id: string) => Promise<void>
) {
  for (const row of batch) {
    const key = row.values.code ?? row.values.invoice_no ?? String(row.rowIndex);
    try {
      const data = await execOne(row);
      const id = data ? String((data as Record<string, unknown>).id) : null;
      resultRows.push({ rowIndex: row.rowIndex, key, action: row.action === "skip" ? "skip" : row.action });
      if (id) {
        if (row.action === "create") undo.createdIds.push(id);
        else if (row.action === "update" && row.existing) undo.updatedPrev.push({ id, prev: row.existing });
        if (afterSuccess) await afterSuccess(row, id);
      }
    } catch (err) {
      resultRows.push({
        rowIndex: row.rowIndex,
        key,
        action: "failed",
        error: err instanceof Error ? err.message : "Insert failed.",
      });
      if (!config.continueOnError) throw err;
    }
  }
}

/** Deletes everything this run created and restores everything it overwrote. */
export async function undoImportRun(undo: UndoRecord[], client: SupabaseClient): Promise<void> {
  for (const record of undo) {
    for (const { id, prev } of record.updatedPrev) {
      const { id: _id, created_at: _createdAt, ...rest } = prev;
      await client.from(record.table).update(rest).eq("id", id);
    }
  }
  // Delete created rows last, and main-entity table before customers, so FK
  // cascades don't race with an explicit delete on the same row.
  const ordered = [...undo].sort((a, b) => (a.table === "customers" ? 1 : 0) - (b.table === "customers" ? 1 : 0));
  for (const record of ordered) {
    if (record.createdIds.length === 0) continue;
    await client.from(record.table).delete().in("id", record.createdIds);
  }
}
