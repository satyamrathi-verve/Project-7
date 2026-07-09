import type { ReactNode } from "react";

/* Shared card + field building blocks for the Invoice View screen. */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-hairline bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_30px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-1 hover:border-info-border hover:shadow-[0_4px_14px_rgba(0,0,0,0.08),0_10px_30px_rgba(0,0,0,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Fixed-size wrapper so every emoji "icon" in this screen shares one visual weight. */
export function Icon({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex h-[18px] w-[18px] flex-none items-center justify-center text-[15px] leading-none ${className}`}>
      {children}
    </span>
  );
}

export function CardTitle({
  icon,
  subtitle,
  children,
}: {
  icon?: ReactNode;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <h3 className="flex items-center gap-2 text-[20px] font-semibold leading-tight text-ink">
        {icon}
        {children}
      </h3>
      {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
    </div>
  );
}

export function Field({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="flex items-center gap-2 text-[12px] uppercase tracking-wide text-ink-muted">
        {icon}
        {label}
      </span>
      <span className="text-right text-[15px] font-semibold text-ink">{value}</span>
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-sidebar ${className}`} />;
}

/** Premium progress bar — gradient fill, soft shadow, percentage label, animated width. */
export function ProgressBar({
  percent,
  tone = "brand",
  label,
}: {
  percent: number;
  tone?: "brand" | "emerald" | "amber" | "red";
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const gradient: Record<string, string> = {
    brand: "from-[#8ba4ff] to-brand",
    emerald: "from-success to-success",
    amber: "from-warning to-warning",
    red: "from-danger to-danger",
  };
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-sidebar shadow-inner">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient[tone]} shadow-[0_0_8px_rgba(99,102,241,0.35)] transition-[width] duration-700 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {label && <p className="mt-1 text-right text-[12px] font-semibold text-ink-muted">{label}</p>}
    </div>
  );
}

/** Circular ring gauge (0–100) used for the Collection Health score. */
export function CircularRing({
  value,
  size = 56,
  strokeColor,
  trackColor = "rgb(var(--color-hairline))",
}: {
  value: number;
  size?: number;
  strokeColor: string;
  trackColor?: string;
}) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} stroke={trackColor} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        stroke={strokeColor}
        fill="none"
        className="transition-[stroke-dashoffset] duration-1000 ease-out"
      />
    </svg>
  );
}
