import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API } from "@/constants/api";
import { stringToColor } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Loader2, Save, User, Building2, Package } from "lucide-react";
import { ClientProfilePage } from "./ClientProfilePage";
import { SupplierProfilePage } from "./SupplierProfilePage";

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  profile?: Record<string, string | null>;
}

async function fetchMe(): Promise<ProfileData> {
  const res = await api.get<ProfileData>(API.AUTH.ME);
  return res.data;
}

async function patchMe(data: Record<string, string | null>): Promise<ProfileData> {
  const res = await api.patch<ProfileData>(API.AUTH.ME, data);
  return res.data;
}

// Role gateway for the shared /profile route: importers get the T7.1
// showcase (ClientProfilePage) and suppliers get the T7.2 showcase
// (SupplierProfilePage) — cover, stats, catalog tabs. Admins still get this
// legacy settings-style form below (no showcase spec exists for admin).
export function ProfilePage() {
  const role = useAuthStore((s) => s.role);
  if (role === "client") return <ClientProfilePage />;
  if (role === "agent") return <SupplierProfilePage />;
  return <LegacyProfileForm />;
}

function LegacyProfileForm() {
  const qc = useQueryClient();

  const { data: user, isLoading } = useQuery<ProfileData>({
    queryKey: ["profile-me"],
    queryFn: fetchMe,
    staleTime: 30_000,
  });

  // ── Local form state ──
  const [form, setForm] = useState<Record<string, string>>({});
  const changed = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const mutation = useMutation({
    mutationFn: () => patchMe(form as Record<string, string | null>),
    onSuccess: (updated) => {
      qc.setQueryData(["profile-me"], updated);
      setForm({});
      qc.invalidateQueries({ queryKey: ["profile-me"] });
    },
  });

  const val = (key: string, fallback?: string) =>
    form[key] !== undefined ? form[key] : (user?.profile?.[key] ?? fallback ?? "");

  const baseVal = (key: keyof ProfileData) =>
    form[key as string] !== undefined ? form[key as string] : ((user?.[key] as string) ?? "");

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-gray-300" />
      </div>
    );
  }

  const isAgent = user?.role === "agent";
  const isClient = user?.role === "client";
  const hasChanges = Object.keys(form).length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ── Header card ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ backgroundColor: user?.full_name ? stringToColor(user.full_name) : "#6b7280" }}
          >
            {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{user?.full_name}</h1>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className="mt-1 inline-block rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
              {isAgent ? "مندوب" : isClient ? "مستورد" : "مدير"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Basic info ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">المعلومات الأساسية</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="الاسم الكامل"
            value={baseVal("full_name")}
            onChange={(v) => changed("full_name", v)}
          />
          <Field
            label="رقم الهاتف"
            value={baseVal("phone")}
            onChange={(v) => changed("phone", v)}
            placeholder="+962791234567"
          />
        </div>
      </div>

      {/* ── Client profile ── */}
      {isClient && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">بيانات الشركة</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="اسم الشركة"
              value={val("company_name")}
              onChange={(v) => changed("company_name", v)}
            />
            <Field
              label="ميناء الاستيراد المفضّل"
              value={val("preferred_port")}
              onChange={(v) => changed("preferred_port", v)}
              placeholder="Aqaba"
            />
            <Field
              label="رقم التواصل التجاري"
              value={val("contact_number")}
              onChange={(v) => changed("contact_number", v)}
            />
          </div>
        </div>
      )}

      {/* ── Agent/Supplier profile ── */}
      {isAgent && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">بيانات المورد</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="اسم المصنع"
              value={val("factory_name")}
              onChange={(v) => changed("factory_name", v)}
            />
            <Field
              label="الموقع في الصين"
              value={val("location_in_china")}
              onChange={(v) => changed("location_in_china", v)}
              placeholder="Guangzhou, Guangdong"
            />
            <Field
              label="التخصص"
              value={val("specialty")}
              onChange={(v) => changed("specialty", v)}
              placeholder="الإلكترونيات، المعدات الصناعية..."
            />
            <Field
              label="عنوان المصنع"
              value={val("factory_address")}
              onChange={(v) => changed("factory_address", v)}
            />
          </div>
          {/* Verification badge */}
          {user?.profile?.verification_status && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm">
              <span className="text-gray-500">حالة التحقق:</span>
              <span className={`font-medium ${
                user.profile.verification_status === "verified"
                  ? "text-green-700"
                  : user.profile.verification_status === "rejected"
                  ? "text-red-700"
                  : "text-yellow-700"
              }`}>
                {user.profile.verification_status === "verified"
                  ? "موثّق ✓"
                  : user.profile.verification_status === "rejected"
                  ? "مرفوض"
                  : "قيد المراجعة"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Save button ── */}
      {hasChanges && (
        <div className="flex justify-end">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            حفظ التغييرات
          </button>
        </div>
      )}

      {mutation.isSuccess && (
        <p className="text-center text-sm text-green-600">تم حفظ التغييرات بنجاح</p>
      )}
      {mutation.isError && (
        <p className="text-center text-sm text-red-500">حدث خطأ — يرجى المحاولة مجدداً</p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-primary-400 focus:bg-white focus:outline-none"
      />
    </div>
  );
}
