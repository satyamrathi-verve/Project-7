import { PageHeader } from "@/components/PageHeader";

export default function CashflowPage() {
  return (
    <>
      <PageHeader title="Cashflow Projection" subtitle="Forward-looking collection forecast." />
      <div className="rounded-xl border border-hairline bg-surface p-6 shadow-sm">
        <p className="text-sm text-ink-secondary">This screen is ready for the projection view.</p>
      </div>
    </>
  );
}
