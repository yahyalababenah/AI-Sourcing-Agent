import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { Client } from "pg";

/** Direct connection to docker-compose.test.yml's postgres_test service —
 * used only for test setup/manipulation (e.g. simulating time passage for
 * exclusive_deadline) that has no equivalent through the UI or API. */
export function connectTestDb(): Client {
  const client = new Client({
    host: process.env.PLAYWRIGHT_DB_HOST || "localhost",
    port: Number(process.env.PLAYWRIGHT_DB_PORT || 5433),
    user: "test_user",
    password: "test_password_123",
    database: "aisourcing_test",
  });
  return client;
}

export async function setRfqExclusiveDeadlineInPast(rfqId: string): Promise<void> {
  const client = connectTestDb();
  await client.connect();
  try {
    await client.query(
      "UPDATE rfqs SET exclusive_deadline = NOW() - INTERVAL '1 hour' WHERE id = $1",
      [rfqId],
    );
  } finally {
    await client.end();
  }
}

/** Forces a specific RFQMatch's response_deadline into the past, so the
 * `expire-stale-matches` Celery Beat task (triggered via celery.ts) will
 * flip its status from `pending` to `expired` on its next run — used to
 * test the "responded after the 3-hour exclusive window" scenario without
 * an actual multi-hour wait. */
export async function setMatchResponseDeadlineInPast(matchId: string): Promise<void> {
  const client = connectTestDb();
  await client.connect();
  try {
    await client.query(
      "UPDATE rfq_matches SET response_deadline = NOW() - INTERVAL '1 hour' WHERE id = $1",
      [matchId],
    );
  } finally {
    await client.end();
  }
}

/**
 * Forces an RFQ into the exact backend state `match_rfq_to_suppliers()`
 * (app/modules/intake/matcher.py) leaves behind when it genuinely finds zero
 * matching suppliers: `is_public = true`, no matched supplier ids, and no
 * RFQMatch rows. Applied *after* a real "تشغيل المطابقة" click in the UI —
 * this only makes the zero-match outcome deterministic regardless of what
 * other suppliers/categories other tests may have created concurrently in
 * the same shared docker-compose.test.yml database; it does not replace
 * exercising the real matching endpoint.
 */
export async function forceRfqNoMatchFound(rfqId: string): Promise<void> {
  const client = connectTestDb();
  await client.connect();
  try {
    await client.query("DELETE FROM rfq_matches WHERE rfq_id = $1", [rfqId]);
    await client.query(
      "UPDATE rfqs SET is_public = true, matched_supplier_ids = NULL WHERE id = $1",
      [rfqId],
    );
  } finally {
    await client.end();
  }
}

/**
 * Creates an admin user via a direct row insert. `POST /api/v1/auth/register`
 * only accepts self-registration for client/agent roles (admin is rejected
 * — see TESTING_FINDINGS.md F3), and there is no admin-only "create user
 * with arbitrary role" endpoint yet, so this direct insert remains the only
 * way to provision an admin test account.
 */
export async function createAdminUserDirectly(
  email: string,
  password: string,
  fullName = "E2E Test Admin",
): Promise<string> {
  const client = connectTestDb();
  await client.connect();
  try {
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'admin', true, NOW(), NOW())`,
      [id, email, passwordHash, fullName],
    );
    return id;
  } finally {
    await client.end();
  }
}
