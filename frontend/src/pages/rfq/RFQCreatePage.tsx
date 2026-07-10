import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { intakeService } from "@/services/intakeService";
import type { RFQCreate } from "@/types/intake";
import { useAuthStore } from "@/stores/authStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { RFQCreatePageDesktop } from "./RFQCreatePageDesktop";
import { RFQCreatePageMobile } from "./RFQCreatePageMobile";

// Role gateway (T8.1): importers get the structured product/quantity/specs
// form with a live cost-estimate preview (RFQCreatePageDesktop/Mobile, via
// useMediaQuery — same thin-switcher convention as every other phase).
// Agents/admins keep this free-text form below (renamed internally,
// unchanged) — same pattern as ProfilePage.tsx's LegacyProfileForm gate.
export function RFQCreatePage() {
  const role = useAuthStore((s) => s.role);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (role === "client") {
    return isDesktop ? <RFQCreatePageDesktop /> : <RFQCreatePageMobile />;
  }

  return <LegacyRFQCreateForm />;
}

function LegacyRFQCreateForm() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const isClient = role === "client";

  const [formData, setFormData] = useState<RFQCreate>({
    client_name: isClient ? (user?.full_name ?? "") : "",
    client_phone: isClient ? (user?.phone ?? "") : "",
    client_request_arabic: "",
    destination_port: "",
    target_currency: "USD",
  });

  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: RFQCreate) => intakeService.create(data),
    onSuccess: (rfq) => {
      navigate(ROUTES.RFQ.DETAIL(rfq.id));
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleChange = (field: keyof RFQCreate, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isClient && !formData.client_name.trim()) {
      setError("يرجى إدخال اسم العميل");
      return;
    }
    if (!formData.client_request_arabic.trim()) {
      setError("يرجى إدخال طلب العميل");
      return;
    }

    createMutation.mutate(formData);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(ROUTES.RFQ.LIST)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
        >
          → العودة
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            طلب عرض سعر جديد
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isClient
              ? "صف ما تريد استيراده وسيصلك عرض سعر من الموردين"
              : "أدخل بيانات المنتج المطلوب للحصول على عرض سعر"}
          </p>
        </div>
      </div>

      {/* noValidate: this form has its own Arabic-language validation
          messages in handleSubmit — native browser constraint validation
          (triggered by the `required` attributes below) would otherwise
          intercept the submit event first and show a generic, non-Arabic
          validation bubble instead, silently preventing our messages from
          ever being seen. */}
      <form onSubmit={handleSubmit} noValidate className="card space-y-5 p-6">
        {/* Client Name (agent/admin only — clients are identified by their account) */}
        {!isClient && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              اسم العميل <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.client_name}
              onChange={(e) => handleChange("client_name", e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="أحمد محمد"
            />
          </div>
        )}

        {/* Client Phone (agent/admin only) */}
        {!isClient && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              هاتف العميل
            </label>
            <input
              type="text"
              value={formData.client_phone || ""}
              onChange={(e) => handleChange("client_phone", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="+962791234567"
              dir="ltr"
            />
          </div>
        )}

        {/* Client Request */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            طلب العميل <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.client_request_arabic}
            onChange={(e) => handleChange("client_request_arabic", e.target.value)}
            required
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="اكتب وصف المنتجات المطلوبة بالتفصيل..."
          />
          <p className="mt-1 text-xs text-gray-400">
            سيتم ترجمة الطلب إلى اللغة الصينية تلقائياً واستخراج المنتجات
          </p>
        </div>

        {/* Destination Port */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            ميناء الوصول
          </label>
          <input
            type="text"
            value={formData.destination_port || ""}
            onChange={(e) => handleChange("destination_port", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="ميناء العقبة، الأردن"
          />
        </div>

        {/* Target Currency */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            العملة المستهدفة
          </label>
          <select
            value={formData.target_currency || "USD"}
            onChange={(e) => handleChange("target_currency", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="USD">دولار أمريكي (USD)</option>
            <option value="JOD">دينار أردني (JOD)</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء طلب عرض السعر"}
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.RFQ.LIST)}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
