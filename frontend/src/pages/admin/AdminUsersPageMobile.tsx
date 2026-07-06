import { UserCog, Loader2, Power, PowerOff, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminUsersData, ROLE_LABEL, type RoleFilter, type StatusFilter } from "./useAdminUsersData";

// No handoff-designs/*.html reference exists for admin user management —
// stacked cards per CLAUDE.md's mandatory mobile pattern (table columns
// don't fit a narrow viewport), same data/actions as the desktop table.
const ROLE_TABS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "admin", label: "إدارة" },
  { key: "agent", label: "موردون" },
  { key: "client", label: "مستوردون" },
];

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "نشط" },
  { key: "inactive", label: "معطّل" },
];

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-slate-100 text-slate-700",
  agent: "bg-supplier-50 text-supplier-600",
  client: "bg-importer-50 text-importer-500",
};

export function AdminUsersPageMobile() {
  const {
    users,
    total,
    isLoading,
    error,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    toggleMutation,
    handleToggle,
  } = useAdminUsersData();

  return (
    <div className="space-y-4 pb-8">
      <div className="card p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white">
            <UserCog className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">إدارة المستخدمين</h1>
            <p className="text-xs text-slate-500">{total} مستخدم مسجّل بالمنصة</p>
          </div>
        </div>
      </div>

      <div className="card space-y-2.5 p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRoleFilter(tab.key)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                roleFilter === tab.key ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                statusFilter === tab.key ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card space-y-2 p-4">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-44 rounded" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <EmptyState icon={UsersIcon} title="تعذّر تحميل بيانات المستخدمين" description="حاول تحديث الصفحة" />
      )}

      {!isLoading && !error && users.length === 0 && (
        <EmptyState icon={UsersIcon} title="لا يوجد مستخدمون مطابقون للفلاتر الحالية" />
      )}

      {!isLoading &&
        !error &&
        users.map((user) => {
          const isPending = toggleMutation.isPending && toggleMutation.variables?.userId === user.id;
          return (
            <div key={user.id} className="card space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{user.full_name}</p>
                  <p className="truncate text-xs text-slate-500" dir="ltr">
                    {user.email}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                  )}
                >
                  {user.is_active ? "نشط" : "معطّل"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", ROLE_BADGE[user.role])}>
                    {ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] ?? user.role}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums" dir="ltr">
                    {new Date(user.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                  </span>
                </div>
                <button
                  onClick={() => handleToggle(user.id, user.is_active)}
                  disabled={isPending}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50",
                    user.is_active
                      ? "border-red-200 text-red-600 hover:bg-red-50"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  )}
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : user.is_active ? (
                    <PowerOff className="h-3.5 w-3.5" />
                  ) : (
                    <Power className="h-3.5 w-3.5" />
                  )}
                  {user.is_active ? "تعطيل" : "تفعيل"}
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
