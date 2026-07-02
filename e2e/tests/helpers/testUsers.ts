import type { APIRequestContext } from "@playwright/test";

/**
 * Creates a real user via a direct API call rather than through the app's
 * RegisterPage UI. RegisterPage.tsx does collect the required per-role
 * fields (company_name / factory_name+location_in_china — fixed, see
 * TESTING_FINDINGS.md F4) and is exercised directly by
 * `e2e_register_full_cycle.spec.ts`; specs unrelated to registration itself
 * use this API shortcut purely to avoid re-testing the same UI flow in
 * every spec that merely needs *a* logged-in user as a precondition.
 */
export const API_BASE_URL =
  process.env.PLAYWRIGHT_API_URL || "http://localhost:8001/api/v1";

export interface TestUser {
  email: string;
  password: string;
  full_name: string;
  role: "client" | "agent" | "admin";
}

const STRONG_PASSWORD = "TestPass123!"; // satisfies UserCreate.password_complexity

export async function createClientUser(
  request: APIRequestContext,
  overrides: Partial<TestUser & { company_name: string }> = {},
): Promise<TestUser> {
  const email = overrides.email ?? `e2e-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const payload = {
    email,
    password: STRONG_PASSWORD,
    full_name: overrides.full_name ?? "E2E Test Client",
    role: "client",
    company_name: overrides.company_name ?? "E2E Test Trading Co.",
    preferred_port: "Aqaba",
  };
  const resp = await request.post(`${API_BASE_URL}/auth/register`, { data: payload });
  if (!resp.ok()) {
    throw new Error(`Failed to create client test user: ${resp.status()} ${await resp.text()}`);
  }
  return { email, password: STRONG_PASSWORD, full_name: payload.full_name, role: "client" };
}

export async function createAgentUser(
  request: APIRequestContext,
  overrides: Partial<TestUser & { factory_name: string; location_in_china: string }> = {},
): Promise<TestUser> {
  const email = overrides.email ?? `e2e-agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const payload = {
    email,
    password: STRONG_PASSWORD,
    full_name: overrides.full_name ?? "E2E Test Agent",
    role: "agent",
    factory_name: overrides.factory_name ?? "E2E Test Factory",
    location_in_china: overrides.location_in_china ?? "Guangzhou, Guangdong",
  };
  const resp = await request.post(`${API_BASE_URL}/auth/register`, { data: payload });
  if (!resp.ok()) {
    throw new Error(`Failed to create agent test user: ${resp.status()} ${await resp.text()}`);
  }
  return { email, password: STRONG_PASSWORD, full_name: payload.full_name, role: "agent" };
}

/** Logs a user in via the API and returns their access + refresh tokens. */
export async function loginViaApi(request: APIRequestContext, email: string, password: string) {
  const resp = await request.post(`${API_BASE_URL}/auth/login`, { data: { email, password } });
  if (!resp.ok()) {
    throw new Error(`Login failed for ${email}: ${resp.status()} ${await resp.text()}`);
  }
  return resp.json() as Promise<{ access_token: string; refresh_token: string }>;
}

/** Creates a chat room between a client and a supplier via the API — the UI
 * path for initiating a new chat isn't what these specs are testing. */
export async function createChatRoom(
  request: APIRequestContext,
  clientAccessToken: string,
  supplierId: string,
): Promise<string> {
  const resp = await request.post(`${API_BASE_URL}/chat/rooms`, {
    headers: { Authorization: `Bearer ${clientAccessToken}` },
    data: { supplier_id: supplierId },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to create chat room: ${resp.status()} ${await resp.text()}`);
  }
  const room = await resp.json();
  return room.id as string;
}

/** Fetches a user's own id via /auth/me. */
export async function getUserId(request: APIRequestContext, accessToken: string): Promise<string> {
  const resp = await request.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to fetch current user: ${resp.status()} ${await resp.text()}`);
  }
  const me = await resp.json();
  return me.id as string;
}
