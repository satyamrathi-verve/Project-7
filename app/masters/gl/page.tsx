import { PageHeader } from "@/components/PageHeader";

export default function GLMasterPage() {
  return (
    <>
      <PageHeader title="GL Master" subtitle="Reference accounts for the AR workflow." />
      <div className="rounded-xl border border-hairline bg-surface p-6 shadow-sm">
        <p className="text-sm text-ink-secondary">This screen is ready for the GL account list.</p>
      </div>
    </>
  );
}
