import { formatMoney, formatDateTime } from "@/lib/format";

export interface ActivityEvent {
  at: string;
  icon: string;
  iconClass: string;
  title: string;
  detail: string;
}

/** Recent payments received + reminders sent, merged into one real activity feed. */
export function ActivityFeedCard({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
      <h3 className="text-lg font-semibold text-ink">Recent Activity</h3>
      <p className="text-[13px] text-ink-muted">Payments received and reminders sent</p>

      {events.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
          <span aria-hidden>🗓️</span>
          Nothing has happened yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {events.map((e, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm ${e.iconClass}`}>
                {e.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">{e.title}</p>
                <p className="text-[13px] text-ink-muted">{e.detail}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted/70">{formatDateTime(e.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
