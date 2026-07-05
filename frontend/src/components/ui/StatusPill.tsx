import type { UserRole } from "@/types/auth";

export type OrderStatus = "pending" | "under_review" | "negotiating" | "in_progress" | "completed";

const LABELS: Record<OrderStatus, string> = {
  pending: "قيد الانتظار",
  under_review: "تحت المراجعة",
  negotiating: "جارٍ التفاوض",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
};

// Every status but "in_progress" has a fixed color; "in_progress" takes the
// active role's own color per CLAUDE.md ("قيد التنفيذ → لون الدور").
const FIXED_CLASSES: Partial<Record<OrderStatus, string>> = {
  pending: "bg-slate-100 text-slate-600",
  under_review: "bg-sky-50 text-sky-700",
  negotiating: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
};

const ROLE_IN_PROGRESS_CLASSES: Record<UserRole, string> = {
  agent: "bg-supplier-50 text-supplier-600",
  client: "bg-importer-50 text-importer-600",
  admin: "bg-slate-100 text-slate-700",
};

interface StatusPillProps {
  status: OrderStatus;
  /** Required to color "in_progress" with the viewer's own role. */
  role: UserRole;
}

export function StatusPill({ status, role }: StatusPillProps) {
  const className =
    status === "in_progress" ? ROLE_IN_PROGRESS_CLASSES[role] : FIXED_CLASSES[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {LABELS[status]}
    </span>
  );
}
