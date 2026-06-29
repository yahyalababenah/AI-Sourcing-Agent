import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { intakeService } from "@/services/intakeService";
import { ROUTES } from "@/constants/routes";
import {
  ClipboardList, Upload, FileText, Eye, Loader2,
  Inbox, Send, Package, LayoutGrid, ShieldCheck,
} from "lucide-react";

const RFQ_STATUS_COLORS: Record<string, string> = {
  open:       "bg-sky-50 text-sky-700 ring-1 ring-sky-200/60",
  processing: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
  quoted:     "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  closed:     "bg-slate-100 text-slate-600",
  cancelled:  "bg-red-50 text-red-600",
};

const RFQ_STATUS_LABELS: Record<string, string> = {
  open:       "مفتوح",
  processing: "قيد المعالجة",
  quoted:     "تم التسعير",
  closed:     "مغلق",
  cancelled:  "ملغي",
};

export function AgentDashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string | undefined>("open");

  const { data: rfqsData, isLoading: rfqsLoading } = useQuery({
    queryKey: ["agent-rfqs", statusFilter],
    queryFn:  () => intakeService.list({ status: statusFilter, limit: 20 }),
    staleTime: 15_000,
  });

  const { data: openStats }   = useQuery({ queryKey: ["rfqs-open-count"],   queryFn: () => intakeService.list({ status: "open",   limit: 1 }), staleTime: 30_000 });
  const { data: quotedStats } = useQuery({ queryKey: ["rfqs-quoted-count"], queryFn: () => intakeService.list({ status: "quoted", limit: 1 }), staleTime: 30_000 });
  const { data: allStats }    = useQuery({ queryKey: ["rfqs-all-count"],    queryFn: () => intakeService.list({                   limit: 1 }), staleTime: 30_000 });

  const openCount   = openStats?.total   ?? 0;
  const quotedCount = quotedStats?.total ?? 0;
  const totalCount  = allStats?.total    ?? 0;

  const quickActions = [
    { label: "صندوق البريد",       sub: "الطلبات المطابقة لك",   icon: Inbox,       action: () => navigate(ROUTES.RFQ.SUPPLIER_INBOX) },
    { label: "رفع كاتالوج",        sub: "PDF أو صور المنتجات",   icon: Upload,      action: () => navigate(ROUTES.DOCUMENTS.UPLOAD) },
    { label: "المنتجات",           sub: "كاتالوج الموردين",       icon: Package,     action: () => navigate(ROUTES.SUPPLIER.MY_PRODUCTS) },
    { label: "مراجعة المنتجات",    sub: "موافقة على المستخرجات", icon: ShieldCheck, action: () => navigate(ROUTES.SUPPLIER.REVIEW) },
    { label: "عروض الأسعار",       sub: "العروض المرسلة",         icon: FileText,    action: () => navigate(ROUTES.QUOTES.LIST) },
  ];

  const filters = [
    { key: undefined,       label: "الكل" },
    { key: "open",          label: "مفتوحة" },
    { key: "processing",    label: "قيد المعالجة" },
    { key: "quoted",        label: "تم التسعير" },
    { key: "closed",        label: "مغلقة" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-8 py-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          مرحباً، {user?.full_name || ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          لوحة تحكم المندوب — استلم الطلبات، أرفع الكاتالوجات، وأرسل عروض الأسعار
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
            <Inbox className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{openCount}</p>
          <p className="mt-0.5 text-xs text-slate-500">طلبات تنتظر الرد</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
            <Send className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{quotedCount}</p>
          <p className="mt-0.5 text-xs text-slate-500">تم تسعيرها</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
            <ClipboardList className="h-4 w-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
          <p className="mt-0.5 text-xs text-slate-500">إجمالي الطلبات</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {quickActions.map(({ label, sub, icon: Icon, action }) => (
          <button
            key={label}
            onClick={action}
            className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-right transition-all hover:border-emerald-200 hover:shadow-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{label}</p>
              <p className="truncate text-xs text-slate-400">{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* RFQs Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900">طلبات العروض</h2>
          </div>
          <button
            onClick={() => navigate(ROUTES.RFQ.LIST)}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            عرض الكل
          </button>
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-3">
          {filters.map((f) => (
            <button
              key={f.key ?? "all"}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f.key
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {rfqsLoading && (
          <div className="p-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" />
            <p className="mt-3 text-sm text-slate-400">جاري التحميل...</p>
          </div>
        )}

        {!rfqsLoading && rfqsData && rfqsData.items.length === 0 && (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50">
              <ClipboardList className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm text-slate-400">لا توجد طلبات</p>
          </div>
        )}

        {rfqsData && rfqsData.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-slate-50/60 text-xs text-slate-500">
                  <th className="px-5 py-3 font-medium">العميل</th>
                  <th className="px-5 py-3 font-medium">الطلب</th>
                  <th className="px-5 py-3 font-medium">الميناء</th>
                  <th className="px-5 py-3 font-medium">الحالة</th>
                  <th className="px-5 py-3 font-medium">التاريخ</th>
                  <th className="px-5 py-3 font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rfqsData.items.map((rfq) => (
                  <tr key={rfq.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {rfq.client_name || "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-5 py-3.5 text-slate-500">
                      {rfq.client_request_arabic?.split("\n")[0]?.replace("المنتج: ", "") || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {rfq.destination_port || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RFQ_STATUS_COLORS[rfq.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {RFQ_STATUS_LABELS[rfq.status] ?? rfq.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {new Date(rfq.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(ROUTES.RFQ.DETAIL(rfq.id))}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          عرض
                        </button>
                        {rfq.status === "open" && (
                          <button
                            onClick={() => navigate(ROUTES.RFQ.BUILD_QUOTE(rfq.id))}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                          >
                            <Send className="h-3 w-3" />
                            أرسل عرضاً
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
