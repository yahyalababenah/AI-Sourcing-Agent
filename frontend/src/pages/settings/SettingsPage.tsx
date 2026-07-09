import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { authService } from "@/services/authService";

export function SettingsPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const resetTour = useOnboardingStore((s) => s.resetTour);

  const handleRestartTour = () => {
    resetTour();
    authService.updateOnboardingStatus("pending").catch(() => {});
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="mt-1 text-sm text-gray-500">
          إعدادات الحساب والتفضيلات
        </p>
      </div>

      {/* Restart the interactive onboarding tour — only agent/client have one (see T16). */}
      {(role === "agent" || role === "client") && (
        <div className="card flex items-center justify-between p-4">
          <span className="text-sm font-medium text-gray-700">
            {t("onboarding.settings.restartTour")}
          </span>
          <button
            onClick={handleRestartTour}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition-all duration-150 hover:bg-brand-600 active:scale-[0.98]"
          >
            {t("onboarding.controls.startTour")}
          </button>
        </div>
      )}

      {/* Placeholder: Settings page will be implemented in later phase */}
      <div className="card p-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto h-12 w-12 text-gray-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-600">
          الإعدادات
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          سيتم تنفيذ صفحة الإعدادات في مرحلة لاحقة
        </p>
      </div>
    </div>
  );
}
