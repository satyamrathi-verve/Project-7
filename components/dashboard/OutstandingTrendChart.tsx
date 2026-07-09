import { memo } from "react";
import { formatMoney } from "@/lib/format";

/*
  Running outstanding balance at each month-end, last 12 months — computed
  from real invoice totals minus real allocations up to that date (no
  snapshot table needed; it's just cumulative arithmetic on real rows).
*/
function OutstandingTrendChartImpl({ points }: { points: { label: string; value: number }[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-ink-muted">Not enough history yet.</p>;
  }

  const max = Math.max(...points.map((p) => p.value), 1);
  const w = 600;
  const h = 160;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - (p.value / max) * (h - 10)] as const);
  const linePoints = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const areaPoints = `0,${h} ${linePoints} ${w},${h}`;
  // Generous upper bound on path length so the draw-in animation always completes fully.
  const pathLength = coords.reduce((acc, [x, y], i) => {
    if (i === 0) return 0;
    const [px, py] = coords[i - 1];
    return acc + Math.hypot(x - px, y - py);
  }, 0);
  const dash = Math.ceil(pathLength) + 10;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="outstandingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-brand))" stopOpacity="0.18" />
            <stop offset="100%" stopColor="rgb(var(--color-brand))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Subtle horizontal gridlines for an axis feel */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={w} y1={h * f} y2={h * f} className="stroke-hairline" strokeWidth={1} strokeDasharray="4 4" />
        ))}
        <polygon points={areaPoints} fill="url(#outstandingFill)" />
        <polyline
          points={linePoints}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dash}
          strokeDashoffset={dash}
          className="stroke-brand animate-draw-line"
        />
        {coords.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === coords.length - 1 ? 4 : 2.5}
            className="fill-brand cursor-pointer [transform-box:fill-box] [transform-origin:center] transition-transform duration-150 hover:scale-125"
            opacity={i === coords.length - 1 ? 1 : 0.5}
          >
            <title>
              {points[i].label}: {formatMoney(points[i].value)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
        {points
          .filter((_, i) => i % Math.ceil(points.length / 6) === 0)
          .map((p) => (
            <span key={p.label}>{p.label}</span>
          ))}
      </div>
    </div>
  );
}

export const OutstandingTrendChart = memo(OutstandingTrendChartImpl);
