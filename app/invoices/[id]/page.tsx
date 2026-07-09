"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import type { Company, Customer, Invoice, InvoiceItem, Receipt, ReminderLog } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { NotConfigured } from "@/components/NotConfigured";
import { StatCard } from "@/components/StatCard";
import { EmailInvoiceModal } from "@/components/EmailInvoiceModal";
import { computeCollectionAnalytics, type AllocationWithReceipt } from "@/lib/collectionHealth";
import { formatMoney, formatDate } from "@/lib/format";
import { InvoiceHeroHeader } from "@/components/invoice/InvoiceHeroHeader";
import { StickySummaryBar } from "@/components/invoice/StickySummaryBar";
import { CollectionHealthCard } from "@/components/invoice/CollectionHealthCard";
import { BilledCard } from "@/components/invoice/BilledCard";
import { InvoiceInfoCard } from "@/components/invoice/InvoiceInfoCard";
import { CustomerSnapshotCard } from "@/components/invoice/CustomerSnapshotCard";
import { InsightsCard } from "@/components/invoice/InsightsCard";
import { LineItemsCard } from "@/components/invoice/LineItemsCard";
import { PaymentTimeline } from "@/components/invoice/PaymentTimeline";
import { NotesCard } from "@/components/invoice/NotesCard";
import { SkeletonBlock } from "@/components/invoice/Primitives";

interface ViewData {
  invoice: Invoice;
  customer: Customer;
  company: Company | null;
  items: InvoiceItem[];
  thisInvoiceAllocations: AllocationWithReceipt[];
  customerInvoices: Invoice[];
  allocationsByInvoiceId: Map<string, AllocationWithReceipt[]>;
  customerReceipts: Receipt[];
  reminders: ReminderLog[];
}

export default function InvoiceViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  async function load() {
    if (!supabase || !params?.id) return;
    setLoading(true);
    setError(null);

    const { data: invoice, error: invErr } = await supabase.from("invoices").select("*").eq("id", params.id).single();

    if (invErr || !invoice) {
      setError(invErr?.message ?? "Invoice not found.");
      setLoading(false);
      return;
    }

    const [{ data: items }, { data: customer }, { data: thisInvoiceAllocations }, { data: customerInvoices }, { data: companyRows }] =
      await Promise.all([
        supabase.from("invoice_items").select("*").eq("invoice_id", invoice.id).order("id"),
        supabase.from("customers").select("*").eq("id", invoice.customer_id).single(),
        supabase.from("receipt_allocations").select("*, receipts(receipt_date, mode)").eq("invoice_id", invoice.id),
        supabase.from("invoices").select("*").eq("customer_id", invoice.customer_id),
        supabase.from("company").select("*").limit(1),
      ]);

    if (!customer) {
      setError("Customer for this invoice could not be found.");
      setLoading(false);
      return;
    }

    const customerInvoiceIds = (customerInvoices ?? []).map((i) => i.id);

    const [{ data: allAllocations }, { data: customerReceipts }, { data: reminders }] = await Promise.all([
      customerInvoiceIds.length
        ? supabase.from("receipt_allocations").select("*, receipts(receipt_date, mode)").in("invoice_id", customerInvoiceIds)
        : Promise.resolve({ data: [] as AllocationWithReceipt[] }),
      supabase.from("receipts").select("*").eq("customer_id", invoice.customer_id),
      supabase.from("reminder_log").select("*").eq("invoice_id", invoice.id).order("sent_at", { ascending: true }),
    ]);

    const allocationsByInvoiceId = new Map<string, AllocationWithReceipt[]>();
    for (const alloc of (allAllocations ?? []) as AllocationWithReceipt[]) {
      const list = allocationsByInvoiceId.get(alloc.invoice_id) ?? [];
      list.push(alloc);
      allocationsByInvoiceId.set(alloc.invoice_id, list);
    }

    setData({
      invoice,
      customer,
      company: companyRows?.[0] ?? null,
      items: items ?? [],
      thisInvoiceAllocations: (thisInvoiceAllocations ?? []) as AllocationWithReceipt[],
      customerInvoices: customerInvoices ?? [],
      allocationsByInvoiceId,
      customerReceipts: customerReceipts ?? [],
      reminders: reminders ?? [],
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id]);

  if (!isConfigured) {
    return (
      <>
        <PageHeader title="Invoice" subtitle="View the full details of a sales invoice." />
        <NotConfigured />
      </>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock className="h-52" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
        <SkeletonBlock className="h-32" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <SkeletonBlock className="h-96" />
          <SkeletonBlock className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-danger-border bg-danger-bg p-6 text-danger">
        <p className="font-semibold">Couldn&apos;t load this invoice.</p>
        <p className="mt-1 text-sm">{error}</p>
        <button
          onClick={() => router.push("/invoices")}
          className="mt-4 rounded-[10px] bg-surface px-3 py-1.5 text-sm font-medium text-danger ring-1 ring-inset ring-danger-border transition-colors duration-200 hover:bg-danger-bg"
        >
          Back to invoices
        </button>
      </div>
    );
  }

  const { invoice, customer, company, items, thisInvoiceAllocations, customerInvoices, allocationsByInvoiceId, customerReceipts, reminders } =
    data;

  const analytics = computeCollectionAnalytics({
    invoice,
    customer,
    todayISO: new Date().toISOString(),
    thisInvoiceAllocations,
    customerInvoices,
    allocationsByInvoiceId,
    customerReceipts,
    reminders,
  });

  return (
    <div className="pb-16">
      <StickySummaryBar
        sentinelId="invoice-hero-sentinel"
        invoice={invoice}
        outstanding={analytics.outstanding}
        onRecordPayment={() => router.push("/receipts")}
        onSendReminder={() => setShowEmail(true)}
      />

      <InvoiceHeroHeader
        invoice={invoice}
        customer={customer}
        outstanding={analytics.outstanding}
        isOverdue={analytics.isOverdue}
        dueInDays={analytics.dueInDays}
        onRecordPayment={() => router.push("/receipts")}
        onSendReminder={() => setShowEmail(true)}
        sentinelId="invoice-hero-sentinel"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon="🧾"
          label="Invoice Total"
          value={formatMoney(invoice.total)}
          accent="blue"
          countTo={invoice.total}
          formatValue={formatMoney}
          insight={`Raised on ${formatDate(invoice.invoice_date)}`}
        />
        <StatCard
          icon="💵"
          label="Amount Paid"
          value={formatMoney(analytics.amountPaid)}
          accent="green"
          countTo={analytics.amountPaid}
          formatValue={formatMoney}
          insight={`${Math.round(analytics.percentPaid)}% received`}
        />
        <StatCard
          icon="💰"
          label="Outstanding"
          value={formatMoney(analytics.outstanding)}
          accent={analytics.isOverdue ? "red" : analytics.outstanding === 0 ? "green" : "orange"}
          countTo={analytics.outstanding}
          formatValue={formatMoney}
          insight={`${Math.max(0, 100 - Math.round(analytics.percentPaid))}% pending`}
        />
        <StatCard
          icon={analytics.isOverdue ? "⚠️" : "⏰"}
          label={analytics.isOverdue ? "Overdue" : analytics.outstanding === 0 ? "Settled" : "Due In"}
          value={
            analytics.outstanding === 0
              ? "Paid"
              : analytics.isOverdue
                ? `${Math.abs(analytics.dueInDays)} Days`
                : `${analytics.dueInDays} Days`
          }
          accent={analytics.isOverdue ? "red" : analytics.dueInDays <= 7 ? "orange" : "green"}
          insight={`Due ${formatDate(invoice.due_date)}`}
        />
        <CollectionHealthCard score={analytics.healthScore} label={analytics.healthLabel} />
      </div>

      <div className="mb-6">
        <BilledCard company={company} customer={customer} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <InvoiceInfoCard invoice={invoice} customer={customer} />
          <LineItemsCard items={items} subtotal={invoice.subtotal} taxAmount={invoice.tax_amount} total={invoice.total} />
        </div>
        <div className="space-y-6">
          <CustomerSnapshotCard
            customer={customer}
            a={analytics}
            customerInvoices={customerInvoices}
            allocationsByInvoiceId={allocationsByInvoiceId}
          />
          <InsightsCard a={analytics} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PaymentTimeline invoiceCreatedAt={invoice.created_at} allocations={thisInvoiceAllocations} reminders={reminders} />
        <NotesCard notes={invoice.notes} />
      </div>

      {showEmail && <EmailInvoiceModal invoice={invoice} company={company} customer={customer} onClose={() => setShowEmail(false)} />}
    </div>
  );
}
