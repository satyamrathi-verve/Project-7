"use client";

import { useEffect, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { ReminderTemplate } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { DataTable, type Column } from "@/components/DataTable";
import { FormField, inputClass } from "@/components/FormField";

type FormState = { name: string; subject: string; body: string };

const EMPTY_FORM: FormState = { name: "", subject: "", body: "" };

const PLACEHOLDERS = ["{customer}", "{amount}", "{days_overdue}", "{invoice_no}"];

export default function ReminderTemplatePage() {
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTemplates() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reminder_templates")
      .select("*")
      .order("name", { ascending: true });
    if (error) setError(error.message);
    else setTemplates(data as ReminderTemplate[]);
    setLoading(false);
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(t: ReminderTemplate) {
    setEditingId(t.id);
    setForm({ name: t.name, subject: t.subject, body: t.body });
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

    const { error } = editingId
      ? await supabase.from("reminder_templates").update(payload).eq("id", editingId)
      : await supabase.from("reminder_templates").insert(payload);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setShowForm(false);
    await loadTemplates();
  }

  const columns: Column<ReminderTemplate>[] = [
    { key: "name", header: "Name" },
    { key: "subject", header: "Subject" },
    {
      key: "body",
      header: "Body preview",
      render: (t) => (
        <span className="line-clamp-1 text-slate-500">{t.body.slice(0, 60)}…</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (t) => (
        <button
          onClick={() => openEdit(t)}
          className="text-sm font-medium text-brand hover:underline"
        >
          Edit
        </button>
      ),
    },
  ];

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Reminder Template" subtitle="The chaser email you send overdue customers." />
        <NotConfigured />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Reminder Template"
        subtitle="The chaser email you send overdue customers."
        action={
          <button
            onClick={openAdd}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            + Add Template
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-slate-400">Loading templates…</p>
      ) : (
        <DataTable columns={columns} rows={templates} empty="No templates yet. Add one to get started." />
      )}

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {editingId ? "Edit Template" : "Add Template"}
            </h3>

            <p className="mt-2 text-xs text-slate-500">
              Use these placeholders anywhere in the subject or body — they get filled in per
              customer when reminders are sent:{" "}
              {PLACEHOLDERS.map((p) => (
                <code key={p} className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-slate-700">
                  {p}
                </code>
              ))}
            </p>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="mt-4 flex flex-col gap-4">
              <FormField label="Name">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
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
