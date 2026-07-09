import { formatMoney } from "@/lib/format";

/*
  Running outstanding balance at each month-end, last 12 months — computed
  from real invoice totals minus real allocations up to that date (no
  snapshot table needed; it's just cumulative arithmetic on real rows).
*/
export function OutstandingTrendChart({ points }: { points: { label: string; value: number }[] }) {
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

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="outstandingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3F51B5" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3F51B5" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#outstandingFill)" />
        <polyline points={linePoints} fill="none" stroke="#3F51B5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 4 : 2.5} fill="#3F51B5" opacity={i === coords.length - 1 ? 1 : 0.5}>
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
