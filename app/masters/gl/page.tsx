import { PageHeader } from "@/components/PageHeader";

export default function GLMasterPage() {
  return (
    <>
      <PageHeader title="GL Master" subtitle="Reference accounts for the AR workflow." />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">This screen is ready for the GL account list.</p>
      </div>
    </>
  );
}
