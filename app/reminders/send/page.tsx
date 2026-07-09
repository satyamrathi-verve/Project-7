"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Invoice, Customer, ReminderTemplate, ReminderLog } from "@/lib/types";
import { NotConfigured } from "@/components/NotConfigured";

interface OverdueInvoice extends Invoice {
  customer: Customer;
  outstanding: number;
  days_overdue: number;
}

interface EmailPreview {
  invoice: OverdueInvoice;
  to_email: string;
  subject: string;
  body: string;
  selected: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fillTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z_]+)\}/g, (match, key) => context[key] ?? match);
}

export default function AutoEmailShootPage() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [emailPreviews, setEmailPreviews] = useState<EmailPreview[]>([]);
  const [recentLogs, setRecentLogs] = useState<(ReminderLog & { invoice?: Invoice; customer?: Customer })[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  async function loadData() {
    if (!supabase) return;
    setLoading(true);

    const today = new Date().toISOString().split("T")[0];

    // Fetch overdue invoices (open or partial, due_date < today)
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*")
      .in("status", ["open", "partial"])
      .lt("due_date", today)
      .order("due_date", { ascending: true });

    // Fetch customers
    const { data: customers } = await supabase.from("customers").select("*");

    // Fetch receipt allocations to calculate outstanding
    const { data: allocations } = await supabase.from("receipt_allocations").select("*");

    // Fetch templates
    const { data: tpls } = await supabase
      .from("reminder_templates")
      .select("*")
      .order("name", { ascending: true });

    // Fetch recent reminder logs
    const { data: logs } = await supabase
      .from("reminder_log")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(20);

    const customerMap = new Map((customers ?? []).map((c: Customer) => [c.id, c]));
    const allocationMap = new Map<string, number>();
    (allocations ?? []).forEach((a: { invoice_id: string; amount: number }) => {
      allocationMap.set(a.invoice_id, (allocationMap.get(a.invoice_id) ?? 0) + a.amount);
    });

    const overdueList: OverdueInvoice[] = (invoices ?? [])
      .map((inv: Invoice) => {
        const customer = customerMap.get(inv.customer_id);
        if (!customer) return null;
        const allocated = allocationMap.get(inv.id) ?? 0;
        const outstanding = inv.total - allocated;
        const dueDate = new Date(inv.due_date);
        const todayDate = new Date(today);
        const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          ...inv,
          customer,
          outstanding,
          days_overdue: daysOverdue,
        };
      })
      .filter((x): x is OverdueInvoice => x !== null && x.outstanding > 0);

    // Enrich logs with invoice/customer info
    const invoiceMap = new Map((invoices ?? []).map((i: Invoice) => [i.id, i]));
    const enrichedLogs = (logs ?? []).map((log: ReminderLog) => ({
      ...log,
      invoice: log.invoice_id ? invoiceMap.get(log.invoice_id) : undefined,
      customer: log.invoice_id ? customerMap.get(invoiceMap.get(log.invoice_id)?.customer_id ?? "") : undefined,
    }));

    setOverdueInvoices(overdueList);
    setTemplates(tpls ?? []);
    setRecentLogs(enrichedLogs);
    if (tpls && tpls.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(tpls[0].id);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate email previews when template or invoices change
  useEffect(() => {
    if (!selectedTemplate || overdueInvoices.length === 0) {
      setEmailPreviews([]);
      return;
    }

    const previews: EmailPreview[] = overdueInvoices.map((inv) => {
      const context: Record<string, string> = {
        customer: inv.customer.name,
        invoice_no: inv.invoice_no,
        invoice_date: formatDate(inv.invoice_date),
        due_date: formatDate(inv.due_date),
        amount: formatCurrency(inv.outstanding),
        amount_due: formatCurrency(inv.outstanding),
        days_overdue: String(inv.days_overdue),
        company_name: "Verve Advisory",
        payment_link: `https://pay.verve.com/${inv.invoice_no.toLowerCase()}`,
      };

      return {
        invoice: inv,
        to_email: inv.customer.email ?? `${inv.customer.code.toLowerCase()}@example.com`,
        subject: fillTemplate(selectedTemplate.subject, context),
        body: fillTemplate(selectedTemplate.body, context),
        selected: true,
      };
    });

    setEmailPreviews(previews);
  }, [selectedTemplate, overdueInvoices]);

  function toggleSelect(index: number) {
    setEmailPreviews((prev) =>
      prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p))
    );
  }

  function toggleAll(selected: boolean) {
    setEmailPreviews((prev) => prev.map((p) => ({ ...p, selected })));
  }

  const selectedCount = emailPreviews.filter((p) => p.selected).length;

  async function handleSendAll() {
    if (!supabase || selectedCount === 0) return;
    setSending(true);

    const toSend = emailPreviews.filter((p) => p.selected);
    const now = new Date().toISOString();

    const rows = toSend.map((p) => ({
      invoice_id: p.invoice.id,
      to_email: p.to_email,
      subject: p.subject,
      body: p.body,
      status: "sent",
      sent_at: now,
    }));

    const { error } = await supabase.from("reminder_log").insert(rows);

    if (!error) {
      setSentCount(toSend.length);
      setShowSuccess(true);
      await loadData();
      setTimeout(() => setShowSuccess(false), 5000);
    }

    setSending(false);
  }

  const stats = useMemo(() => {
    const totalOutstanding = overdueInvoices.reduce((sum, inv) => sum + inv.outstanding, 0);
    const uniqueCustomers = new Set(overdueInvoices.map((inv) => inv.customer_id)).size;
    const avgDaysOverdue = overdueInvoices.length > 0
      ? Math.round(overdueInvoices.reduce((sum, inv) => sum + inv.days_overdue, 0) / overdueInvoices.length)
      : 0;
    return { totalOutstanding, uniqueCustomers, avgDaysOverdue };
  }, [overdueInvoices]);

  if (!isConfigured) {
    return (
      <>
        <Header />
        <NotConfigured />
      </>
    );
  }

  return (
    <>
      <Header />

      {/* Success banner */}
      {showSuccess && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-emerald-800">Reminders sent successfully!</p>
            <p className="text-sm text-emerald-600">{sentCount} email(s) have been queued for delivery.</p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon="📧"
          label="Overdue Invoices"
          value={String(overdueInvoices.length)}
          color="red"
        />
        <StatCard
          icon="👥"
          label="Customers to Chase"
          value={String(stats.uniqueCustomers)}
          color="amber"
        />
        <StatCard
          icon="💰"
          label="Total Outstanding"
          value={formatCurrency(stats.totalOutstanding)}
          color="blue"
        />
        <StatCard
          icon="⏱️"
          label="Avg. Days Overdue"
          value={`${stats.avgDaysOverdue} days`}
          color="slate"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent"></div>
        </div>
      ) : overdueInvoices.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Left: Email list */}
          <div className="xl:col-span-2 space-y-4">
            {/* Template selector + actions */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Email Template
                </label>
                <select
                  value={selectedTemplateId ?? ""}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleAll(true)}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Select All
                </button>
                <button
                  onClick={() => toggleAll(false)}
                  className="text-sm font-medium text-slate-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
              <button
                onClick={handleSendAll}
                disabled={sending || selectedCount === 0}
                className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {sending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send {selectedCount} Email{selectedCount !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>

            {/* Email cards */}
            <div className="space-y-3">
              {emailPreviews.map((preview, idx) => (
                <EmailCard
                  key={preview.invoice.id}
                  preview={preview}
                  onToggle={() => toggleSelect(idx)}
                />
              ))}
            </div>
          </div>

          {/* Right: Recent activity */}
          <div className="xl:col-span-1">
            <div className="sticky top-8 rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-semibold text-slate-900">Recent Reminders</h3>
                <p className="text-xs text-slate-500 mt-0.5">Last 20 emails sent</p>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {recentLogs.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">
                    No reminders sent yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentLogs.map((log) => (
                      <div key={log.id} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {log.to_email}
                            </p>
                            <p className="truncate text-xs text-slate-500 mt-0.5">
                              {log.subject}
                            </p>
                          </div>
                          <span className="flex-none inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {log.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(log.sent_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-slate-900">Auto Email Shoot</h2>
      <p className="mt-1 text-sm text-slate-500">
        Send reminder emails to customers with overdue invoices. Select a template, review the emails, and send in bulk.
      </p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: "red" | "amber" | "blue" | "slate";
}) {
  const colorClasses = {
    red: "bg-red-50 border-red-100",
    amber: "bg-amber-50 border-amber-100",
    blue: "bg-blue-50 border-blue-100",
    slate: "bg-slate-50 border-slate-100",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <span>{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function EmailCard({
  preview,
  onToggle,
}: {
  preview: EmailPreview;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl border bg-white p-4 transition-all ${
        preview.selected
          ? "border-brand ring-1 ring-brand/20 shadow-sm"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`mt-1 flex h-5 w-5 flex-none items-center justify-center rounded border-2 transition-colors ${
            preview.selected
              ? "border-brand bg-brand text-white"
              : "border-slate-300 bg-white"
          }`}
        >
          {preview.selected && (
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-900">{preview.invoice.customer.name}</h4>
              <p className="text-sm text-slate-500">{preview.to_email}</p>
            </div>
            <div className="text-right flex-none">
              <p className="font-bold text-red-600">{formatCurrency(preview.invoice.outstanding)}</p>
              <p className="text-xs text-red-500">{preview.invoice.days_overdue} days overdue</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-600">
              {preview.invoice.invoice_no}
            </span>
            <span className="text-slate-400">Due: {formatDate(preview.invoice.due_date)}</span>
          </div>

          {/* Subject preview */}
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</p>
            <p className="text-sm text-slate-800 mt-0.5">{preview.subject}</p>
          </div>

          {/* Expandable body */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs font-medium text-brand hover:underline flex items-center gap-1"
          >
            {expanded ? "Hide" : "Preview"} email body
            <svg
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
              <p className="whitespace-pre-line text-sm text-slate-700 leading-relaxed">
                {preview.body}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
        🎉
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">All caught up!</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        No overdue invoices found. All your customers are paying on time.
      </p>
    </div>
  );
}
