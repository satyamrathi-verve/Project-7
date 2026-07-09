export const WIZARD_STEPS = [
  "Import Type",
  "Upload File",
  "Map Fields",
  "Validate & Fix",
  "Configure",
  "Import",
  "Results",
] as const;

export function Stepper({ current, furthest, onJump }: { current: number; furthest: number; onJump: (step: number) => void }) {
  return (
    <ol className="mb-8 flex items-center gap-1 overflow-x-auto rounded-xl border border-hairline bg-surface p-3">
      {WIZARD_STEPS.map((label, i) => {
        const step = i + 1;
        const isCurrent = step === current;
        const isDone = step < current;
        const reachable = step <= furthest;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onJump(step)}
              className={`flex min-w-[7.5rem] items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                isCurrent
                  ? "bg-brand text-white"
                  : isDone
                  ? "text-brand hover:bg-brand/10"
                  : reachable
                  ? "text-ink-secondary hover:bg-section"
                  : "cursor-not-allowed text-ink-muted/60"
              }`}
            >
              <span
                className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold ${
                  isCurrent
                    ? "bg-surface text-brand"
                    : isDone
                    ? "bg-brand text-white"
                    : "bg-hairline text-ink-muted"
                }`}
              >
                {isDone ? "✓" : step}
              </span>
              <span className="truncate">{label}</span>
            </button>
            {step < WIZARD_STEPS.length && <span className="mx-1 hidden h-px flex-1 bg-hairline sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}
