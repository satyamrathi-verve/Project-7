import type { ReminderLog } from "@/lib/types";
import { formatMoney, formatDateTime } from "@/lib/format";
import { Card, CardTitle } from "./Primitives";
import type { AllocationWithReceipt } from "@/lib/collectionHealth";

type TimelineEvent = {
  at: string;
  icon: string;
  iconClass: string;
  title: string;
  detail: string;
};

export function PaymentTimeline({
  invoiceCreatedAt,
  allocations,
  reminders,
}: {
  invoiceCreatedAt: string;
  allocations: AllocationWithReceipt[];
  reminders: ReminderLog[];
}) {
  const events: TimelineEvent[] = [
    {
      at: invoiceCreatedAt,
      icon: "🧾",
      iconClass: "bg-blue-50 text-blue-600 ring-blue-100",
      title: "Invoice Created",
      detail: "Invoice raised in the system.",
    },
    ...allocations.map((a) => ({
      at: a.receipts?.receipt_date ?? invoiceCreatedAt,
      icon: "💵",
      iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100",
      title: "Payment Received",
      detail: `${formatMoney(a.amount)} received via ${a.receipts?.mode?.toUpperCase() ?? "—"}.`,
    })),
    ...reminders.map((r) => ({
      at: r.sent_at,
      icon: "📧",
      iconClass: "bg-amber-50 text-amber-600 ring-amber-100",
      title: "Reminder Sent",
      detail: r.subject ? `"${r.subject}" sent to ${r.to_email ?? "customer"}.` : "Reminder email sent.",
    })),
  ].sort((a, b) => (a.at < b.at ? -1 : 1));

  return (
    <Card>
      <CardTitle icon={<span aria-hidden>🕘</span>} subtitle="Every touchpoint on this invoice, oldest to newest">
        Payment History
      </CardTitle>
      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50/70 px-4 py-8 text-center">
          <span aria-hidden className="text-2xl opacity-60">
            🗓️
          </span>
          <p className="text-sm font-medium text-slate-500">No payments have been recorded yet.</p>
          <p className="text-xs text-slate-400">Once a payment is received it will appear here.</p>
        </div>
      ) : (
        <ol className="relative ml-3.5 border-l-2 border-slate-100">
          {events.map((e, i) => (
            <li
              key={i}
              className="group relative mb-6 rounded-r-lg pb-0.5 pl-6 pr-2 transition-colors duration-200 last:mb-0 hover:bg-slate-50/70"
            >
              <span
                className={`absolute -left-[15px] top-0 flex h-7 w-7 items-center justify-center rounded-full text-sm ring-4 ring-white transition-transform duration-200 group-hover:scale-110 ${e.iconClass}`}
              >
                {e.icon}
              </span>
              <p className="text-sm font-semibold text-slate-800">{e.title}</p>
              <p className="text-sm text-slate-500">{e.detail}</p>
              <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(e.at)}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
