"use client";

import { useCountUp } from "@/lib/useCountUp";

type Accent = "blue" | "green" | "orange" | "red" | "purple";

const ACCENT_STYLES: Record<Accent, { ring: string; icon: string; trendUp: string; trendDown: string; hoverBorder: string }> = {
  blue: { ring: "bg-info/10 text-info", icon: "bg-info/10", trendUp: "text-info", trendDown: "text-danger", hoverBorder: "hover:border-info/40" },
  green: { ring: "bg-success/10 text-success", icon: "bg-success/10", trendUp: "text-success", trendDown: "text-danger", hoverBorder: "hover:border-success/40" },
  orange: { ring: "bg-warning/10 text-warning", icon: "bg-warning/10", trendUp: "text-success", trendDown: "text-danger", hoverBorder: "hover:border-warning/40" },
  red: { ring: "bg-danger/10 text-danger", icon: "bg-danger/10", trendUp: "text-success", trendDown: "text-danger", hoverBorder: "hover:border-danger/40" },
  purple: { ring: "bg-[#a78bfa]/10 text-[#a78bfa]", icon: "bg-[#a78bfa]/10", trendUp: "text-success", trendDown: "text-danger", hoverBorder: "hover:border-[#a78bfa]/40" },
};

/** Tiny inline sparkline — no charting dependency, just an SVG polyline. */
function Sparkline({ points, accent }: { points: number[]; accent: Accent }) {
  if (points.length < 2) return <div className="h-8" />;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => `${i * step},${h - ((p - min) / range) * h}`).join(" ");
  const strokeColor =
    accent === "green"
      ? "rgb(var(--color-success))"
      : accent === "orange"
        ? "rgb(var(--color-warning))"
        : accent === "red"
          ? "rgb(var(--color-danger))"
          : accent === "purple"
            ? "#a78bfa"
            : "rgb(var(--color-info))";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none">
      <polyline
        points={coords}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={1000}
        className="animate-draw-line"
      />
    </svg>
  );
}

export function StatCard({
  icon,
  label,
  value,
  trend,
  accent = "blue",
  sparkline,
  insight,
  countTo,
  formatValue,
}: {
  icon: string;
  label: string;
  value: string;
  trend?: { label: string; positive: boolean };
  accent?: Accent;
  sparkline?: number[];
  /** Tiny secondary line under the label, e.g. "0% received" or "Raised on Jul 4". */
  insight?: string;
  /** When set, animates `value` counting up from 0 to this number over ~500ms instead of showing it statically. */
  countTo?: number;
  /** Formats the animated number each frame (e.g. as currency). Required when `countTo` is set. */
  formatValue?: (n: number) => string;
}) {
  const styles = ACCENT_STYLES[accent];
  const animated = useCountUp(countTo ?? 0);
  const displayValue = countTo !== undefined && formatValue ? formatValue(animated) : value;
  return (
    <div
      className={`group rounded-xl border border-hairline bg-surface p-5 shadow-card transition-all duration-[220ms] ease-premium hover:-translate-y-1 hover:shadow-card-hover ${styles.hoverBorder}`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl text-lg ${styles.icon}`}>{icon}</div>
        {trend && (
          <span className={`text-xs font-semibold ${trend.positive ? styles.trendUp : styles.trendDown}`}>
            {trend.positive ? "▲" : "▼"} {trend.label}
          </span>
        )}
      </div>
      <p className="mt-4 text-[22px] font-bold leading-none tracking-tight text-ink tabular-nums md:text-[30px]">{displayValue}</p>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      {insight && <p className="mt-1 text-[12px] text-ink-muted/80">{insight}</p>}
      {sparkline && (
        <div className="mt-3">
          <Sparkline points={sparkline} accent={accent} />
        </div>
      )}
    </div>
  );
}
