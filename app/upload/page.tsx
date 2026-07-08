import { PageHeader } from "@/components/PageHeader";

export default function UploadPage() {
  return (
    <>
      <PageHeader title="Upload Report" subtitle="Bulk import screen for CSV data." />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">This screen is ready for CSV upload and preview.</p>
      </div>
    </>
  );
}
