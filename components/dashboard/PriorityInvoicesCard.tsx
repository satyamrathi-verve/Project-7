import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/format";

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

export function PriorityInvoicesCard({ rows }: { rows: PriorityRow[] }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
      <h3 className="text-lg font-semibold text-ink">Invoices Requiring Attention</h3>
      <p className="text-[13px] text-ink-muted">Overdue or due within 7 days, most urgent first</p>

      {rows.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
          <span aria-hidden>🎉</span>
          Nothing needs attention right now.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-hairline">
          {rows.map((r) => (
            <li key={r.invoiceId} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/invoices/${r.invoiceId}`} className="font-medium text-ink hover:text-brand hover:underline">
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

              <div className="flex flex-none items-center gap-1.5">
                <Link
                  href={`/invoices/${r.invoiceId}`}
                  title="View invoice"
                  className="rounded-lg px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 hover:bg-black/[0.04] hover:text-ink"
                >
                  👁️
                </Link>
                <Link
                  href={`/invoices/${r.invoiceId}`}
                  title="Send reminder"
                  className="rounded-lg px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 hover:bg-black/[0.04] hover:text-ink"
                >
                  📨
                </Link>
                <Link
                  href="/receipts"
                  title="Record payment"
                  className="rounded-lg px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 hover:bg-black/[0.04] hover:text-ink"
                >
                  💵
                </Link>
                {r.customerPhone && (
                  <a
                    href={`tel:${r.customerPhone}`}
                    title={`Call ${r.customerPhone}`}
                    className="rounded-lg px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 hover:bg-black/[0.04] hover:text-ink"
                  >
                    📞
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
