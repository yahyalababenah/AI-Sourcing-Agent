// AI-Sourcing Hub — Design Tokens
// انسخ هذا الملف إلى: lib/tokens.ts
// واستورده في tailwind.config.ts

export const colors = {
  supplier: {
    50:  "#E1F5EE",
    100: "#9FE1CB",
    400: "#1D9E75",
    500: "#10B981",
    600: "#0F6E56",
    900: "#04342C",
  },
  importer: {
    50:  "#E8F1F8",
    100: "#C5DDF0",
    400: "#3B82C4",
    500: "#1D6FB8",
    600: "#15568F",
    900: "#0B2E4F",
  },
  brand: {
    50:  "#ECFDF5",
    100: "#D1FAE5",
    500: "#10B981",
    600: "#0F6E56",
    900: "#065F46",
  },
} as const

export const fonts = {
  arabic: "Cairo",
  latin:  "Inter",
  chinese: "Noto Sans SC",
} as const

export const locales = ["ar", "en", "zh"] as const
export const defaultLocale = "ar" as const
export type Locale = typeof locales[number]

export const roleColors = {
  agent:  "supplier",
  client: "importer",
  admin:  "slate",
} as const
