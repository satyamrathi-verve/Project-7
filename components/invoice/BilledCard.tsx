"use client";

import { useState } from "react";
import type { Company, Customer } from "@/lib/types";
import { Card, Icon } from "./Primitives";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function CopyableRow({ icon, value, label }: { icon: string; value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={copy}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}: ${value}`}
      className="group/row -mx-2 flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm text-slate-500 transition-colors duration-200 hover:bg-slate-50"
    >
      <Icon className="text-slate-400">{icon}</Icon>
      <span className="min-w-0 flex-1 truncate">{value}</span>
      <span
        aria-hidden
        className="flex-none text-xs text-slate-300 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100"
      >
        {copied ? "✓ Copied" : "Copy"}
      </span>
    </button>
  );
}

function Party({
  kind,
  name,
  gstin,
  email,
  phone,
  address,
}: {
  kind: "Billed By" | "Billed To";
  name: string;
  gstin?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}) {
  return (
    <div className="flex-1 rounded-xl border border-slate-100 p-4 transition-colors duration-200 hover:border-slate-200 hover:bg-slate-50/40">
      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon>{kind === "Billed By" ? "🏢" : "👤"}</Icon>
        {kind}
      </p>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
          {initialsOf(name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-slate-900">{name}</p>
          {address ? (
            <p className="mt-0.5 text-sm text-slate-500">{address}</p>
          ) : (
            <p className="mt-0.5 text-sm text-slate-400">Address not available</p>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-0.5 border-t border-slate-100 pt-2">
        {gstin ? (
          <CopyableRow icon="🧾" label="GSTIN" value={gstin} />
        ) : (
          <p className="flex items-center gap-2 px-2 py-1 text-sm text-slate-300">
            <Icon>🧾</Icon>
            GSTIN not available
          </p>
        )}
        {email ? (
          <CopyableRow icon="✉️" label="email" value={email} />
        ) : (
          <p className="flex items-center gap-2 px-2 py-1 text-sm text-slate-300">
            <Icon>✉️</Icon>
            Email not available
          </p>
        )}
        {phone ? (
          <CopyableRow icon="📞" label="phone" value={phone} />
        ) : (
          <p className="flex items-center gap-2 px-2 py-1 text-sm text-slate-300">
            <Icon>📞</Icon>
            Phone not available
          </p>
        )}
      </div>
    </div>
  );
}

export function BilledCard({ company, customer }: { company: Company | null; customer: Customer }) {
  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:divide-x sm:divide-slate-100">
      <Party
        kind="Billed By"
        name={company?.name ?? "No company profile set up"}
        gstin={company?.gstin}
        email={company?.email}
        phone={company?.phone}
        address={company?.address}
      />
      <div className="hidden w-px sm:block" />
      <Party
        kind="Billed To"
        name={customer.name}
        gstin={customer.gstin}
        email={customer.email}
        phone={customer.phone}
        address={customer.address}
      />
    </Card>
  );
}
