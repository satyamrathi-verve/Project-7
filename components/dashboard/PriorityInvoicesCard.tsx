import { memo } from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/format";
import { DashboardCard } from "./DashboardCard";
import { Icon } from "./Primitives";

export type Priority = "Critical" | "High" | "Medium" | "Low";

export interface PriorityRow {
  invoiceId: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string | null;
  outstanding: number;
  dueDate: string;
  overdueDays: number; // positive = overdue, 0 = due today, negative = days until due
  priority: Priority;
}

const PRIORITY_STYLE: Record<Priority, string> = {
  Critical: "bg-danger-bg text-danger",
  High: "bg-warning-bg text-warning",
  Medium: "bg-info-bg text-info",
  Low: "bg-section text-ink-muted",
};

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1";

function PriorityInvoicesCardImpl({ rows }: { rows: PriorityRow[] }) {
  return (
    <DashboardCard title="Invoices Requiring Attention" subtitle="Overdue or due within 7 days, most urgent first">
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-section/60 px-4 py-8 text-center">
          <span aria-hidden className="text-2xl">
            🎉
          </span>
          <p className="text-sm font-medium text-ink-secondary">Nothing needs attention right now.</p>
          <p className="text-[12px] text-ink-muted">Overdue and soon-due invoices will show up here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-hairline">
          {rows.map((r) => (
            <li key={r.invoiceId} className="flex flex-wrap items-center gap-3 py-3 transition-colors duration-150 hover:bg-ink/[0.012]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/invoices/${r.invoiceId}`}
                    className={`rounded font-medium text-ink hover:text-brand hover:underline ${FOCUS_RING}`}
                  >
                    {r.invoiceNo}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLE[r.priority]}`}>
                    {r.priority}
                  </span>
                </div>
                <p className="truncate text-[13px] text-ink-muted">{r.customerName}</p>
              </div>

              <div className="text-right">
                <p className="font-semibold tabular-nums text-ink">{formatMoney(r.outstanding)}</p>
                <p className={`text-[12px] ${r.overdueDays > 0 ? "text-danger" : "text-ink-muted"}`}>
                  {r.overdueDays > 0
                    ? `${r.overdueDays}d overdue`
                    : r.overdueDays === 0
                      ? "Due today"
                      : `Due in ${Math.abs(r.overdueDays)}d`}{" "}
                  · {formatDate(r.dueDate)}
                </p>
              </div>

              <div className="flex flex-none items-center gap-1">
                <Link
                  href={`/invoices/${r.invoiceId}`}
                  aria-label={`View invoice ${r.invoiceNo}`}
                  title="View invoice"
                  className={`rounded-lg p-2 text-ink-muted transition-colors duration-150 hover:bg-ink/[0.05] hover:text-ink ${FOCUS_RING}`}
                >
                  <Icon>👁️</Icon>
                </Link>
                <Link
                  href={`/invoices/${r.invoiceId}`}
                  aria-label={`Send reminder for ${r.invoiceNo}`}
                  title="Send reminder"
                  className={`rounded-lg p-2 text-ink-muted transition-colors duration-150 hover:bg-ink/[0.05] hover:text-ink ${FOCUS_RING}`}
                >
                  <Icon>📨</Icon>
                </Link>
                <Link
                  href="/receipts"
                  aria-label={`Record payment for ${r.invoiceNo}`}
                  title="Record payment"
                  className={`rounded-lg p-2 text-ink-muted transition-colors duration-150 hover:bg-ink/[0.05] hover:text-ink ${FOCUS_RING}`}
                >
                  <Icon>💵</Icon>
                </Link>
                {r.customerPhone && (
                  <a
                    href={`tel:${r.customerPhone}`}
                    aria-label={`Call ${r.customerName} at ${r.customerPhone}`}
                    title={`Call ${r.customerPhone}`}
                    className={`rounded-lg p-2 text-ink-muted transition-colors duration-150 hover:bg-ink/[0.05] hover:text-ink ${FOCUS_RING}`}
                  >
                    <Icon>📞</Icon>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

export const PriorityInvoicesCard = memo(PriorityInvoicesCardImpl);
