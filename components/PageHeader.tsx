import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-light text-brand">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-secondary">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  );
}
