# Hugging Face Spaces — Required Environment Variables

This document lists all environment variables you need to configure under the HF Space's **Settings → Repository secrets**.

> **HF Space URL:** `https://yahyoha-ai-sourcing-hub.hf.space`

---

## 🔐 Required Secrets (set these)

| Variable | Description | Example / How to get |
|----------|-------------|----------------------|
| `DB_PASSWORD` | Supabase PostgreSQL password | Your Supabase project password (min 8 chars) |
| `DATABASE_URL` | Full Supabase connection string | `postgresql+asyncpg://postgres:[PASSWORD]@[HOST]:6543/postgres` |
| `REDIS_PASSWORD` | Upstash Redis password | Your Upstash Redis password (min 8 chars) |
| `REDIS_URL` | Upstash Redis connection string | `rediss://default:[PASSWORD]@[HOST]:6379` |
| `JWT_SECRET` | Secret key for JWT token signing | Generate with: `openssl rand -hex 64` (min 32 chars) |
| `ENVIRONMENT` | Deployment environment | `production` |

> **Note about `DATABASE_URL`:** Supabase uses port `6543` (not `5432`) for SSL-required connections. The driver *must* be `postgresql+asyncpg`. SSL is handled automatically via `connect_args` in `app/shared/database.py`.

---

## ⚡ Optional but Recommended

| Variable | Description | Why set it |
|----------|-------------|------------|
| `DEEPSEEK_API_KEY` | DeepSeek LLM API key | Enables RFQ translation & product extraction |
| `OPENROUTER_API_KEY` | OpenRouter API key (fallback) | Backup LLM provider |
| `TOGETHER_API_KEY` | Together AI API key (fallback) | Backup LLM provider |
| `EXCHANGE_RATE_API_KEY` | Exchange rate API key | Enables live currency conversion |
| `S3_ENDPOINT` | External S3 endpoint URL | Overrides ephemeral in-container MinIO for durable file storage |
| `S3_ACCESS_KEY` | S3 access key | Required when using external S3 |
| `S3_SECRET_KEY` | S3 secret key | Required when using external S3 |
| `S3_REGION` | S3 region | Default: `auto` (works for Supabase Storage / Cloudflare R2) |
| `CORS_ORIGINS` | Comma-separated allowed origins | e.g. `https://your-vercel-app.vercel.app,https://yahyoha-ai-sourcing-hub.hf.space` |
| `SENTRY_DSN` | Sentry error tracking DSN | For production error monitoring |
| `CELERY_BROKER_URL` | Celery broker (same Upstash Redis) | Required if you deploy a separate Celery worker |
| `CELERY_RESULT_BACKEND` | Celery result backend | Same Redis as broker |
| `OCR_LANG` | PaddleOCR language model | `en` (Latin), `ch` (Chinese+English), or `arabic` (Arabic script) |

---

## 🚀 Vercel Frontend — Environment Variables

| Variable | Description | Value |
|----------|-------------|-------|
| `VITE_API_URL` | Backend API base URL | `https://yahyoha-ai-sourcing-hub.hf.space/api/v1` |
| `VITE_APP_NAME` | Application name | `AI-Sourcing Hub` |
| `VITE_DEFAULT_LOCALE` | Default language | `ar` (Arabic) or `en` (English) |

---

## 🔍 Health Check

After deploying, verify:

```bash
# Backend health
curl https://yahyoha-ai-sourcing-hub.hf.space/health

# API docs
curl https://yahyoha-ai-sourcing-hub.hf.space/api/docs

# Frontend (once Vercel is configured)
# Visit your Vercel URL
```

Expected health output:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": "connected",
    "redis": "connected",
    "minio": "disconnected",
    "celery": "disabled",
    "llm": "not_configured"
  }
}
```

> **Note:** `minio: disconnected` is expected on HF Spaces unless you configure an external S3 provider. `celery: disabled` is expected — HF Spaces runs a single container. `llm: not_configured` will change once you add an LLM API key.
