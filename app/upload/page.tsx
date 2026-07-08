import { PageHeader } from "@/components/PageHeader";
import { ImportWizard } from "@/components/import/ImportWizard";

export default function UploadReportPage() {
  return (
    <>
      <PageHeader
        title="Upload Report"
        subtitle="Bulk-import customers or invoices from a CSV file — mapped, validated, and reviewed before anything is written."
      />
      <ImportWizard />
    </>
  );
}
