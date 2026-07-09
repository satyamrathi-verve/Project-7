import type { CollectionAnalytics, InsightSeverity } from "@/lib/collectionHealth";
import { Card, CardTitle, Icon } from "./Primitives";

/*
  Plain rule-based observations computed from real invoice/customer history
  (see lib/collectionHealth.ts) — not an AI model call. Styled like an "AI
  insights" panel (severity colour + icon) since that's the clearest way to
  scan several observations at a glance.
*/
const SEVERITY_STYLE: Record<InsightSeverity, { border: string; bg: string; title: string; badge: string }> = {
  danger: { border: "border-l-red-400", bg: "bg-red-50/60", title: "text-red-800", badge: "Warning" },
  warning: { border: "border-l-amber-400", bg: "bg-amber-50/60", title: "text-amber-800", badge: "Recommendation" },
  info: { border: "border-l-blue-400", bg: "bg-blue-50/60", title: "text-blue-800", badge: "Information" },
  success: { border: "border-l-emerald-400", bg: "bg-emerald-50/60", title: "text-emerald-800", badge: "Success" },
};

export function InsightsCard({ a }: { a: CollectionAnalytics }) {
  return (
    <Card className="border-violet-100">
      <CardTitle icon={<span aria-hidden>✨</span>} subtitle="Smart collection recommendations">
        AI Insights
      </CardTitle>
      <ul className="space-y-2.5">
        {a.insights.map((insight, i) => {
          const style = SEVERITY_STYLE[insight.severity];
          return (
            <li
              key={i}
              className={`flex items-start gap-3 rounded-r-lg border-l-4 ${style.border} ${style.bg} px-3.5 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_30px_rgba(0,0,0,0.05)]`}
            >
              <Icon className="mt-0.5">{insight.icon}</Icon>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-[14px] font-semibold ${style.title}`}>{insight.title}</p>
                  <span className={`rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${style.title}`}>
                    {style.badge}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-slate-600">{insight.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
