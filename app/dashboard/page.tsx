import { PageHeader } from "@/components/PageHeader";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of AR health and activity." />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">This screen is ready for the overview dashboard.</p>
      </div>
    </>
  );
}
