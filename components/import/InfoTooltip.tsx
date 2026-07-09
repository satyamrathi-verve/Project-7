"use client";

import { useState } from "react";

/** Small ⓘ icon with a hover/focus tooltip — used next to every configurable option. */
export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => e.preventDefault()}
        aria-label="More information"
        className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold leading-none text-brand hover:bg-brand/20"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs leading-snug text-white shadow-lg"
        >
          {text}
          <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-ink" />
        </span>
      )}
    </span>
  );
}
