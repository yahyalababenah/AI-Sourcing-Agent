/**
 * Full auth cycle for every real backend role, plus session invalidation:
 * log in as client / agent / admin (the backend only has these 3 roles —
 * UserRole enum in app/modules/auth/models.py — the UI's 3rd "مورّد"/supplier
 * login tab on LoginPage is cosmetic and maps to the same "agent" role, not
 * a distinct 4th backend role), log out, then try reusing the old access
 * token directly against the API — it must be rejected. This specifically
 * tests real session invalidation (Redis `session_invalidated:{user_id}`
 * timestamp check in app/modules/auth/dependencies.py), not just that the
 * frontend deleted its local token copy.
 *
 * Requires docker-compose.test.yml running with real Redis reachable (this
 * check is fail-open if Redis is unreachable — see TESTING_FINDINGS.md #5/#5b —
 * so this test is only meaningful when Redis genuinely is up, which it is
 * in the docker-compose.test.yml topology). Not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect } from "@playwright/test";
import { createAgentUser, createClientUser, API_BASE_URL } from "./helpers/testUsers";
import { createAdminUserDirectly } from "./helpers/testDb";
import { loginViaUi } from "./helpers/uiAuth";

test.describe("full auth cycle per role", () => {
  for (const role of ["client", "agent", "admin"] as const) {
    test(`${role}: login -> use app -> logout -> old access token is rejected`, async ({
      browser, request,
    }) => {
      let email: string;
      let password: string;

      if (role === "admin") {
        email = `e2e-admin-${Date.now()}@example.com`;
        password = "TestPass123!";
        await createAdminUserDirectly(email, password);
      } else if (role === "agent") {
        const user = await createAgentUser(request);
        email = user.email;
        password = user.password;
      } else {
        const user = await createClientUser(request);
        email = user.email;
        password = user.password;
      }

      const context = await browser.newContext();
      const page = await context.newPage();

      await loginViaUi(page, email, password);

      // Capture the live access token from localStorage after a real login.
      const accessTokenBeforeLogout = await page.evaluate(() => localStorage.getItem("access_token"));
      expect(accessTokenBeforeLogout).toBeTruthy();

      // Confirm the token actually works before logout.
      const meBeforeLogout = await request.get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessTokenBeforeLogout}` },
      });
      expect(meBeforeLogout.ok()).toBeTruthy();

      // Log out through the real UI — Topbar.tsx's logout button (shared
      // across ClientLayout/AgentLayout/AdminLayout) is icon-only with a
      // `title` tooltip, no visible text.
      await page.getByTitle("تسجيل الخروج").click();
      await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });

      // The real regression check: the OLD access token — issued before
      // logout — must now be rejected, proving session invalidation is
      // enforced server-side (Redis session_invalidated timestamp check),
      // not just that the frontend forgot its copy of the token.
      const meAfterLogout = await request.get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessTokenBeforeLogout}` },
      });
      expect(meAfterLogout.status()).toBe(401);

      await context.close();
    });
  }
});
