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
    SUPPLIER_INBOX: "/rfq/supplier-inbox",
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
  CATALOG: {
    MARKETPLACE: "/marketplace",
  },
  ORDERS: {
    LIST: "/orders",
    TRACKING: (id: string) => `/orders/${id}/tracking`,
  },
  SETTINGS: "/settings",
} as const;
