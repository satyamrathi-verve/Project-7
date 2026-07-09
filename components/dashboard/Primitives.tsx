import type { ReactNode } from "react";

/** Shimmering skeleton block for loading states — replaces plain pulse placeholders. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-xl bg-[linear-gradient(110deg,rgb(var(--color-ink)/0.04)_8%,rgb(var(--color-ink)/0.09)_18%,rgb(var(--color-ink)/0.04)_33%)] bg-[length:200%_100%] ${className}`}
    />
  );
}

/** Fixed-size wrapper so every emoji "icon" on the dashboard shares one visual weight. */
export function Icon({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex h-[18px] w-[18px] flex-none items-center justify-center text-[15px] leading-none ${className}`}>
      {children}
    </span>
  );
}

/** Premium gradient progress bar — rounded, animated width, optional percentage label. */
export function GradientProgressBar({
  percent,
  tone = "brand",
  label,
}: {
  percent: number;
  tone?: "brand" | "success" | "warning" | "danger";
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const gradient: Record<string, string> = {
    brand: "from-[#8ba0d6] to-brand",
    success: "from-success to-success",
    warning: "from-warning to-warning",
    danger: "from-danger to-danger",
  };
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink/[0.06] shadow-inner">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-premium ${gradient[tone]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {label && <p className="mt-1 text-right text-[11px] font-semibold text-ink-muted">{label}</p>}
    </div>
  );
}
