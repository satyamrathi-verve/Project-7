import type { ReactNode } from "react";

/*
  One shared card shell for every dashboard panel — same radius, padding,
  layered shadow, and hover lift everywhere, so the dashboard reads as one
  design system instead of a dozen hand-tuned panels.
*/
export function DashboardCard({
  icon,
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  icon?: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group rounded-xl border border-hairline bg-surface p-5 shadow-card transition-all duration-[220ms] ease-premium hover:-translate-y-1 hover:border-brand/20 hover:shadow-card-hover ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="flex items-center gap-2 text-[18px] font-semibold leading-tight text-ink">
                {icon}
                {title}
              </h3>
            )}
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
          </div>
          {action && <div className="flex-none">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
