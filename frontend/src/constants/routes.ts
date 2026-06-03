/** Application route paths. */
export const ROUTES = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
  },
  ADMIN: {
    LOGIN: "/admin/login",
  },
  DASHBOARD: "/dashboard",
  RFQ: {
    LIST: "/rfq",
    CREATE: "/rfq/create",
    DETAIL: (id: string) => `/rfq/${id}`,
  },
  DOCUMENTS: {
    UPLOAD: "/documents/upload",
    DETAIL: (id: string) => `/documents/${id}`,
  },
  PRICING: {
    RULES: "/pricing/rules",
    CALCULATE: "/pricing/calculate",
  },
  QUOTES: {
    LIST: "/quotes",
    DETAIL: (id: string) => `/quotes/${id}`,
    PDF: (id: string) => `/quotes/${id}/pdf`,
  },
  SETTINGS: "/settings",
} as const;
