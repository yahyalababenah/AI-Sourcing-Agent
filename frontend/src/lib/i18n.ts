import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "@/locales/ar/common.json";
import en from "@/locales/en/common.json";
import zh from "@/locales/zh/common.json";
import { locales, defaultLocale, fonts, type Locale } from "@/lib/tokens";

const dirByLocale: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
  zh: "ltr",
};

const fontByLocale: Record<Locale, string> = {
  ar: fonts.arabic,
  en: fonts.latin,
  zh: fonts.chinese,
};

/** Applies <html lang/dir> and the base font family for the active locale. */
export function applyLocaleToDocument(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = dirByLocale[locale];
  document.documentElement.style.setProperty("--locale-font", fontByLocale[locale]);
}

i18n.use(initReactI18next).init({
  resources: {
    ar: { common: ar },
    en: { common: en },
    zh: { common: zh },
  },
  lng: (localStorage.getItem("ai-sourcing-locale") as Locale) || defaultLocale,
  fallbackLng: defaultLocale,
  supportedLngs: [...locales],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("ai-sourcing-locale", lng);
  applyLocaleToDocument(lng as Locale);
});

applyLocaleToDocument(i18n.language as Locale);

export default i18n;
