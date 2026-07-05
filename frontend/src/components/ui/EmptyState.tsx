import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Unified empty-state per CLAUDE.md T1.6 — every list/table should use this
// instead of hand-rolling its own "no data" block (see T10.3 for the
// page-by-page migration of the ad-hoc blocks that predate this component).
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="card p-12 text-center">
      <Icon className="mx-auto h-12 w-12 text-slate-300" strokeWidth={1.5} />
      <h3 className="mt-4 text-lg font-medium text-slate-600">{title}</h3>
      {description && <p className="mt-2 text-sm text-slate-400">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-600 active:scale-[0.98]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
