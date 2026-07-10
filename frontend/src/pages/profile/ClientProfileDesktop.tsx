import { useNavigate } from "react-router-dom";
import { History, ShieldCheck, MessageCircle, Pencil, Compass, Bookmark, ImagePlus } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClientProfileData } from "./useClientProfileData";
import { useProfileImageUpload } from "./useProfileImageUpload";
import { ProfileAvatar } from "./ProfileAvatar";
import { ImagePickButton } from "./ImagePickButton";
import { ClientProfileEditForm } from "./ClientProfileEditForm";

// Reference: handoff-designs/importer-profile.html
function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export function ClientProfileDesktop() {
  const navigate = useNavigate();
  const {
    user,
    companyName,
    preferredPort,
    contactNumber,
    avatarUrl,
    bannerUrl,
    isActive,
    completedDealsCount,
    avgOrderValue,
    isEditing,
    form,
    startEditing,
    cancelEditing,
    updateField,
    save,
    isSaving,
  } = useClientProfileData();
  const { uploadAvatar, uploadBanner, uploading } = useProfileImageUpload();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="card overflow-hidden p-0">
        {/* Cover */}
        <div
          className="relative h-40 bg-importer-800 bg-gradient-to-br from-importer-900 to-importer-600 bg-cover bg-center"
          style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
        >
          {bannerUrl && <div className="absolute inset-0 bg-slate-900/25" />}
          <span className="absolute start-6 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white">
            <History className="h-3.5 w-3.5" />
            سجل الاستيراد الكامل
          </span>
          <ImagePickButton
            onPick={uploadBanner}
            loading={uploading === "banner_url"}
            ariaLabel="تغيير صورة الغلاف"
            className="absolute end-6 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/25 active:scale-[0.98] disabled:opacity-70"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            تغيير الغلاف
          </ImagePickButton>
          <div className="absolute -bottom-10 start-8">
            <ProfileAvatar
              src={avatarUrl}
              initials={initialsOf(companyName)}
              sizeClass="h-20 w-20"
              textClass="text-xl text-importer-700"
              onPick={uploadAvatar}
              uploading={uploading === "avatar_url"}
            />
          </div>
        </div>

        <div className="px-6 pb-6 pt-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{companyName}</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                تجارة عامة · مستورد نشط — {preferredPort !== "—" ? preferredPort : "الأردن"}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-importer-50 px-2.5 py-1 text-xs font-medium text-importer-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                مستورد موثّق
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(ROUTES.CHAT.LIST)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                محادثة
              </button>
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98]"
              >
                <Pencil className="h-4 w-4" />
                تعديل الملف
              </button>
              <button
                onClick={() => navigate(ROUTES.CATALOG.MARKETPLACE)}
                className="flex items-center gap-1.5 rounded-lg bg-importer-500 px-3.5 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-importer-600 active:scale-[0.98]"
              >
                <Compass className="h-4 w-4" />
                تصفّح السوق العالمي
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xl font-bold tabular-nums text-slate-900">{completedDealsCount}</div>
              <div className="mt-1 text-xs text-slate-500">صفقة مكتملة</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xl font-bold text-importer-600">{preferredPort}</div>
              <div className="mt-1 text-xs text-slate-500">ميناء الاستيراد المفضّل</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xl font-bold tabular-nums text-slate-900" dir="ltr">
                {avgOrderValue}
              </div>
              <div className="mt-1 text-xs text-slate-500">متوسط قيمة الطلب</div>
            </div>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <div className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-900">بيانات الشركة</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">رقم التواصل التجاري</p>
              <p className="mt-0.5 font-medium text-slate-900" dir="ltr">
                {contactNumber}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">ميناء الاستيراد المفضّل</p>
              <p className="mt-0.5 font-medium text-slate-900">{preferredPort}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">حالة الحساب</p>
              <p className={`mt-0.5 font-medium ${isActive ? "text-emerald-600" : "text-slate-500"}`}>
                {isActive ? "نشط" : "غير نشط"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">البريد الإلكتروني</p>
              <p className="mt-0.5 font-medium text-slate-900" dir="ltr">
                {user?.email ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">محفوظاتي ومتابعاتي</h2>
          <EmptyState
            icon={Bookmark}
            title="لا توجد عناصر محفوظة بعد"
            description="زرّا الحفظ والمتابعة في الريلز تجريبيان محلياً حالياً ولا يُخزَّنان — سيتوفر نظام حفظ ومتابعة حقيقي لاحقاً"
          />
        </div>
      </div>
    </div>
  );
}
