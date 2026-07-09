"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { ReminderTemplate } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { FormField, inputClass } from "@/components/FormField";

type StageKey = "friendly" | "overdue1" | "overdue2" | "final" | "custom";

type StageInfo = {
  label: string;
  trigger: string;
  offsetDays: number;
  badgeClass: string;
  dotClass: string;
};

const STAGES: Record<StageKey, StageInfo> = {
  friendly: {
    label: "Friendly reminder",
    trigger: "Sent 3 days before due date",
    offsetDays: -3,
    badgeClass: "bg-info-bg text-info ring-1 ring-inset ring-info-border",
    dotClass: "bg-info",
  },
  overdue1: {
    label: "1st overdue",
    trigger: "Sent 3 days after due date",
    offsetDays: 3,
    badgeClass: "bg-warning-bg text-warning ring-1 ring-inset ring-warning-border",
    dotClass: "bg-warning",
  },
  overdue2: {
    label: "2nd overdue",
    trigger: "Sent 10 days after due date",
    offsetDays: 10,
    badgeClass: "bg-warning-bg text-warning ring-1 ring-inset ring-warning-border",
    dotClass: "bg-warning",
  },
  final: {
    label: "Final reminder",
    trigger: "Sent 20 days after due date",
    offsetDays: 20,
    badgeClass: "bg-danger-bg text-danger ring-1 ring-inset ring-danger-border",
    dotClass: "bg-danger",
  },
  custom: {
    label: "Custom stage",
    trigger: "Trigger set manually",
    offsetDays: 0,
    badgeClass: "bg-sidebar text-ink-secondary ring-1 ring-inset ring-hairline",
    dotClass: "bg-ink-muted",
  },
};

function classifyStage(name: string): StageKey {
  const n = name.toLowerCase();
  if (n.includes("friendly") || n.includes("gentle")) return "friendly";
  if (n.includes("final") || n.includes("escalat")) return "final";
  if (n.includes("second") || n.includes("2nd")) return "overdue2";
  if (n.includes("overdue") || n.includes("first") || n.includes("1st")) return "overdue1";
  return "custom";
}

const MOCK_CONTEXT: Record<string, string> = {
  customer: "Acme Pvt Ltd",
  invoice_no: "INV-1045",
  invoice_date: "01 Jul 2026",
  due_date: "12 Jul 2026",
  amount_due: "₹48,500",
  amount: "₹48,500",
  payment_link: "https://pay.example.com/inv-1045",
  company_name: "Verve Advisory Pvt Ltd",
  days_overdue: "5",
};

function extractVariables(text: string): string[] {
  const matches = text.match(/\{[a-zA-Z_]+\}/g) ?? [];
  return Array.from(new Set(matches));
}

function fillTemplate(text: string): string {
  return text.replace(/\{([a-zA-Z_]+)\}/g, (match, key) => MOCK_CONTEXT[key] ?? match);
}

function highlightVariables(text: string) {
  const parts = text.split(/(\{[a-zA-Z_]+\})/g);
  return parts.map((part, i) =>
    /^\{[a-zA-Z_]+\}$/.test(part) ? (
      <span key={i} className="rounded bg-brand/10 px-1 font-medium text-brand-dark">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

type FormState = { name: string; subject: string; body: string };
const EMPTY_FORM: FormState = { name: "", subject: "", body: "" };
const ALL_PLACEHOLDERS = [
  "{customer}",
  "{invoice_no}",
  "{invoice_date}",
  "{due_date}",
  "{amount_due}",
  "{payment_link}",
  "{company_name}",
];

type EditRecord = { at: string; by: string };

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ReminderTemplatePage() {
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | StageKey>("all");
  const [sortBy, setSortBy] = useState<"name" | "recent">("name");

  const [editLog, setEditLog] = useState<Record<string, EditRecord>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("rt_edit_log");
      if (raw) setEditLog(JSON.parse(raw));
    } catch {
      // ignore malformed local cache
    }
  }, []);

  function recordEdit(id: string) {
    const next = { ...editLog, [id]: { at: new Date().toISOString(), by: "You" } };
    setEditLog(next);
    localStorage.setItem("rt_edit_log", JSON.stringify(next));
  }

  async function loadTemplates() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reminder_templates")
      .select("*")
      .order("name", { ascending: true });
    if (error) setError(error.message);
    else {
      const rows = data as ReminderTemplate[];
      setTemplates(rows);
      if (rows.length > 0 && !selectedId) setSelectedId(rows[0].id);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(t: ReminderTemplate) {
    setEditingId(t.id);
    setForm({ name: t.name, subject: t.subject, body: t.body });
    setError(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      subject: form.subject.trim(),
      body: form.body,
    };

    const { data, error } = editingId
      ? await supabase.from("reminder_templates").update(payload).eq("id", editingId).select().single()
      : await supabase.from("reminder_templates").insert(payload).select().single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setShowForm(false);
    await loadTemplates();
    if (data) {
      recordEdit((data as ReminderTemplate).id);
      setSelectedId((data as ReminderTemplate).id);
    }
  }

  const enriched = useMemo(
    () =>
      templates.map((t) => ({
        ...t,
        stage: classifyStage(t.name),
        variables: extractVariables(`${t.subject} ${t.body}`),
      })),
    [templates]
  );

  const visible = useMemo(() => {
    let rows = enriched;
    if (stageFilter !== "all") rows = rows.filter((t) => t.stage === stageFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.body.toLowerCase().includes(q)
      );
    }
    if (sortBy === "name") {
      rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      rows = [...rows].sort((a, b) => {
        const aAt = editLog[a.id]?.at ?? "";
        const bAt = editLog[b.id]?.at ?? "";
        return bAt.localeCompare(aAt);
      });
    }
    return rows;
  }, [enriched, stageFilter, search, sortBy, editLog]);

  useEffect(() => {
    if (visible.length === 0) return;
    if (!visible.some((t) => t.id === selectedId)) setSelectedId(visible[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const stagesActive = useMemo(() => new Set(enriched.map((t) => t.stage)).size, [enriched]);

  const cadenceRange = useMemo(() => {
    if (enriched.length === 0) return "—";
    const offsets = enriched.map((t) => STAGES[t.stage].offsetDays);
    const min = Math.min(...offsets);
    const max = Math.max(...offsets);
    const fmt = (d: number) =>
      d < 0 ? `${Math.abs(d)}d before due` : d === 0 ? "on due date" : `${d}d overdue`;
    return min === max ? fmt(min) : `${fmt(min)} → ${fmt(max)}`;
  }, [enriched]);

  const lastUpdated = useMemo(() => {
    const entries = Object.values(editLog);
    if (entries.length === 0) return null;
    return entries.reduce((latest, e) => (e.at > latest.at ? e : latest));
  }, [editLog]);

  const selected = enriched.find((t) => t.id === selectedId) ?? null;

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Reminder Templates" subtitle="Manage the email reminders sent to customers for unpaid and overdue invoices." />
        <NotConfigured />
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink">Reminder Templates</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Manage the email reminders sent to customers for unpaid and overdue invoices.
          </p>
        </div>
        <div className="flex flex-none items-center gap-3">
          <button className="text-sm font-medium text-ink-muted hover:text-brand hover:underline">
            Preview reminder flow
          </button>
          <button
            onClick={openAdd}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
          >
            + New Template
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard icon="📄" label="Total templates" value={String(templates.length)} />
        <SummaryCard icon="🏷️" label="Reminder stages active" value={`${stagesActive} stages`} />
        <SummaryCard icon="⏱️" label="Send cadence" value={cadenceRange} />
        <SummaryCard
          icon="🕒"
          label="Last updated"
          value={lastUpdated ? `${timeAgo(lastUpdated.at)}` : "No edits yet"}
        />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-surface p-3">
        <input
          className={`${inputClass} w-full max-w-xs`}
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={inputClass}
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as "all" | StageKey)}
        >
          <option value="all">All stages</option>
          {(Object.keys(STAGES) as StageKey[]).map((k) => (
            <option key={k} value={k}>
              {STAGES[k].label}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "recent")}
        >
          <option value="name">Sort: Name (A–Z)</option>
          <option value="recent">Sort: Recently updated</option>
        </select>
        <span className="ml-auto text-xs font-medium text-ink-muted">
          {visible.length} of {templates.length} shown
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading templates…</p>
      ) : templates.length === 0 ? (
        <EmptyState onCreate={openAdd} />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* List */}
          <div className="flex flex-col gap-3 xl:col-span-3">
            {visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-muted/40 bg-surface p-8 text-center text-sm text-ink-muted">
                No templates match your filters.
              </div>
            ) : (
              visible.map((t) => {
                const stage = STAGES[t.stage];
                const isSelected = t.id === selectedId;
                const edit = editLog[t.id];
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`text-left rounded-xl border bg-surface p-4 shadow-sm transition-all hover:shadow-md ${
                      isSelected ? "border-brand ring-1 ring-brand" : "border-hairline"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-ink">{t.name}</h3>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${stage.badgeClass}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${stage.dotClass}`} />
                            {stage.label}
                          </span>
                          <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success ring-1 ring-inset ring-success-border">
                            Active
                          </span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-medium text-ink-secondary">{t.subject}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{t.body}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {t.variables.slice(0, 5).map((v) => (
                            <span key={v} className="rounded bg-sidebar px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">
                              {v}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-ink-muted">
                          {edit ? `Updated ${timeAgo(edit.at)} by ${edit.by}` : stage.trigger}
                        </p>
                      </div>
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(t);
                        }}
                        className="flex-none rounded-lg px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/10"
                      >
                        Edit
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Preview panel */}
          <div className="xl:col-span-2">
            <div className="sticky top-8 rounded-xl border border-hairline bg-surface shadow-sm">
              {!selected ? (
                <div className="p-8 text-center text-sm text-ink-muted">
                  Select a template to preview the email.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-hairline/50 px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Preview</p>
                      <h3 className="font-semibold text-ink">{selected.name}</h3>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STAGES[selected.stage].badgeClass}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${STAGES[selected.stage].dotClass}`} />
                      {STAGES[selected.stage].label}
                    </span>
                  </div>

                  <div className="space-y-3 border-b border-hairline/50 px-5 py-4 text-xs text-ink-muted">
                    <div className="flex justify-between">
                      <span>To</span>
                      <span className="font-medium text-ink-secondary">customer@example.com</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Customer</span>
                      <span className="font-medium text-ink-secondary">{MOCK_CONTEXT.customer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Invoice No</span>
                      <span className="font-medium text-ink-secondary">{MOCK_CONTEXT.invoice_no}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Due Date</span>
                      <span className="font-medium text-ink-secondary">{MOCK_CONTEXT.due_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount</span>
                      <span className="font-medium text-ink-secondary">{MOCK_CONTEXT.amount_due}</span>
                    </div>
                  </div>

                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Subject</p>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {highlightVariables(selected.subject)}
                    </p>

                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Body</p>
                    <div className="mt-2 whitespace-pre-line rounded-lg bg-section p-3 text-sm leading-relaxed text-ink-secondary">
                      {highlightVariables(selected.body)}
                    </div>

                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      As the customer will see it
                    </p>
                    <div className="mt-2 whitespace-pre-line rounded-lg border border-hairline p-3 text-sm leading-relaxed text-ink-secondary">
                      {fillTemplate(selected.body)}
                    </div>
                  </div>

                  <div className="border-t border-hairline/50 px-5 py-4">
                    <button
                      onClick={() => openEdit(selected)}
                      className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                    >
                      Edit Template
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-bold text-ink">
              {editingId ? "Edit Template" : "Add Template"}
            </h3>

            <p className="mt-2 text-xs text-ink-muted">
              Use these placeholders anywhere in the subject or body — they get filled in per
              customer when reminders are sent:
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ALL_PLACEHOLDERS.map((p) => (
                <code key={p} className="rounded bg-sidebar px-1.5 py-0.5 text-xs text-ink-secondary">
                  {p}
                </code>
              ))}
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <div className="mt-4 flex flex-col gap-4">
              <FormField label="Name">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Friendly Payment Reminder"
                />
              </FormField>
              <FormField label="Subject">
                <input
                  className={inputClass}
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </FormField>
              <FormField label="Body">
                <textarea
                  className={`${inputClass} min-h-[180px] resize-y font-mono text-xs`}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
              </FormField>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-section"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.subject || !form.body}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SummaryCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
        <span>{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-muted/40 bg-surface px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-2xl">
        ✉️
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink">No reminder templates yet</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">
        Create your first chaser email template to start reminding customers about unpaid and
        overdue invoices.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        + Create first template
      </button>
    </div>
  );
}
