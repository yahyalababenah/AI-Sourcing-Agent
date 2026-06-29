/** Application route paths. */
export const ROUTES = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
  },
  ADMIN: {
    LOGIN: "/admin/login",
    VERIFICATION: "/admin/verification",
    MONITOR: "/admin/monitor",
  },
  DASHBOARD: "/dashboard",
  RFQ: {
    LIST: "/rfq",
    CREATE: "/rfq/create",
    DETAIL: (id: string) => `/rfq/${id}`,
    BUILD_QUOTE: (id: string) => `/rfq/${id}/build-quote`,
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
    SUPPLIER_SHOWROOM: (id: string) => `/marketplace/supplier/${id}`,
  },
  SUPPLIER: {
    MY_PRODUCTS: "/supplier/products",
    REVIEW: "/supplier/review",
  },
  ORDERS: {
    LIST: "/orders",
    TRACKING: (id: string) => `/orders/${id}/tracking`,
  },
  CHAT: {
    LIST: "/chat",
    ROOM: (id: string) => `/chat/${id}`,
  },
  SETTINGS: "/settings",
  PROFILE: "/profile",
} as const;
