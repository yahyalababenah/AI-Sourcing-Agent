import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Cairo", "IBM Plex Sans Arabic", "system-ui", "sans-serif"],
        cairo: ["Cairo", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        noto: ["Noto Sans SC", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Legacy shared accent — still used by pages not yet migrated to
        // the supplier/importer/brand tokens below (see lib/tokens.ts).
        primary: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        // Agent/supplier screens
        supplier: {
          50:  "#E1F5EE",
          100: "#9FE1CB",
          400: "#1D9E75",
          500: "#10B981",
          600: "#0F6E56",
          900: "#04342C",
        },
        // Client/importer screens
        importer: {
          50:  "#E8F1F8",
          100: "#C5DDF0",
          400: "#3B82C4",
          500: "#1D6FB8",
          600: "#15568F",
          900: "#0B2E4F",
        },
        // Platform-wide identity — sidebar, logo, shared chrome
        brand: {
          50:  "#ECFDF5",
          100: "#D1FAE5",
          500: "#10B981",
          600: "#0F6E56",
          900: "#065F46",
        },
      },
    },
  },
  plugins: [require("tailwindcss-rtl")],
};

export default config;
