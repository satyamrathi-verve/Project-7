import type { InsightSeverity } from "@/lib/collectionHealth";

export interface DashboardInsight {
  icon: string;
  title: string;
  text: string;
  severity: InsightSeverity;
}

const SEVERITY_STYLE: Record<InsightSeverity, { border: string; bg: string; title: string }> = {
  danger: { border: "border-l-danger", bg: "bg-danger-bg/60", title: "text-danger" },
  warning: { border: "border-l-warning", bg: "bg-warning-bg/60", title: "text-warning" },
  info: { border: "border-l-info", bg: "bg-info-bg/60", title: "text-info" },
  success: { border: "border-l-success", bg: "bg-success-bg/60", title: "text-success" },
};

/*
  Rule-based observations computed from real invoice/customer/receipt data
  (see the dashboard page's useMemo model) — styled like an "AI insights"
  panel since that's the clearest way to scan several at once. Not an LLM call.
*/
export function SmartInsightsCard({ insights }: { insights: DashboardInsight[] }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/50 to-surface p-5 shadow-card">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <span aria-hidden>✨</span>
        Smart Insights
      </h3>
      <p className="text-[13px] text-ink-muted">What changed, and what to do next</p>

      {insights.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No notable signals right now.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {insights.map((insight, i) => {
            const style = SEVERITY_STYLE[insight.severity];
            return (
              <li
                key={i}
                className={`flex items-start gap-2.5 rounded-r-lg border-l-4 ${style.border} ${style.bg} px-3.5 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card`}
              >
                <span aria-hidden className="mt-0.5 flex-none text-[15px] leading-none">
                  {insight.icon}
                </span>
                <div className="min-w-0">
                  <p className={`text-[13px] font-semibold ${style.title}`}>{insight.title}</p>
                  <p className="mt-0.5 text-[13px] text-ink-secondary">{insight.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
