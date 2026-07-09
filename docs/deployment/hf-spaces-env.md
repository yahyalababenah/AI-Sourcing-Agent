# Hugging Face Spaces — Required Environment Variables

The HF Spaces deployment (`Dockerfile` / `entrypoint.hf.sh`) runs a single `uvicorn`
process against external services (Supabase Postgres + Upstash Redis). It does **not**
bundle a Celery worker. The admin health dashboard (`/health`) will show
services as disconnected/not_configured until the matching secrets below are set under
the Space's **Settings → Repository secrets**.

## ⚠️ MinIO is currently bundled in-container — TEMPORARY, single-demo-session only

As of the current `Dockerfile`/`entrypoint.hf.sh`, MinIO runs as a background
process *inside the same container* as the API (`minio server /data/minio`,
started by `entrypoint.hf.sh` before `uvicorn`), with `S3_ENDPOINT=http://localhost:9000`
and `S3_ACCESS_KEY`/`S3_SECRET_KEY=minioadmin` set as image defaults. This was done to
support a single live demo (catalog upload) without needing an external S3 account.

**Limits — do not treat this as a durable setup:**
- Storage lives at `/data/minio` inside the container's own filesystem — it is
  **ephemeral** and is **wiped on every Space restart, redeploy, or rebuild**.
  Any uploaded catalog/quotation PDF is lost when that happens.
- There is no replication, backup, or persistent volume behind it.
- For any use beyond a single demo session, switch back to a real external
  S3-compatible provider (Supabase Storage, Cloudflare R2, Backblaze, etc.) by
  overriding `S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY` as Space secrets —
  this takes priority over the in-image defaults in `app/config.py`.

| Health item | Env vars to set | Where the value comes from |
|---|---|---|
| MinIO (recommended for anything beyond a one-off demo) | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | An S3-compatible bucket (e.g. Supabase Storage or Cloudflare R2). Setting these overrides the in-container MinIO fallback (entrypoint skips starting MinIO entirely when `S3_ENDPOINT` is set). |
| Celery | `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` | Same Upstash Redis URL used for `REDIS_URL`. Without these, `app/shared/celery_app.py` falls back to `redis://...@redis:6379/1` (also a docker-compose-only hostname). |
| LLM | `DEEPSEEK_API_KEY` (tried first), `OPENROUTER_API_KEY`, or `TOGETHER_API_KEY` | DeepSeek, OpenRouter, or Together API key. |

## Celery caveat — this one won't fully go green on HF Spaces

Even after setting `CELERY_BROKER_URL`/`CELERY_RESULT_BACKEND` correctly, the health
check pings a live worker (`celery_app.control.inspect(...).ping()`). HF Spaces runs a
single container/process and cannot host a Celery worker alongside the API. Options:

- Deploy a small always-on worker process elsewhere (Railway, Fly.io, a VPS) pointed at
  the same Redis broker — this is the only way to make "Celery: connected" possible.
- Otherwise, treat "Celery: disconnected" as expected on this deployment target and only
  chase it if a feature that depends on background tasks (e.g. async document/OCR
  processing) is actually needed there.
