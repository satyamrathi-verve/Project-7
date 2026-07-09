import type { InvoiceStatus } from "@/lib/types";

/*
  One source of truth for invoice status colour/label/icon so the badge looks
  identical everywhere (Sales Invoices list, Invoice View, AR Ageing, etc.).
  Semantic colours only: blue = informational (open), green = payments/paid,
  orange = partial/warning, red = overdue.
*/
export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: "Open",
  partial: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
};

export const STATUS_ICON: Record<InvoiceStatus, string> = {
  open: "📤",
  partial: "⏳",
  paid: "✅",
  overdue: "⚠️",
};

/** Solid badge (pill) styles — text + background. */
export const STATUS_BADGE: Record<InvoiceStatus, string> = {
  open: "bg-blue-50 text-blue-700",
  partial: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700",
};

/** Stronger variant for the hero header badge — adds a ring. */
export const STATUS_BADGE_STRONG: Record<InvoiceStatus, string> = {
  open: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  partial: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  paid: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  overdue: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
};

/** Accent used for hero numbers / progress bars keyed off status. */
export const STATUS_ACCENT_TEXT: Record<InvoiceStatus, string> = {
  open: "text-blue-600",
  partial: "text-amber-600",
  paid: "text-emerald-600",
  overdue: "text-red-600",
};
