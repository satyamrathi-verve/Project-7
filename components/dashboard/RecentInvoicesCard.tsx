import { memo } from "react";
import Link from "next/link";
import type { InvoiceStatus } from "@/lib/types";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/statusStyles";
import { DataTable, type Column } from "@/components/DataTable";
import { formatMoney, formatDate } from "@/lib/format";
import { DashboardCard } from "./DashboardCard";

export interface RecentInvoiceRow {
  id: string;
  invoiceNo: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  paid: number;
  outstanding: number;
  effectiveStatus: InvoiceStatus;
}

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1";

function RecentInvoicesCardImpl({ rows }: { rows: RecentInvoiceRow[] }) {
  const columns: Column<RecentInvoiceRow>[] = [
    {
      key: "invoiceNo",
      header: "Invoice #",
      render: (r) => (
        <Link href={`/invoices/${r.id}`} className={`rounded font-medium text-brand hover:underline ${FOCUS_RING}`}>
          {r.invoiceNo}
        </Link>
      ),
    },
    { key: "customerName", header: "Customer" },
    { key: "invoiceDate", header: "Date", render: (r) => formatDate(r.invoiceDate) },
    { key: "dueDate", header: "Due", render: (r) => formatDate(r.dueDate) },
    { key: "total", header: "Amount", className: "text-right", render: (r) => formatMoney(r.total) },
    { key: "paid", header: "Paid", className: "text-right", render: (r) => formatMoney(r.paid) },
    {
      key: "outstanding",
      header: "Outstanding",
      className: "text-right",
      render: (r) => <span className={r.outstanding > 0 ? "font-medium text-ink" : "text-ink-muted"}>{formatMoney(r.outstanding)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[r.effectiveStatus]}`}>
          {STATUS_LABEL[r.effectiveStatus]}
        </span>
      ),
    },
  ];

  return (
    <DashboardCard
      title="Recent Invoices"
      subtitle="The 10 most recently raised invoices"
      action={
        <Link href="/invoices" className={`rounded text-sm font-medium text-brand hover:underline ${FOCUS_RING}`}>
          View all →
        </Link>
      }
    >
      <DataTable columns={columns} rows={rows} empty="No invoices yet." />
    </DashboardCard>
  );
}

export const RecentInvoicesCard = memo(RecentInvoicesCardImpl);
