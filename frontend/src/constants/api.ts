/** API endpoint constants matching the FastAPI router prefixes. */
export const API = {
  AUTH: {
    REGISTER: "/auth/register",
    LOGIN: "/auth/login",
    REFRESH: "/auth/refresh",
    ME: "/auth/me",
    LOGOUT: "/auth/logout",
  },
  INTAKE: {
    TRANSLATE: "/intake/translate",
    RFQS: "/intake/rfqs",
    RFQ: (id: string) => `/intake/rfqs/${id}`,
    RFQ_STATUS: (id: string) => `/intake/rfqs/${id}/status`,
    RFQ_PRODUCTS: (id: string) => `/intake/rfqs/${id}/products`,
  },
  DOCUMENTS: {
    UPLOAD: "/documents/upload",
    LIST: (rfqId: string) => `/documents/rfq/${rfqId}`,
    DOCUMENT: (id: string) => `/documents/${id}`,
    PROCESS: (id: string) => `/documents/${id}/process`,
    STATUS: (id: string) => `/documents/${id}/status`,
    ITEMS: (id: string) => `/documents/${id}/items`,
  },
  PRICING: {
    RULES: "/pricing/rules",
    RULE: (id: string) => `/pricing/rules/${id}`,
    RULE_HISTORY: (id: string) => `/pricing/rules/${id}/history`,
    CALCULATE: "/pricing/calculate",
    REFRESH_RATES: "/pricing/exchange-rates/refresh",
  },
  QUOTES: {
    LIST: "/quotes",
    CREATE: "/quotes",
    QUOTE: (id: string) => `/quotes/${id}`,
    STATUS: (id: string) => `/quotes/${id}/status`,
    GENERATE: "/quotes/generate",
    PDF: (id: string) => `/quotes/${id}/pdf`,
    FINALIZE: (id: string) => `/quotes/${id}/finalize`,
  },
} as const;
