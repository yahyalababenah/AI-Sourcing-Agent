import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { locales, type Locale } from "@/lib/tokens";

// Native-script label for each language — shown in itself, not translated,
// matching the universal language-switcher convention (CLAUDE.md T11.2).
const LOCALE_LABELS: Record<Locale, string> = {
  ar: "عربي",
  en: "EN",
  zh: "中文",
};

// Sidebar/Drawer language switcher (T11.2). Rendered once inside Sidebar's
// footer so both the desktop sidebar and MobileDrawer (which reuses Sidebar
// with bare=true) get it for free — no separate placement needed.
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language as Locale;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2" dir="ltr">
      <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <div className="flex flex-1 items-center gap-1">
        {locales.map((locale) => (
          <button
            key={locale}
            onClick={() => i18n.changeLanguage(locale)}
            aria-pressed={current === locale}
            className={cn(
              "flex-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors duration-150 active:scale-[0.98]",
              current === locale
                ? "bg-brand-50 text-brand-600"
                : "text-slate-500 hover:bg-slate-50"
            )}
          >
            {LOCALE_LABELS[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}
