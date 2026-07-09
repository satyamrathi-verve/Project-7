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

/** Solid badge (pill) styles — text + background. Semantic tokens flip with the theme. */
export const STATUS_BADGE: Record<InvoiceStatus, string> = {
  open: "bg-info-bg text-info",
  partial: "bg-warning-bg text-warning",
  paid: "bg-success-bg text-success",
  overdue: "bg-danger-bg text-danger",
};

/** Stronger variant for the hero header badge — adds a ring. */
export const STATUS_BADGE_STRONG: Record<InvoiceStatus, string> = {
  open: "bg-info-bg text-info ring-1 ring-inset ring-info-border",
  partial: "bg-warning-bg text-warning ring-1 ring-inset ring-warning-border",
  paid: "bg-success-bg text-success ring-1 ring-inset ring-success-border",
  overdue: "bg-danger-bg text-danger ring-1 ring-inset ring-danger-border",
};

/** Accent used for hero numbers / progress bars keyed off status. */
export const STATUS_ACCENT_TEXT: Record<InvoiceStatus, string> = {
  open: "text-info",
  partial: "text-warning",
  paid: "text-success",
  overdue: "text-danger",
};
