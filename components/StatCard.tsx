type Accent = "blue" | "green" | "orange" | "red" | "purple";

const ACCENT_STYLES: Record<Accent, { ring: string; icon: string; trendUp: string; trendDown: string }> = {
  blue: { ring: "bg-blue-50 text-blue-600", icon: "bg-blue-100", trendUp: "text-blue-600", trendDown: "text-red-600" },
  green: { ring: "bg-emerald-50 text-emerald-600", icon: "bg-emerald-100", trendUp: "text-emerald-600", trendDown: "text-red-600" },
  orange: { ring: "bg-amber-50 text-amber-600", icon: "bg-amber-100", trendUp: "text-emerald-600", trendDown: "text-red-600" },
  red: { ring: "bg-red-50 text-red-600", icon: "bg-red-100", trendUp: "text-emerald-600", trendDown: "text-red-600" },
  purple: { ring: "bg-violet-50 text-violet-600", icon: "bg-violet-100", trendUp: "text-emerald-600", trendDown: "text-red-600" },
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
    accent === "green" ? "#059669" : accent === "orange" ? "#d97706" : accent === "red" ? "#dc2626" : accent === "purple" ? "#7c3aed" : "#2563eb";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none">
      <polyline points={coords} fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
}: {
  icon: string;
  label: string;
  value: string;
  trend?: { label: string; positive: boolean };
  accent?: Accent;
  sparkline?: number[];
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${styles.icon}`}>{icon}</div>
        {trend && (
          <span className={`text-xs font-semibold ${trend.positive ? styles.trendUp : styles.trendDown}`}>
            {trend.positive ? "▲" : "▼"} {trend.label}
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {sparkline && (
        <div className="mt-3">
          <Sparkline points={sparkline} accent={accent} />
        </div>
      )}
    </div>
  );
}
