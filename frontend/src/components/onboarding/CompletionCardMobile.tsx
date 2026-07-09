import { useTranslation } from "react-i18next";
import { PartyPopper } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { roleAccent, type OnboardingRole } from "./roleAccent";

interface CompletionCardMobileProps {
  role: OnboardingRole;
  onDismiss: () => void;
}

export function CompletionCardMobile({ role, onDismiss }: CompletionCardMobileProps) {
  const { t } = useTranslation();
  const accent = roleAccent[role];
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end bg-slate-900/50 lg:hidden" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-card-title-mobile"
        className="rounded-t-2xl bg-white p-6 pb-8 text-center shadow-xl transition-all duration-200 motion-reduce:transition-none"
      >
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${accent.dotInactive}`}>
          <PartyPopper className={`h-7 w-7 ${accent.text}`} />
        </div>
        <h2 id="completion-card-title-mobile" className="mb-2 text-lg font-bold text-slate-900">
          {t("onboarding.completion.title")}
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          {t("onboarding.completion.subtitle")}
        </p>
        <button
          onClick={onDismiss}
          className={`w-full rounded-lg px-4 py-3 text-sm font-bold transition-all duration-150 active:scale-[0.98] ${accent.button}`}
        >
          {t("onboarding.completion.dismiss")}
        </button>
      </div>
    </div>
  );
}
