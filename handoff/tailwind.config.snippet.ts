// أضف هذا داخل theme.extend في tailwind.config.ts
import { colors, fonts } from "./lib/tokens"

// theme.extend:
const extend = {
  colors,
  fontFamily: {
    cairo:   [fonts.arabic,  "sans-serif"],
    inter:   [fonts.latin,   "sans-serif"],
    noto:    [fonts.chinese, "sans-serif"],
  },
}
