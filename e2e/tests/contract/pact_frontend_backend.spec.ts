/**
 * Contract tests generated from FastAPI's own OpenAPI schema (/openapi.json)
 * rather than hand-written Pact consumer contracts — the brief allows
 * either "Pact or schemathesis"; this uses a lightweight JS-native
 * equivalent of schemathesis's approach (schema-driven response validation)
 * since schemathesis itself is Python-only and this suite is a Node/Playwright
 * project. For each representative endpoint, a real request is made against
 * the real running backend and the response body is validated against the
 * exact JSON schema FastAPI declared for that operation/status code —
 * catching response-shape drift between backend and the schema it publishes
 * (which the frontend's TypeScript types are hand-kept in sync with).
 *
 * Requires docker-compose.test.yml running — not runnable in the sandbox
 * this was written in (no Docker there).
 */
import { test, expect } from "@playwright/test";
import Ajv from "ajv";
import { API_BASE_URL, createAgentUser, createClientUser } from "../helpers/testUsers";

let openapiDoc: any;

test.beforeAll(async ({ request }) => {
  const resp = await request.get(`${API_BASE_URL}/openapi.json`);
  expect(resp.ok()).toBeTruthy();
  openapiDoc = await resp.json();
});

/** Resolves `$ref` pointers (e.g. "#/components/schemas/TokenResponse")
 * against the full OpenAPI document, recursively, producing a
 * self-contained JSON schema Ajv can compile without cross-document refs. */
function dereference(node: any, doc: any, seen = new Set<any>()): any {
  if (node === null || typeof node !== "object") return node;
  if (seen.has(node)) return {}; // break cycles defensively
  seen.add(node);

  if (typeof node.$ref === "string" && node.$ref.startsWith("#/")) {
    const path = node.$ref.slice(2).split("/");
    let target = doc;
    for (const segment of path) target = target[segment];
    return dereference(target, doc, seen);
  }

  if (Array.isArray(node)) return node.map((n) => dereference(n, doc, seen));

  const result: any = {};
  for (const [key, value] of Object.entries(node)) {
    result[key] = dereference(value, doc, seen);
  }
  return result;
}

function getResponseSchema(path: string, method: string, status: string): any {
  const operation = openapiDoc.paths[path]?.[method];
  expect(operation, `OpenAPI schema should declare ${method.toUpperCase()} ${path}`).toBeTruthy();
  const schema = operation.responses[status]?.content?.["application/json"]?.schema;
  expect(schema, `${method.toUpperCase()} ${path} should declare a ${status} JSON response schema`).toBeTruthy();
  return dereference(schema, openapiDoc);
}

function validateAgainstSchema(schema: any, body: unknown) {
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(body);
  if (!valid) {
    throw new Error(`Response did not match schema: ${JSON.stringify(validate.errors, null, 2)}`);
  }
}

test.describe("OpenAPI schema coverage", () => {
  test("the schema is served and covers the routers found in Phase 0 exploration", async () => {
    expect(openapiDoc.paths).toBeTruthy();
    const expectedPrefixes = [
      "/api/v1/auth", "/api/v1/intake", "/api/v1/documents", "/api/v1/pricing",
      "/api/v1/quotes", "/api/v1/catalog", "/api/v1/admin", "/api/v1/chat",
      "/api/v1/notifications",
    ];
    const declaredPaths = Object.keys(openapiDoc.paths);
    for (const prefix of expectedPrefixes) {
      expect(declaredPaths.some((p) => p.startsWith(prefix)), `no path found under ${prefix}`).toBeTruthy();
    }
  });
});

test.describe("Response bodies match their declared OpenAPI schema", () => {
  test("POST /auth/register response matches schema", async ({ request }) => {
    const email = `contract-test-${Date.now()}@example.com`;
    const resp = await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email, password: "TestPass123!", full_name: "Contract Test",
        role: "client", company_name: "Contract Test Co.",
      },
    });
    expect(resp.status()).toBe(201);
    const schema = getResponseSchema("/api/v1/auth/register", "post", "201");
    validateAgainstSchema(schema, await resp.json());
  });

  test("POST /auth/login response matches schema", async ({ request }) => {
    const client = await createClientUser(request);
    const resp = await request.post(`${API_BASE_URL}/auth/login`, {
      data: { email: client.email, password: client.password },
    });
    expect(resp.status()).toBe(200);
    const schema = getResponseSchema("/api/v1/auth/login", "post", "200");
    validateAgainstSchema(schema, await resp.json());
  });

  test("GET /catalog/products response matches schema", async ({ request }) => {
    const agent = await createAgentUser(request);
    const login = await request.post(`${API_BASE_URL}/auth/login`, {
      data: { email: agent.email, password: agent.password },
    });
    const { access_token } = await login.json();

    const resp = await request.get(`${API_BASE_URL}/catalog/products`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(resp.status()).toBe(200);
    const schema = getResponseSchema("/api/v1/catalog/products", "get", "200");
    validateAgainstSchema(schema, await resp.json());
  });

  test("GET /intake/rfqs (list) response matches schema", async ({ request }) => {
    const agent = await createAgentUser(request);
    const login = await request.post(`${API_BASE_URL}/auth/login`, {
      data: { email: agent.email, password: agent.password },
    });
    const { access_token } = await login.json();

    const resp = await request.get(`${API_BASE_URL}/intake/rfqs`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(resp.status()).toBe(200);
    const schema = getResponseSchema("/api/v1/intake/rfqs", "get", "200");
    validateAgainstSchema(schema, await resp.json());
  });

  test("401 error responses match the declared error schema", async ({ request }) => {
    const resp = await request.get(`${API_BASE_URL}/admin/stats`);
    expect(resp.status()).toBe(401);
    // FastAPI's default error responses aren't always explicitly declared
    // per-status in the schema — only assert this if one is present, since
    // an undeclared error schema is itself worth knowing about but isn't
    // this test's job to enforce.
    const operation = openapiDoc.paths["/api/v1/admin/stats"]?.get;
    if (operation?.responses?.["401"]) {
      const schema = getResponseSchema("/api/v1/admin/stats", "get", "401");
      validateAgainstSchema(schema, await resp.json());
    }
  });
});
