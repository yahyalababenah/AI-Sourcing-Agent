import type { ReactNode } from "react";

interface LineRowProps {
  label: ReactNode;
  value: ReactNode;
  /** Dims the row for secondary/derived line items (e.g. subtotals). */
  muted?: boolean;
}

// Per CLAUDE.md's strict financial-figures rule: slate only, tabular-nums
// always. Used by the pricing calculator and invoices — never decorate the
// amount with a role color; the final total gets its emerald treatment at
// the call site, not here.
export function LineRow({ label, value, muted = false }: LineRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
      <span className={`text-sm ${muted ? "text-slate-400" : "text-slate-600"}`}>{label}</span>
      <span className="text-sm font-medium text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}
