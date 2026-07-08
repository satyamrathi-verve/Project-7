import { PageHeader } from "@/components/PageHeader";

export default function CashflowPage() {
  return (
    <>
      <PageHeader title="Cashflow Projection" subtitle="Forward-looking collection forecast." />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">This screen is ready for the projection view.</p>
      </div>
    </>
  );
}
