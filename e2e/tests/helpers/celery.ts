import { execSync } from "child_process";

/**
 * Forces the real `expire-stale-matches` Celery task to run immediately
 * inside the docker-compose.test.yml `celery_worker_test` container, rather
 * than waiting up to 5 minutes for Celery Beat's real schedule (every 5
 * minutes, per app/shared/celery_app.py) to fire naturally.
 * This still exercises the real, confirmed-existing task (see
 * TESTING_FINDINGS.md finding #7 / Phase 0) — it just skips the wait.
 */
export function triggerExpireStaleMatchesTask(): void {
  execSync(
    "docker compose -f ../docker-compose.test.yml exec -T celery_worker_test " +
      'celery -A app.shared.celery_app call expire-stale-matches',
    { stdio: "inherit" },
  );
}
