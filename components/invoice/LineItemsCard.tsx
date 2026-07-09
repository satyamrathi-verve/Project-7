import type { InvoiceItem } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Card, CardTitle, Icon } from "./Primitives";

export function LineItemsCard({
  items,
  subtotal,
  taxAmount,
  total,
}: {
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
}) {
  return (
    <Card>
      <CardTitle icon={<span aria-hidden>📋</span>} subtitle="Everything billed on this invoice">
        Line Items
      </CardTitle>

      <div className="max-h-[420px] overflow-auto rounded-xl border border-hairline">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-section">
            <tr className="border-b border-hairline text-left">
              <th className="px-4 py-3 font-semibold text-ink-secondary">Description</th>
              <th className="px-4 py-3 text-right font-semibold text-ink-secondary">Qty</th>
              <th className="px-4 py-3 text-right font-semibold text-ink-secondary">Rate</th>
              <th className="px-4 py-3 text-right font-semibold text-ink-secondary">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-muted">
                  <span className="mb-1 flex justify-center">
                    <Icon className="h-6 w-6 text-[22px]">🗂️</Icon>
                  </span>
                  No line items on this invoice.
                </td>
              </tr>
            ) : (
              items.map((item, i) => (
                <tr
                  key={item.id}
                  className={`border-b border-hairline/50 text-ink-secondary transition-colors duration-150 last:border-0 hover:bg-brand/[0.04] ${
                    i % 2 === 1 ? "bg-section/50" : "bg-surface"
                  }`}
                >
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.qty}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(item.rate)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-ink">{formatMoney(item.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Totals summary card */}
      <div className="mt-4 ml-auto w-full max-w-xs rounded-xl border border-hairline/50 bg-section/60 p-4 sm:w-80">
        <Row label="Subtotal" value={formatMoney(subtotal)} />
        <Row label="Tax" value={formatMoney(taxAmount)} />
        <div className="my-2 border-t border-hairline" />
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold text-ink">Grand Total</span>
          <span className="text-2xl font-bold tabular-nums text-ink">{formatMoney(total)}</span>
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium tabular-nums text-ink-secondary">{value}</span>
    </div>
  );
}
