import { memo } from "react";
import { formatMoney, formatDateTime } from "@/lib/format";
import { DashboardCard } from "./DashboardCard";

export interface ActivityEvent {
  at: string;
  icon: string;
  iconClass: string;
  title: string;
  detail: string;
}

/** Recent payments received + reminders sent, merged into one real activity feed. */
function ActivityFeedCardImpl({ events }: { events: ActivityEvent[] }) {
  return (
    <DashboardCard title="Recent Activity" subtitle="Payments received and reminders sent">
      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-section/60 px-4 py-8 text-center">
          <span aria-hidden className="text-2xl">
            🗓️
          </span>
          <p className="text-sm font-medium text-ink-secondary">Nothing has happened yet.</p>
          <p className="text-[12px] text-ink-muted">Payments and reminders will appear here as they happen.</p>
        </div>
      ) : (
        <ol className="relative ml-3.5 border-l-2 border-hairline">
          {events.map((e, i) => (
            <li key={i} className="group relative mb-5 rounded-r-lg pb-0.5 pl-5 pr-2 transition-colors duration-150 last:mb-0 hover:bg-black/[0.015]">
              <span
                className={`absolute -left-[15px] top-0 flex h-7 w-7 items-center justify-center rounded-full text-sm ring-4 ring-surface transition-transform duration-200 group-hover:scale-110 ${e.iconClass}`}
              >
                {e.icon}
              </span>
              <p className="text-[13px] font-semibold text-ink">{e.title}</p>
              <p className="text-[13px] text-ink-muted">{e.detail}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted/70">{formatDateTime(e.at)}</p>
            </li>
          ))}
        </ol>
      )}
    </DashboardCard>
  );
}

export const ActivityFeedCard = memo(ActivityFeedCardImpl);

export function buildActivityEvents(params: {
  receipts: { receipt_date: string; amount: number; mode: string; customerName: string }[];
  reminders: { sent_at: string; subject: string | null; to_email: string | null; status: string }[];
  limit?: number;
}): ActivityEvent[] {
  const { receipts, reminders, limit = 8 } = params;

  const events: ActivityEvent[] = [
    ...receipts.map((r) => ({
      at: r.receipt_date,
      icon: "💵",
      iconClass: "bg-success-bg text-success",
      title: "Payment Received",
      detail: `${formatMoney(r.amount)} from ${r.customerName} via ${r.mode.toUpperCase()}`,
    })),
    ...reminders.map((r) => ({
      at: r.sent_at,
      icon: "📨",
      iconClass: "bg-warning-bg text-warning",
      title: r.status === "sent" ? "Reminder Sent" : "Reminder Failed",
      detail: r.subject ? `"${r.subject}" to ${r.to_email ?? "customer"}` : "Reminder email sent.",
    })),
  ];

  return events.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}
