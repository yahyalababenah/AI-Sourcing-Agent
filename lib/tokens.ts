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
    50:  "#E0E7FF",
    100: "#C7D2FE",
    400: "#6366F1",
    500: "#4F46E5",
    600: "#4338CA",
    900: "#312E81",
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
