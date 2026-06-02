# AI-Sourcing Hub — Production Deployment Guide

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Configuration](#2-environment-configuration)
3. [SSL Certificate Provisioning](#3-ssl-certificate-provisioning)
4. [Building Images](#4-building-images)
5. [Deploying Services](#5-deploying-services)
6. [Verification](#6-verification)
7. [Monitoring & Logging](#7-monitoring--logging)
8. [Backup Strategy](#8-backup-strategy)
9. [Rollback Procedure](#9-rollback-procedure)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

### Hardware Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 10 GB SSD | 20 GB SSD |

> **Note:** This application calls external LLM APIs (OpenRouter, Together AI) — no local model inference. Resource requirements are driven by PostgreSQL, Redis, ChromaDB, and Celery worker concurrency.

### Software

- **Docker Engine** ≥ 24.x ([install guide](https://docs.docker.com/engine/install/))
- **Docker Compose Plugin** ≥ v2.24.x (included with Docker Desktop)
- **Git** ≥ 2.x
- **Domain name** with DNS `A` record pointing to your server's public IP
- **Ports 80** and **443** open in your firewall (HTTP/HTTPS)

### Verify Docker Installation

```bash
docker --version
docker compose version
```

Expected output:
```
Docker version 24.0.7, build afdd53b
Docker Compose version v2.24.2
```

---

## 2. Environment Configuration

### 2.1 Clone the Repository

```bash
git clone https://github.com/your-org/ai-sourcing-hub.git
cd ai-sourcing-hub
```

### 2.2 Copy Environment File

```bash
cp .env.example .env
```

### 2.3 Generate Secure Secrets

Generate strong random values for all sensitive variables:

```bash
# PostgreSQL password
echo "DB_PASSWORD=$(openssl rand -base64 32)" >> .env

# Redis password
echo "REDIS_PASSWORD=$(openssl rand -base64 32)" >> .env

# JWT secret (minimum 32 characters)
echo "JWT_SECRET=$(openssl rand -base64 48)" >> .env

# MinIO credentials
echo "MINIO_ACCESS_KEY=$(openssl rand -hex 12)" >> .env
echo "MINIO_SECRET_KEY=$(openssl rand -base64 40)" >> .env

# Sentry DSN (optional — leave blank if not using Sentry)
# echo "SENTRY_DSN=https://your-dsn@sentry.io/your-project" >> .env

# OpenRouter API key (required for LLM features)
# echo "OPENROUTER_API_KEY=sk-or-v1-..." >> .env
```

### 2.4 Configure Domain & Environment

Edit `.env` and set:

```bash
# Required: Your deployment domain
DOMAIN=api.aisourcing.example.com

# Application environment
ENVIRONMENT=production

# Log level (info, warning, error)
LOG_LEVEL=info

# CORS origins — comma-separated list of allowed frontend origins
CORS_ORIGINS=https://app.aisourcing.example.com

# Trusted hosts — comma-separated list of allowed Host headers
TRUSTED_HOSTS=api.aisourcing.example.com,localhost
```

### 2.5 Verify Configuration

```bash
docker compose config
```

This validates the compose files without starting services. If there are syntax errors, they will be reported here.

---

## 3. SSL Certificate Provisioning

### 3.1 Using Let's Encrypt (Recommended)

Install Certbot:

```bash
# On Ubuntu/Debian
sudo apt update && sudo apt install -y certbot

# On CentOS/RHEL
sudo dnf install -y certbot
```

Obtain certificate (standalone mode — requires port 80 to be free):

```bash
sudo certbot certonly --standalone \
    -d api.aisourcing.example.com \
    --non-interactive \
    --agree-tos \
    --email admin@example.com
```

### 3.2 Using Certbot with Docker (Alternative)

```bash
# Run certbot in Docker — port 80 must be available
docker run --rm -p 80:80 \
    -v /etc/letsencrypt:/etc/letsencrypt \
    certbot/certbot certonly --standalone \
    -d api.aisourcing.example.com \
    --non-interactive \
    --agree-tos \
    --email admin@example.com
```

### 3.3 Auto-Renewal (Cron Job)

Let's Encrypt certificates are valid for 90 days. Set up auto-renewal:

```bash
# Add to crontab (runs daily at 3 AM)
echo "0 3 * * * docker run --rm -p 80:80 -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot renew && docker compose -f /path/to/docker-compose.yml -f /path/to/docker-compose.prod.yml exec nginx nginx -s reload" | sudo crontab -
```

Or using system host certbot:

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot auto-renews via systemd timer (Ubuntu/Debian)
sudo systemctl status certbot.timer
```

### 3.4 Verify SSL Paths

Ensure the nginx configuration points to the correct certificate paths:

```nginx
# nginx/nginx.conf
ssl_certificate     /etc/letsencrypt/live/api.aisourcing.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/api.aisourcing.example.com/privkey.pem;
```

These paths are mounted into the nginx container via `/etc/letsencrypt:/etc/letsencrypt:ro` in [`docker-compose.prod.yml`](docker-compose.prod.yml:181).

---

## 4. Building Images

### 4.1 Build the API Image

```bash
# Build all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Or build individual services
docker compose build api
docker compose build nginx
```

### 4.2 Verify Images

```bash
docker images | grep aisourcing
```

Expected output:
```
aisourcing-hub-api    latest    abc123def456    2 minutes ago    ~600MB
```

> **Note:** The image includes WeasyPrint system dependencies (libpango, libcairo, poppler-utils). The slim-bookworm base keeps it efficient.

### 4.3 Multi-Architecture Builds (Optional)

If deploying to ARM-based servers (e.g., AWS Graviton, Apple Silicon):

```bash
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t your-registry/aisourcing-hub-api:latest \
    --push .
```

---

## 5. Deploying Services

### 5.1 Start All Services

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

This command:
- Creates Docker networks and volumes
- Starts PostgreSQL, Redis, MinIO, ChromaDB
- Runs API with migrations via [`scripts/entrypoint.sh`](scripts/entrypoint.sh)
- Starts Celery worker and beat
- Starts Nginx reverse proxy

### 5.2 Monitor Startup

Watch the logs to ensure all services start correctly:

```bash
# Follow all logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Watch specific services
docker compose logs -f api nginx postgres
```

### 5.3 Verify All Services Are Running

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Expected output — all services should show `Up` status:
```
NAME                 IMAGE                       STATUS                    PORTS
aisourcing-hub-api   aisourcing-hub-api:latest   Up (healthy)              8000/tcp
celery_worker        aisourcing-hub-api:latest   Up (healthy)
celery_beat          aisourcing-hub-api:latest   Up
chromadb             chromadb/chroma:latest      Up                        8000/tcp
minio                minio/minio:latest          Up                        0.0.0.0:9000->9000/tcp
nginx                aisourcing-hub-nginx:latest Up (healthy)              0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
postgres             postgres:16-alpine          Up (healthy)              5432/tcp
redis                redis:7-alpine              Up (healthy)              6379/tcp
```

### 5.4 Stop Services

```bash
# Graceful shutdown
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Remove volumes as well (⚠️ destroys data!)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
```

---

## 6. Verification

### 6.1 Health Check

```bash
# Direct API health check
curl -f https://api.aisourcing.example.com/health

# Expected response:
# {"status":"healthy","database":"connected","redis":"connected"}
```

### 6.2 API Smoke Test

```bash
# Register a test user
curl -s -X POST https://api.aisourcing.example.com/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"TestPass123!","name":"Test User","role":"agent"}' | jq .

# Login
TOKEN=$(curl -s -X POST https://api.aisourcing.example.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"TestPass123!"}' | jq -r '.access_token')

# Verify authenticated endpoint
curl -s https://api.aisourcing.example.com/api/v1/auth/me \
    -H "Authorization: Bearer $TOKEN" | jq .
```

### 6.3 Seed Pricing Rules

```bash
# Seed default pricing rules
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api python scripts/seed_pricing_rules.py
```

### 6.4 Verify Celery Task Processing

```bash
# Check Celery worker is reachable
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec celery_worker celery -A app.shared.celery_app inspect ping
```

Expected response:
```
-> celery@<hostname>: OK
    pong -> pong
```

### 6.5 End-to-End Translation Test

```bash
curl -s -X POST https://api.aisourcing.example.com/api/v1/intake/translate \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"raw_text":"مرحبا بالعالم","source_lang":"Arabic","target_lang":"English"}' | jq .
```

---

## 7. Monitoring & Logging

### 7.1 Prometheus Metrics

The application exposes Prometheus-compatible metrics at `/metrics`:

```bash
curl -s https://api.aisourcing.example.com/metrics | head -20
```

Key metrics:
- `ai_sourcing_http_requests_total{method,path,status}` — Request counts
- `ai_sourcing_http_request_duration_seconds{method,path}` — Latency histogram
- `ai_sourcing_vision_api_calls_total{provider,status}` — Vision API usage
- `ai_sourcing_celery_tasks_total{task,state}` — Celery task counts

> **Note:** The `/metrics` endpoint is restricted to internal Docker network by default (see [`nginx/nginx.conf`](nginx/nginx.conf:76-81)). To expose it to monitoring tools, add your monitoring IP to the `allow` directives.

### 7.2 Sentry Error Tracking

If `SENTRY_DSN` is configured, errors are automatically reported to Sentry with:
- Request context (method, path, query params)
- User ID (if authenticated)
- Request ID (traceable in nginx logs)
- Sanitized request body (passwords, tokens redacted)

### 7.3 Container Logs

```bash
# Follow all logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Filter by service
docker compose logs -f api

# Filter by time
docker compose logs --since 10m api

# Search for errors
docker compose logs api | grep -i error
```

Logs are rotated automatically in production (10 MB per file, 3 files max) — see [`docker-compose.prod.yml`](docker-compose.prod.yml:83-87).

### 7.4 Nginx Access Logs

Nginx logs are available inside the container:

```bash
docker compose exec nginx tail -f /var/log/nginx/access.log
docker compose exec nginx tail -f /var/log/nginx/error.log
```

---

## 8. Backup Strategy

### 8.1 PostgreSQL Backup

Automated daily backup using `pg_dump`:

```bash
# Create backup directory
mkdir -p /backups/postgres

# Backup script (run via cron)
docker compose exec -T postgres pg_dump \
    -U app_user \
    -d aisourcing \
    --format=custom \
    --file=/tmp/aisourcing_$(date +%Y%m%d_%H%M%S).dump

# Copy to host
docker compose cp postgres:/tmp/aisourcing_*.dump /backups/postgres/
```

Cron job (daily at 2 AM):

```bash
0 2 * * * cd /path/to/project && \
    docker compose exec -T postgres pg_dump -U app_user -d aisourcing --format=custom \
    --file=/tmp/aisourcing_$(date +\%Y\%m\%d_\%H\%M\%S).dump && \
    docker compose cp postgres:/tmp/aisourcing_*.dump /backups/postgres/ && \
    docker compose exec postgres rm /tmp/aisourcing_*.dump && \
    find /backups/postgres -type f -mtime +30 -delete
```

### 8.2 MinIO Backup

MinIO data is stored in a Docker volume (`minio_data`). Backup strategy:

```bash
# Backup MinIO volume data directory
docker run --rm \
    -v aisourcing-hub_minio_data:/data \
    -v /backups/minio:/backup \
    alpine tar czf /backup/minio_$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm \
    -v aisourcing-hub_minio_data:/data \
    -v /backups/minio:/backup \
    alpine tar xzf /backup/minio_20250101.tar.gz -C /data
```

### 8.3 Redis Backup

Redis persistence is configured with snapshotting (every 300s if ≥100 keys changed). The `redis_data` volume is backed up similarly:

```bash
docker run --rm \
    -v aisourcing-hub_redis_data:/data \
    -v /backups/redis:/backup \
    alpine tar czf /backup/redis_$(date +%Y%m%d).tar.gz -C /data .
```

### 8.4 Retention Policy

| Data | Frequency | Retention |
|------|-----------|-----------|
| PostgreSQL full dump | Daily | 30 days |
| PostgreSQL WAL archive | Continuous | 7 days |
| MinIO files | Daily | 30 days |
| Redis snapshot | Daily | 7 days |

---

## 9. Rollback Procedure

### 9.1 Rollback to Previous Image Version

If a new deployment introduces issues:

```bash
# 1. Identify the previously working image
docker images | grep aisourcing-hub-api

# 2. Tag the previous image as latest
docker tag aisourcing-hub-api:<previous-tag> aisourcing-hub-api:latest

# 3. Redeploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 9.2 Rollback Database Migrations

If a migration causes issues:

```bash
# Downgrade by 1 revision
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api alembic downgrade -1

# Downgrade to a specific revision
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api alembic downgrade <revision_id>

# View migration history
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api alembic history
```

### 9.3 Full Rollback Procedure

```bash
#!/bin/bash
# rollback.sh — Full rollback to last known good state

set -e

echo "=== Rolling back AI-Sourcing Hub ==="

# 1. Pull the last known good image
docker pull aisourcing-hub-api:stable

# 2. Tag it as latest
docker tag aisourcing-hub-api:stable aisourcing-hub-api:latest

# 3. Downgrade database (if needed)
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api alembic downgrade -1

# 4. Redeploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Verify health
sleep 10
curl -f https://api.aisourcing.example.com/health && echo "Rollback successful"
```

### 9.4 Git-Based Rollback

```bash
# 1. Revert to previous commit
git revert HEAD

# 2. Rebuild
docker compose -f docker-compose.yml -f docker-compose.prod.yml build api

# 3. Redeploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 10. Troubleshooting

### 10.1 API Container Exits Immediately

**Symptom:** `api` container exits with code 1 right after starting.

**Diagnosis:**
```bash
docker compose logs api
```

**Common causes:**
1. **Database unreachable** — Check `DB_PASSWORD` and that PostgreSQL is healthy
2. **Migration failure** — Check alembic migration error in logs
3. **Missing env vars** — Verify all `*_PASSWORD` and `*_SECRET` variables are set
4. **Port already in use** — Check if another process is using port 8000

### 10.2 Nginx Returns 502 Bad Gateway

**Symptom:** Browser/curl returns 502 Bad Gateway.

**Diagnosis:**
```bash
# Check if API container is healthy
docker compose ps api

# Check nginx error logs
docker compose exec nginx tail -50 /var/log/nginx/error.log

# Check if API is reachable from nginx container
docker compose exec nginx curl -f http://api:8000/health
```

**Common causes:**
1. API container is still starting up (wait for health check)
2. API crashed after startup — check API logs
3. Network connectivity issue — nginx cannot resolve `api` hostname

### 10.3 Health Check Failing

**Symptom:** `docker compose ps` shows `unhealthy` for a service.

**Diagnosis:**
```bash
# Check health check logs
docker inspect --format='{{json .State.Health}}' aisourcing-hub-api

# Try running the health check manually
curl -f http://localhost:8000/health
```

**Common fixes:**
1. Increase `start_period` in [`docker-compose.prod.yml`](docker-compose.prod.yml:82)
2. Ensure `curl` is installed in the container (should be via `Dockerfile`)
3. Check if the application is binding to the correct interface

### 10.4 Celery Tasks Not Processing

**Symptom:** Tasks are submitted but never execute.

**Diagnosis:**
```bash
# Check worker status
docker compose exec celery_worker celery -A app.shared.celery_app status

# Check worker logs
docker compose logs celery_worker --tail 50

# Check Redis connection
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping
```

**Common causes:**
1. Worker not connected to the same Redis broker
2. Queue name mismatch between task submission and worker
3. Worker crashed due to import error — check logs

### 10.5 SSL Certificate Issues

**Symptom:** Browser shows "Not Secure" or ERR_CERT_INVALID.

**Diagnosis:**
```bash
# Check certificate expiry
docker compose exec nginx openssl x509 -in /etc/letsencrypt/live/api.aisourcing.example.com/fullchain.pem -noout -dates

# Verify nginx config loads certs correctly
docker compose exec nginx nginx -t
```

**Common fixes:**
1. Renew certificate: `sudo certbot renew`
2. Restart nginx: `docker compose exec nginx nginx -s reload`
3. Verify certificate paths match [`nginx/nginx.conf`](nginx/nginx.conf:47-48)

### 10.6 Out of Disk Space

**Symptom:** Containers failing with "no space left on device" or "write error".

**Diagnosis:**
```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Prune unused data
docker system prune -af --volumes  # ⚠️ Removes all unused containers, networks, images, and volumes
```

**Prevention:**
- Set up log rotation (already configured in [`docker-compose.prod.yml`](docker-compose.prod.yml))
- Monitor disk usage with Prometheus node exporter
- Schedule weekly Docker cleanup: `docker system prune -f`

---

## Appendix A: Quick Reference

### Useful Commands

```bash
# Deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Stop
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Rebuild single service
docker compose build api

# Tail logs
docker compose logs -f api

# Execute command in running container
docker compose exec api alembic upgrade head

# Check resource usage
docker compose stats

# Full restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml down && \
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### File Reference

| File | Purpose |
|------|---------|
| [`docker-compose.yml`](docker-compose.yml) | Base service definitions (dev defaults) |
| [`docker-compose.prod.yml`](docker-compose.prod.yml) | Production overrides (resources, healthchecks, SSL) |
| [`Dockerfile`](Dockerfile) | Multi-stage build with WeasyPrint deps |
| [`nginx/nginx.conf`](nginx/nginx.conf) | Reverse proxy with SSL, rate limiting, security headers |
| [`nginx/Dockerfile`](nginx/Dockerfile) | Nginx custom config image |
| [`scripts/entrypoint.sh`](scripts/entrypoint.sh) | Migration runner + uvicorn startup |
| [`.dockerignore`](.dockerignore) | Build context exclusions |
| [`.env.example`](.env.example) | Environment variable documentation |

---

## Appendix B: Production Checklist

Use this checklist before going live:

- [ ] All 172 tests pass (`pytest -v`)
- [ ] `.env` configured with strong secrets
- [ ] Domain DNS resolves to server IP
- [ ] SSL certificate obtained and paths configured in [`nginx/nginx.conf`](nginx/nginx.conf)
- [ ] Firewall allows ports 80, 443 (and 22 for SSH only)
- [ ] `docker compose config` validates without errors
- [ ] Images built successfully
- [ ] All services show `Up (healthy)` after deployment
- [ ] Health check endpoint returns 200
- [ ] API smoke test passes (register, login, translate)
- [ ] Pricing rules seeded
- [ ] Sentry DSN configured (if applicable)
- [ ] Backups configured and tested
- [ ] Monitoring (Prometheus/Sentry) accessible and receiving data
- [ ] Rollback procedure documented and tested
