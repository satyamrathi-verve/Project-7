import type { InvoiceStatus } from "@/lib/types";
import { STATUS_BADGE_STRONG, STATUS_ICON, STATUS_LABEL } from "@/lib/statusStyles";

export function StatusBadge({ status, className = "" }: { status: InvoiceStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200 ${STATUS_BADGE_STRONG[status]} ${className}`}
    >
      <span aria-hidden>{STATUS_ICON[status]}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}
