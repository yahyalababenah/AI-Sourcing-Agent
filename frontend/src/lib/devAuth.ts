import type { User, UserRole } from "@/types/auth";

/**
 * Dev-only auth bypass — lets you browse role-protected internal pages while
 * editing the UI *without a running backend*. It seeds a fake authenticated
 * user into the auth store at startup so `ProtectedRoute` / `RoleGuard` let you
 * through instead of bouncing to `/auth/login`.
 *
 * Activated only when BOTH conditions hold:
 *   1. the app runs under `vite dev` — `import.meta.env.DEV` is ALWAYS false in
 *      a `vite build`, so this can never reach a production bundle; and
 *   2. `VITE_DEV_AUTH === "true"` is set in `frontend/.env.local` (gitignored).
 *
 * Choose which role to impersonate with `VITE_DEV_ROLE = agent | client | admin`
 * (defaults to "agent"). Change it and restart `npm run dev` to switch roles.
 */
export function getDevUser(): User | null {
  if (!import.meta.env.DEV) return null;
  if (import.meta.env.VITE_DEV_AUTH !== "true") return null;

  const role = (import.meta.env.VITE_DEV_ROLE as UserRole) || "agent";

  const labels: Record<UserRole, string> = {
    agent: "مطوّر (مندوب)",
    client: "مطوّر (مستورد)",
    admin: "مطوّر (أدمن)",
  };

  return {
    id: "dev-user",
    email: `dev-${role}@local.test`,
    full_name: labels[role] ?? labels.agent,
    role,
    is_active: true,
    created_at: new Date().toISOString(),
    // "completed" so the onboarding tour doesn't auto-launch over the page.
    onboarding_status: "completed",
    profile:
      role === "agent"
        ? {
            factory_name: "مصنع تجريبي",
            location_in_china: "Guangzhou",
            verification_status: "verified",
          }
        : role === "client"
          ? { company_name: "شركة تجريبية", preferred_port: "Aqaba" }
          : null,
  };
}
