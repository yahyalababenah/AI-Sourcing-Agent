import { UserCog, Loader2, Power, PowerOff, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminUsersData, ROLE_LABEL, type RoleFilter, type StatusFilter } from "./useAdminUsersData";

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

export function AdminUsersPageDesktop() {
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
    <div className="space-y-5 pb-8">
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">إدارة المستخدمين</h1>
              <p className="text-sm text-slate-500">{total} مستخدم مسجّل بالمنصة</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-1.5">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRoleFilter(tab.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                roleFilter === tab.key ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                statusFilter === tab.key ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="card divide-y divide-slate-50 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-4 w-52 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
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

      {!isLoading && !error && users.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="px-5 py-3 text-start font-medium">الاسم</th>
                <th className="px-5 py-3 text-start font-medium">البريد الإلكتروني</th>
                <th className="px-5 py-3 text-start font-medium">الدور</th>
                <th className="px-5 py-3 text-start font-medium">تاريخ الانضمام</th>
                <th className="px-5 py-3 text-start font-medium">الحالة</th>
                <th className="px-5 py-3 text-end font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user) => {
                const isPending = toggleMutation.isPending && toggleMutation.variables?.userId === user.id;
                return (
                  <tr key={user.id} className="transition-colors duration-150 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{user.full_name}</td>
                    <td className="px-5 py-3 text-slate-500" dir="ltr">
                      {user.email}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", ROLE_BADGE[user.role])}>
                        {ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] ?? user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 tabular-nums" dir="ltr">
                      {new Date(user.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                        )}
                      >
                        {user.is_active ? "نشط" : "معطّل"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-end">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
