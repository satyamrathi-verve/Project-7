import Link from "next/link";
import type { InvoiceStatus } from "@/lib/types";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/statusStyles";
import { DataTable, type Column } from "@/components/DataTable";
import { formatMoney, formatDate } from "@/lib/format";

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

export function RecentInvoicesCard({ rows }: { rows: RecentInvoiceRow[] }) {
  const columns: Column<RecentInvoiceRow>[] = [
    {
      key: "invoiceNo",
      header: "Invoice #",
      render: (r) => (
        <Link href={`/invoices/${r.id}`} className="font-medium text-brand hover:underline">
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
    <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">Recent Invoices</h3>
          <p className="text-[13px] text-ink-muted">The 10 most recently raised invoices</p>
        </div>
        <Link href="/invoices" className="text-sm font-medium text-brand hover:underline">
          View all →
        </Link>
      </div>
      <DataTable columns={columns} rows={rows} empty="No invoices yet." />
    </div>
  );
}
