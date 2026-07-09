import type { Customer, Invoice } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/statusStyles";
import { Card, CardTitle, Icon } from "./Primitives";

function InfoRow({ icon, label, value, muted = false }: { icon: string; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="mt-0.5 text-slate-400">{icon}</Icon>
      <div className="min-w-0">
        <p className="text-[12px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className={`text-[15px] font-semibold ${muted ? "text-slate-400" : "text-slate-800"}`}>{value}</p>
      </div>
    </div>
  );
}

export function InvoiceInfoCard({ invoice, customer }: { invoice: Invoice; customer: Customer }) {
  return (
    <Card>
      <CardTitle icon={<span aria-hidden>📄</span>} subtitle="Complete invoice information">
        Invoice Details
      </CardTitle>
      <div className="grid grid-cols-1 gap-x-6 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
        <InfoRow icon="#️⃣" label="Invoice Number" value={invoice.invoice_no} />
        <InfoRow icon="🏷️" label="Status" value={STATUS_LABEL[invoice.status]} />
        <InfoRow icon="📅" label="Invoice Date" value={formatDate(invoice.invoice_date)} />
        <InfoRow icon="📅" label="Due Date" value={formatDate(invoice.due_date)} />
        <InfoRow icon="⏱️" label="Payment Terms" value={`Net ${customer.credit_days} days`} />
        <InfoRow icon="💱" label="Currency" value="INR (₹)" />
        <InfoRow icon="🧑‍💼" label="Sales Executive" value="Not tracked" muted />
        <InfoRow icon="🔖" label="Reference Number" value="Not available" muted />
        <InfoRow icon="📑" label="PO Number" value="Not available" muted />
        <InfoRow icon="💳" label="Payment Method" value="Not applicable yet" muted />
      </div>
    </Card>
  );
}
