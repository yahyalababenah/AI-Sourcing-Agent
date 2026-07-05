import type { UserRole } from "@/types/auth";

/** Application route paths. */
export const ROUTES = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
  },
  ADMIN: {
    LOGIN: "/admin/login",
    DASHBOARD: "/admin/dashboard",
    VERIFICATION: "/admin/verification",
    MONITOR: "/admin/monitor",
    HS_CODES: "/admin/hs-codes",
  },
  // Role-scoped home screens (see CLAUDE.md — each role gets its own dashboard route).
  AGENT: {
    DASHBOARD: "/agent/dashboard",
    REELS: "/agent/reels",
  },
  CLIENT: {
    DASHBOARD: "/client/dashboard",
    REELS: "/client/reels",
  },
  // Generic gateway — resolves to the role-scoped dashboard above at render time.
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
    // Lives under /agent because only agents/admins calculate pricing.
    CALCULATE: "/agent/calculator",
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

/** Resolves the correct dashboard path for a given role (defaults to agent). */
export function dashboardPathForRole(role: UserRole | null): string {
  if (role === "client") return ROUTES.CLIENT.DASHBOARD;
  if (role === "admin") return ROUTES.ADMIN.DASHBOARD;
  return ROUTES.AGENT.DASHBOARD;
}
