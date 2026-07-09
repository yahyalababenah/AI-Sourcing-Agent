# AI-Sourcing Hub — Railway Deployment Guide

## Architecture on Railway

```
┌─────────────────────────────────────────────────────────┐
│                   Railway Project                        │
│                                                          │
│  ┌──────────┐    ┌───────────────┐  ┌────────────────┐  │
│  │   API    │    │ Celery Worker │  │  Celery Beat   │  │
│  │  :8000   │    │  (background) │  │  (scheduler)   │  │
│  └────┬─────┘    └───────┬───────┘  └───────┬────────┘  │
│       │                  │                  │           │
│  ┌────▼──────────────────▼──────────────────▼────────┐  │
│  │              Railway Redis (add-on)                │  │
│  └────────────────────────────────────────────────────┘  │
│       │                                                  │
│  ┌────▼──────────────────────────────────────────────┐   │
│  │           Railway PostgreSQL (add-on)              │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────┐    ┌───────────────┐                       │
│  │  MinIO   │    │   ChromaDB    │  (optional services)  │
│  └──────────┘    └───────────────┘                       │
└──────────────────────────────────────────────────────────┘
```

**Key differences from Docker Compose:**
- No nginx — Railway handles SSL/domain/routing automatically
- No docker-compose — each service deploys independently
- Managed PostgreSQL and Redis — Railway provides connection strings
- Public URL auto-assigned to the API service (e.g., `https://aisourcing-hub-api.up.railway.app`)

---

## 1. Prerequisites

- [Railway account](https://railway.app) (free tier: $5 credit, no credit card required)
- GitHub account (Railway deploys from GitHub repos)
- Your API keys: OpenRouter, Together AI, Exchange Rate API
- External S3-compatible storage (Backblaze B2 recommended — 10GB free)

---

## 2. Project Setup

### 2.1 Push to GitHub

```bash
git remote add origin https://github.com/your-org/ai-sourcing-hub.git
git push -u origin main
```

### 2.2 Create Railway Project

1. Go to [railway.app](https://railway.app) → Dashboard → **New Project**
2. Select **"Deploy from GitHub repo"**
3. Choose your `ai-sourcing-hub` repository
4. Railway auto-detects the [`Dockerfile`](Dockerfile) and [`.dockerignore`](.dockerignore)
5. The **[`railway.json`](railway.json)** config sets:
   - Builder: `DOCKERFILE`
   - Start command: `./scripts/entrypoint.sh`
   - Health check: `/health`
   - Restart: on failure, max 10 retries

---

## 3. Add Managed Services

### 3.1 PostgreSQL

1. In Railway dashboard, click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway provides `DATABASE_URL` automatically
3. **Important:** The app uses `postgresql+asyncpg://` (async driver). Railway's `DATABASE_URL` uses `postgresql://`.  
   You need to set a custom variable — see [Step 4.2](#42-set-environment-variables).

### 3.2 Redis

1. Click **"+ New"** → **"Database"** → **"Add Redis"**
2. Railway provides `REDIS_URL` automatically (e.g., `redis://default:password@host:port`)

---

## 4. Configure Environment Variables

### 4.1 Required Variables

| Variable | Source | Example |
|----------|--------|---------|
| `DATABASE_URL` | Custom (see below) | `postgresql+asyncpg://user:pass@host:5432/railway` |
| `REDIS_URL` | Railway Redis add-on | `redis://default:password@host:6379` |
| `CELERY_BROKER_URL` | Custom (Redis + DB 1) | `redis://default:password@host:6379/1` |
| `CELERY_RESULT_BACKEND` | Custom (Redis + DB 2) | `redis://default:password@host:6379/2` |
| `JWT_SECRET` | Generate yourself | `openssl rand -base64 48` |
| `ENVIRONMENT` | Set manually | `production` |
| `CORS_ORIGINS` | Your frontend URL | `https://your-frontend.vercel.app` |
| `ALLOWED_HOSTS` | Railway domain + custom | `aisourcing-hub-api.up.railway.app,your-domain.com` |

### 4.2 Setting `DATABASE_URL` for AsyncPG

Railway's PostgreSQL add-on provides `DATABASE_URL` with the `postgresql://` scheme, but SQLAlchemy async mode requires `postgresql+asyncpg://`.

**Solution:** Set a custom `DATABASE_URL` variable with the modified scheme:

1. In Railway dashboard, click your **API service** → **Variables** tab
2. Add a new variable:
   ```
   DATABASE_URL = postgresql+asyncpg://<user>:<password>@<host>:<port>/<database>
   ```
   Replace `<user>`, `<password>`, `<host>`, `<port>`, `<database>` with values from Railway's PostgreSQL add-on (viewable in PostgreSQL service → **Connect** tab)

### 4.3 Setting Celery Redis URLs

Since Celery uses separate Redis databases (DB 1 for broker, DB 2 for backend):

1. Copy the `REDIS_URL` value from your Redis add-on (e.g., `redis://default:abc123@redis-123.railway.internal:6379`)
2. Set these custom variables:
   ```
   CELERY_BROKER_URL = redis://default:abc123@redis-123.railway.internal:6379/1
   CELERY_RESULT_BACKEND = redis://default:abc123@redis-123.railway.internal:6379/2
   ```

### 4.4 API Keys

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | Yes | LLM provider (free tier) |
| `TOGETHER_API_KEY` | Optional | Fallback LLM provider |
| `EXCHANGE_RATE_API_KEY` | Optional | Currency conversion |
| `SENTRY_DSN` | Optional | Error tracking |

### 4.5 Storage (S3-Compatible)

Railway doesn't provide managed S3 storage. You need an external provider:

**Option A: Backblaze B2 (Recommended — 10GB free)**

1. Create [Backblaze B2 account](https://www.backblaze.com/b2/sign-up.html)
2. Create a bucket and generate App Keys
3. Set variables:
   ```
   MINIO_ENDPOINT = s3.us-west-001.backblazeb2.com
   MINIO_ACCESS_KEY = <your-backblaze-key-id>
   MINIO_SECRET_KEY = <your-backblaze-application-key>
   MINIO_SECURE = true
   STORAGE_BUCKET_DOCUMENTS = aisourcing-documents
   STORAGE_BUCKET_QUOTES = aisourcing-quotes
   ```

**Option B: AWS S3**

```
MINIO_ENDPOINT = s3.amazonaws.com
MINIO_ACCESS_KEY = <aws-access-key>
MINIO_SECRET_KEY = <aws-secret-key>
MINIO_SECURE = true
STORAGE_BUCKET_DOCUMENTS = aisourcing-documents
STORAGE_BUCKET_QUOTES = aisourcing-quotes
```

> **Note:** The app uses `MINIO_*` env var names but works with any S3-compatible service. The underlying client is `boto3`.

---

## 5. Create Additional Railway Services

The [`railway.json`](railway.json) configures the **API** service. You need to create 2 more services from the same repo for background tasks.

### 5.1 Celery Worker Service

1. In your Railway project, click **"+ New"** → **"GitHub Repo"** → select the same repo
2. Go to the new service → **Settings** → **Start Command**:
   ```
   celery -A app.shared.celery_app worker --loglevel=info --concurrency=2 --max-tasks-per-child=10
   ```
3. **Settings** → enable **"Public Networking"**: **OFF** (this is a background worker, no HTTP)

### 5.2 Celery Beat Service

1. Click **"+ New"** → **"GitHub Repo"** → select the same repo again
2. Go to the new service → **Settings** → **Start Command**:
   ```
   celery -A app.shared.celery_app beat --loglevel=info
   ```
3. **Settings** → enable **"Public Networking"**: **OFF**

### 5.3 ChromaDB Service (Optional)

If you need vector search capabilities:

1. Click **"+ New"** → **"GitHub Repo"** → search for `chromadb/chroma`
2. Or use **"Blank Service"** with the `chromadb/chroma:latest` Docker image
3. Add a volume for persistence:
   - **Settings** → **"+ Add Volume"** → mount at `/chroma/data`
4. Set environment variables:
   ```
   IS_PERSISTENT = TRUE
   PERSIST_DIRECTORY = /chroma/data
   ANONYMIZED_TELEMETRY = FALSE
   ```

### 5.4 MinIO Service (Optional, Alternative to External S3)

If you prefer to run MinIO on Railway instead of using external S3:

1. Click **"+ New"** → **"GitHub Repo"** → search for `minio/minio`
2. **Settings** → **Start Command**:
   ```
   minio server /data --console-address ":9001"
   ```
3. Add a volume mounted at `/data`
4. Set environment variables:
   ```
   MINIO_ROOT_USER = <your-access-key>
   MINIO_ROOT_PASSWORD = <your-secret-key>
   ```
5. **Settings** → enable **"Public Networking"**: `9000`
6. Update your API service's variables:
   ```
   MINIO_ENDPOINT = <minio-service-name>.railway.internal:9000
   MINIO_ACCESS_KEY = <same-as-MINIO_ROOT_USER>
   MINIO_SECRET_KEY = <same-as-MINIO_ROOT_PASSWORD>
   MINIO_SECURE = false
   ```

---

## 6. Deploy

### 6.1 Initial Deploy

1. After setting up all services and variables, Railway auto-deploys
2. Monitor the deployment logs:
   ```
   Railway Dashboard → API Service → Deployments → View Logs
   ```

### 6.2 Verify Deployment

```bash
# Health check
curl -f https://<your-railway-domain>.railway.app/health

# Expected response:
# {"status":"healthy","database":"connected","redis":"connected"}
```

### 6.3 Subsequent Deploys

Push to GitHub — Railway auto-deploys on every push to the default branch:

```bash
git push origin main
```

To disable auto-deploy: **Settings** → **"Auto Deploy"** → toggle OFF

---

## 7. Seed Data

After deployment, seed the pricing rules:

```bash
# Via Railway dashboard → API Service → "Connect" → "Shell"
python scripts/seed_pricing_rules.py
```

Or trigger via a temporary deploy:
```bash
railway run python scripts/seed_pricing_rules.py
```

---

## 8. Custom Domain (Optional)

1. **Settings** → **"Public Networking"** → **"Generate Domain"** (free `*.railway.app` domain)
2. Or **"Custom Domain"**:
   - Add your domain (e.g., `api.aisourcing.example.com`)
   - Add the `CNAME` record provided by Railway to your DNS
   - Railway auto-provisions SSL via Let's Encrypt

---

## 9. Monitoring

- **Logs**: Railway Dashboard → each service → **"Deployments"** → **"View Logs"**
- **Metrics**: Railway provides basic CPU/memory graphs per service
- **Prometheus**: If you add a monitoring service, the `/metrics` endpoint exposes application metrics
- **Sentry**: If `SENTRY_DSN` is set, errors are reported automatically

---

## 10. Environment Variable Reference

Set these in **API Service** → **Variables** tab:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Must use `postgresql+asyncpg://` scheme |
| `REDIS_URL` | ✅ | Auto-provided by Railway Redis add-on |
| `CELERY_BROKER_URL` | ✅ | Same as Redis with `/1` database |
| `CELERY_RESULT_BACKEND` | ✅ | Same as Redis with `/2` database |
| `JWT_SECRET` | ✅ | Generate: `openssl rand -base64 48` |
| `ENVIRONMENT` | ✅ | Set to `production` |
| `CORS_ORIGINS` | ✅ | Frontend URL(s), comma-separated |
| `ALLOWED_HOSTS` | ✅ | Railway domain + custom domains |
| `OPENROUTER_API_KEY` | ✅ | Primary LLM provider |
| `TOGETHER_API_KEY` | ❌ | Fallback LLM provider |
| `MINIO_ENDPOINT` | ✅ | S3 endpoint for document storage |
| `MINIO_ACCESS_KEY` | ✅ | S3 access key |
| `MINIO_SECRET_KEY` | ✅ | S3 secret key |
| `MINIO_SECURE` | ✅ | `true` for external S3, `false` for internal MinIO |
| `STORAGE_BUCKET_DOCUMENTS` | ✅ | S3 bucket name |
| `STORAGE_BUCKET_QUOTES` | ✅ | S3 bucket name |
| `EXCHANGE_RATE_API_KEY` | ❌ | For auto-refresh |
| `SENTRY_DSN` | ❌ | Error tracking |
| `LOG_LEVEL` | ❌ | Default: `info` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ❌ | Default: 15 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | ❌ | Default: 7 |

Variables marked ❌ are optional.

---

## 11. Troubleshooting

### 11.1 API Container Restarting in Loop

**Symptom:** API service keeps restarting.

**Diagnosis:** Check deployment logs for startup errors.

**Common causes:**
- `DATABASE_URL` has `postgresql://` instead of `postgresql+asyncpg://` → fix the scheme
- Database not ready yet → wait for PostgreSQL add-on to finish provisioning
- Missing `JWT_SECRET` or too short → set a 48-char base64 secret
- Invalid `ALLOWED_HOSTS` → include the Railway domain

### 11.2 Celery Worker Not Processing Tasks

**Symptom:** Tasks submitted but never execute.

**Diagnosis:**
- Check worker logs in Railway dashboard
- Verify `CELERY_BROKER_URL` matches `REDIS_URL` with `/1` database suffix
- Ensure worker uses the same Docker image

### 11.3 S3 Connection Failed

**Symptom:** Document upload fails with storage error.

**Diagnosis:**
- Verify `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` are correct
- If using external S3, ensure `MINIO_SECURE=true`
- For Backblaze B2, ensure the endpoint format is correct

### 11.4 Health Check Failing

**Symptom:** Railway shows "Unhealthy" status.

**Diagnosis:**
- Manually hit `/health` endpoint
- Check deployment logs
- Verify database and Redis connections

---

## 12. Cost Estimates (Railway Free Tier)

| Service | Cost | Notes |
|---------|------|-------|
| PostgreSQL | $0 | 1 free project, shared CPU, 1GB RAM |
| Redis | $0 | Included in free tier |
| API (1 replica) | $0 | 500 hours/month free |
| Celery Worker (1 replica) | $0 | 500 hours/month free |
| Celery Beat (1 replica) | $0 | Minimal usage |
| **Total** | **$0** | Stays within free tier for small projects |

> **Tip:** Railway gives $5 free credit (no credit card required). The free tier covers small-to-medium workloads easily.
