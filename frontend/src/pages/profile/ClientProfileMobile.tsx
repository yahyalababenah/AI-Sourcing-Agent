import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, ShieldCheck, Compass, Bookmark, ClipboardList } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { useClientProfileData, STATUS_PILL, type ClientRfqStatus } from "./useClientProfileData";
import { ClientProfileEditForm } from "./ClientProfileEditForm";

// Reference: handoff-designs/importer-profile-mobile.html — same content as
// the desktop card, stacked, with the segmented "محفوظاتي / طلباتي النشطة"
// switcher from CLAUDE.md's mobile spec for this screen.
function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function firstProductLine(request: string) {
  return request?.split(" — ")[0]?.replace("طلب شراء: ", "") || "طلب توريد";
}

type Tab = "saved" | "active";

export function ClientProfileMobile() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("saved");
  const {
    companyName,
    preferredPort,
    completedDealsCount,
    avgOrderValue,
    activeRfqs,
    isEditing,
    form,
    startEditing,
    cancelEditing,
    updateField,
    save,
    isSaving,
  } = useClientProfileData();

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden p-0">
        <div className="relative h-32 bg-gradient-to-br from-importer-900 to-importer-600">
          <span className="absolute start-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white">
            <History className="h-3 w-3" />
            سجل الاستيراد الكامل
          </span>
          <div className="absolute -bottom-8 start-5 flex h-16 w-16 items-center justify-center rounded-full bg-white text-lg font-bold text-importer-700 ring-4 ring-white">
            {initialsOf(companyName)}
          </div>
        </div>

        <div className="px-4 pb-4 pt-10">
          <h1 className="text-lg font-bold text-slate-900">{companyName}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            تجارة عامة · مستورد نشط — {preferredPort !== "—" ? preferredPort : "الأردن"}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-importer-50 px-2 py-1 text-[11px] font-medium text-importer-600">
            <ShieldCheck className="h-3 w-3" />
            مستورد موثّق
          </span>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-lg font-bold tabular-nums text-slate-900">{completedDealsCount}</div>
              <div className="mt-0.5 text-[10px] text-slate-500">صفقة مكتملة</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-lg font-bold text-importer-600">{preferredPort}</div>
              <div className="mt-0.5 text-[10px] text-slate-500">ميناء مفضّل</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-lg font-bold tabular-nums text-slate-900" dir="ltr">
                {avgOrderValue}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">متوسط الطلب</div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={startEditing}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98]"
            >
              تعديل
            </button>
            <button
              onClick={() => navigate(ROUTES.CATALOG.MARKETPLACE)}
              className="flex flex-[2] items-center justify-center gap-1.5 rounded-lg bg-importer-500 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-importer-600 active:scale-[0.98]"
            >
              <Compass className="h-4 w-4" />
              تصفّح السوق
            </button>
          </div>
        </div>
      </div>

      {isEditing && (
        <ClientProfileEditForm
          form={form}
          onChange={updateField}
          onSave={save}
          onCancel={cancelEditing}
          isSaving={isSaving}
        />
      )}

      {/* Segmented switcher */}
      <div className="flex rounded-lg border border-slate-200 bg-white p-1">
        <button
          onClick={() => setTab("saved")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors duration-150 ${
            tab === "saved" ? "bg-slate-900 text-white" : "text-slate-500"
          }`}
        >
          محفوظاتي
        </button>
        <button
          onClick={() => setTab("active")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors duration-150 ${
            tab === "active" ? "bg-slate-900 text-white" : "text-slate-500"
          }`}
        >
          طلباتي النشطة
        </button>
      </div>

      {tab === "saved" ? (
        <EmptyState
          icon={Bookmark}
          title="لا توجد عناصر محفوظة بعد"
          description="زرّا الحفظ والمتابعة في الريلز تجريبيان محلياً حالياً ولا يُخزَّنان"
        />
      ) : activeRfqs.length > 0 ? (
        <div className="card divide-y divide-slate-100">
          {activeRfqs.map((rfq) => {
            const status = STATUS_PILL[(rfq.status as ClientRfqStatus) ?? "open"] ?? "pending";
            return (
              <div
                key={rfq.id}
                onClick={() => navigate(ROUTES.RFQ.DETAIL(rfq.id))}
                className="flex cursor-pointer items-center justify-between p-3 transition-colors duration-150 hover:bg-slate-50"
              >
                <StatusPill status={status} role="client" />
                <span className="truncate text-sm font-medium text-slate-700">
                  {firstProductLine(rfq.client_request_arabic)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={ClipboardList} title="لا توجد طلبات نشطة حالياً" description="أنشئ طلب عرض سعر جديد للبدء" />
      )}
    </div>
  );
}
