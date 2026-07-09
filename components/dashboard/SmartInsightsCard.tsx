"use client";

import { memo, useState } from "react";
import type { InsightSeverity } from "@/lib/collectionHealth";
import { DashboardCard } from "./DashboardCard";
import { Icon } from "./Primitives";

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
  Dismiss is a session-only UI convenience (nothing is stored) — the same
  insight reappears next visit if the underlying numbers still trigger it.
*/
function SmartInsightsCardImpl({ insights }: { insights: DashboardInsight[] }) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const visible = insights.map((insight, i) => ({ insight, i })).filter(({ i }) => !dismissed.has(i));

  return (
    <DashboardCard
      icon={<span aria-hidden>✨</span>}
      title="Smart Insights"
      subtitle="What changed, and what to do next"
      className="border-info/20 bg-gradient-to-br from-info/[0.06] to-surface"
    >
      {visible.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {insights.length === 0 ? "No notable signals right now." : "All caught up — insights dismissed for this session."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map(({ insight, i }) => {
            const style = SEVERITY_STYLE[insight.severity];
            return (
              <li
                key={i}
                className={`group/insight flex items-start gap-2.5 rounded-r-lg border-l-4 ${style.border} ${style.bg} px-3.5 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card`}
              >
                <Icon className="mt-0.5">{insight.icon}</Icon>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-semibold ${style.title}`}>{insight.title}</p>
                  <p className="mt-0.5 text-[13px] text-ink-secondary">{insight.text}</p>
                </div>
                <button
                  onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                  aria-label={`Dismiss insight: ${insight.title}`}
                  title="Dismiss"
                  className="flex-none rounded p-1 text-ink-muted opacity-0 transition-opacity duration-150 hover:bg-ink/[0.06] hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 group-hover/insight:opacity-100"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

export const SmartInsightsCard = memo(SmartInsightsCardImpl);
