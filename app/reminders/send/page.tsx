import { PageHeader } from "@/components/PageHeader";

export default function ReminderSendPage() {
  return (
    <>
      <PageHeader title="Auto Email Shoot" subtitle="Send reminder emails for overdue invoices." />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">This screen is ready for the reminder shoot workflow.</p>
      </div>
    </>
  );
}
