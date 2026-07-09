"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Customer } from "@/lib/types";
import { inputClass } from "@/components/FormField";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1";

/**
 * Searchable customer picker. Replaces a plain <select> once the customer list
 * gets long enough that scrolling it stops being viable — types to filter by
 * name or code, arrow keys to move, Enter to pick, Escape to close.
 */
export function CustomerCombobox({
  customers,
  value,
  onChange,
}: {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = customers.find((c) => c.id === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 50);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .slice(0, 50);
  }, [customers, query]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  function pick(c: Customer) {
    onChange(c.id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[activeIdx]) pick(matches[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        className={inputClass}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder="Search customer by name or code…"
        value={open ? query : selected ? `${selected.code} — ${selected.name}` : ""}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-hairline bg-surface py-1 shadow-card-hover"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-muted">No customers match.</li>
          ) : (
            matches.map((c, i) => (
              <li key={c.id} role="option" aria-selected={c.id === value}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors duration-100 ${FOCUS_RING} ${
                    i === activeIdx ? "bg-brand/10 text-ink" : "text-ink-secondary hover:bg-black/[0.03]"
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="ml-3 flex-none text-xs text-ink-muted">{c.code}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
