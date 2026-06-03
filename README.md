# AI-Sourcing Hub

> **B2B Sourcing Automation Platform** — bridging Chinese suppliers and MENA buyers with AI-powered translation, document processing, and intelligent pricing.

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Overview](#api-overview)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

AI-Sourcing Hub is a full-stack platform that automates the B2B sourcing workflow between **Chinese suppliers** and **MENA (Middle East & North Africa) buyers**. It streamlines the entire process — from RFQ creation in Arabic, AI-powered translation, product extraction from documents, intelligent pricing calculations, to quotation generation.

The platform uses a **modular monolith** architecture on the backend and **role-based routing** on the frontend, supporting three user roles: **Admin**, **Agent** (supplier), and **Client** (buyer).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)               │
│  ClientLayout   AgentLayout   AdminLayout                    │
│  ┌──────────┐   ┌──────────┐  ┌──────────┐                  │
│  │ Client   │   │ Agent    │  │ Admin    │                  │
│  │ Sidebar  │   │ Sidebar  │  │ Sidebar  │                  │
│  └──────────┘   └──────────┘  └──────────┘                  │
│        │              │              │                       │
│        └──────────────┴──────────────┘                       │
│                        │                                     │
│                  ProtectedRoute + RoleGuard                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (Axios)
┌──────────────────────────┴──────────────────────────────────┐
│                   FastAPI (Modular Monolith)                  │
│  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │Auth  │ │Intake│ │Documents│ │Pricing│ │Output│ │Catalog│  │
│  │Module│ │Module│ │ Module  │ │Module│ │Module│ │Module │  │
│  └──────┘ └──────┘ └────────┘ └──────┘ └──────┘ └──────┘  │
│         ┌────────────┐  ┌──────────┐  ┌───────────┐        │
│         │ Monitoring │  │  Shared  │  │ Celery    │        │
│         │ (Admin)    │  │  Utils   │  │ Workers   │        │
│         └────────────┘  └──────────┘  └───────────┘        │
└─────────────────────────────────────────────────────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     ▼                     ▼                     ▼
┌─────────┐          ┌─────────┐          ┌──────────┐
│PostgreSQL│          │  Redis  │          │  MinIO   │
│   (DB)   │          │(Cache/  │          │  (Object │
│          │          │ Queue)  │          │ Storage) │
└─────────┘          └─────────┘          └──────────┘
```

### Backend — Modular Monolith

The backend is a **FastAPI** application organized as a modular monolith. Each business domain (auth, intake, documents, pricing, output, catalog, monitoring) lives in its own module under [`app/modules/`](app/modules/), with shared infrastructure in [`app/shared/`](app/shared/).

- **Auth Module** — JWT-based registration/login/refresh/logout with role-based access (Admin, Agent/Supplier, Client)
- **Intake Module** — RFQ creation, AI-powered Arabic→English translation & product extraction via LLM
- **Documents Module** — Document upload to MinIO, AI-powered vision extraction (PDF/image → structured product data)
- **Pricing Module** — Configurable pricing rules engine with landed cost calculation, exchange rate caching
- **Output Module** — Quotation generation with Jinja2 + WeasyPrint PDF rendering
- **Catalog Module** — Curated product marketplace search
- **Monitoring Module** — Admin dashboard stats, AI cost tracking, user management

### Frontend — Role-Based SPA

The frontend is a **React 18 SPA** built with Vite, featuring role-based routing:

- **3 layouts**: [`ClientLayout`](frontend/src/components/layout/ClientLayout.tsx), [`AgentLayout`](frontend/src/components/layout/AgentLayout.tsx), [`AdminLayout`](frontend/src/components/layout/AdminLayout.tsx)
- **Route protection**: [`ProtectedRoute`](frontend/src/components/auth/ProtectedRoute.tsx) (auth guard) + [`RoleGuard`](frontend/src/components/auth/RoleGuard.tsx) (role guard)
- **State management**: Zustand for auth state, React Query for server state
- **RTL support**: Tailwind CSS with `tailwindcss-rtl` for Arabic UI

---

## Tech Stack

### Backend

| Category | Technology |
|----------|-----------|
| **Framework** | [FastAPI](https://fastapi.tiangolo.com) (Python 3.12) |
| **ORM** | [SQLAlchemy 2.0](https://sqlalchemy.org) (async) |
| **Database** | [PostgreSQL 16](https://postgresql.org) |
| **Cache & Queue** | [Redis 7](https://redis.io) |
| **Task Queue** | [Celery](https://docs.celeryq.dev) |
| **Auth** | JWT (PyJWT) + bcrypt/passlib |
| **Object Storage** | [MinIO](https://min.io) (S3-compatible) |
| **LLM Integration** | OpenRouter, Together AI (vision & translation) |
| **PDF Generation** | WeasyPrint + Jinja2 |
| **Validation** | Pydantic v2 |
| **Monitoring** | Sentry, Prometheus |
| **Migrations** | Alembic |

### Frontend

| Category | Technology |
|----------|-----------|
| **Framework** | [React 18](https://react.dev) |
| **Build Tool** | [Vite 5](https://vitejs.dev) |
| **Language** | TypeScript 5.5 |
| **Routing** | React Router v6 |
| **Server State** | TanStack React Query v5 |
| **Client State** | Zustand v4 |
| **Forms** | React Hook Form + Zod |
| **HTTP Client** | Axios |
| **Styling** | Tailwind CSS v3 + `tailwindcss-rtl` |
| **Icons** | Lucide React |

### Infrastructure

| Category | Technology |
|----------|-----------|
| **Containerization** | Docker, Docker Compose |
| **Reverse Proxy** | Nginx |
| **Vector Store** | ChromaDB |
| **CI/CD** | Railway-ready (`railway.json`) |

---

## Features

### 🔐 Authentication & Authorization
- JWT-based auth with access + refresh tokens
- Role-based access control (Admin, Agent/Supplier, Client)
- Token blacklisting via Redis on logout
- Rate limiting (general + upload endpoints)

### 📝 RFQ Management (Intake)
- Create RFQs with Arabic descriptions
- AI-powered Arabic→English translation with product extraction
- RFQ status workflow (draft → open → processing → quoted → closed/cancelled)
- Paginated listing with role-scoped visibility

### 📄 Document Processing
- Upload documents (PDF, images) to MinIO storage
- AI vision extraction: extract structured product data from documents
- Support for multiple LLM providers with fallback (OpenRouter → Together AI)
- JSON repair for malformed LLM responses

### 💰 Pricing Engine
- Configurable pricing rules with categories (markup, margin, discount, clearance, commission)
- Landed cost calculation (FOB freight, insurance, customs, port handling, clearance, commission)
- MOQ (Minimum Order Quantity) discount tiers
- Exchange rate caching with configurable refresh

### 📊 Quotation Generation
- Create quotations from RFQ line items
- Auto-generate PDFs via Jinja2 + WeasyPrint
- Quotation status workflow (draft → sent → accepted → finalized/rejected)
- Async PDF generation via Celery

### 🛒 Product Catalog
- Curated marketplace of Chinese products with pricing in RMB
- Search by product name/category with pagination
- Direct RFQ creation from catalog products

### 📈 Admin Dashboard
- System-wide statistics (users, RFQs, quotations, catalog products, pricing rules)
- AI cost tracking by model and provider
- User management (list, toggle active status)

---

## Project Structure

```
ai-sourcing-hub/
│
├── app/                          # Backend application
│   ├── main.py                   # FastAPI app factory & lifespan
│   ├── config.py                 # Pydantic Settings (env-based config)
│   ├── modules/
│   │   ├── auth/                 # Authentication & authorization
│   │   │   ├── router.py         #   POST /register, /login, /refresh, /logout
│   │   │   ├── schemas.py        #   Pydantic request/response models
│   │   │   ├── models.py         #   SQLAlchemy User, ClientProfile, SupplierProfile
│   │   │   ├── service.py        #   Business logic (register, authenticate, tokens)
│   │   │   └── dependencies.py   #   FastAPI dependencies (get_current_user, require_role)
│   │   ├── intake/               # RFQ creation & AI translation
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py         #   RFQ, Product
│   │   │   ├── service.py
│   │   │   ├── llm_client.py     #   LLM translation client
│   │   │   └── prompt_templates.py
│   │   ├── documents/            # Document upload & AI vision extraction
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py         #   Document
│   │   │   ├── service.py
│   │   │   ├── tasks.py          #   Celery async tasks
│   │   │   ├── vision_client.py  #   OpenRouter / Together AI vision calls
│   │   │   ├── json_repair.py    #   Malformed JSON repair utilities
│   │   │   └── prompt_templates.py
│   │   ├── pricing/              # Pricing rules & landed cost engine
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py         #   PricingRule, QuotationLineItem
│   │   │   ├── service.py
│   │   │   ├── engine.py         #   PricingEngine (landed cost, MOQ discounts)
│   │   │   ├── cache.py          #   Exchange rate caching
│   │   │   └── tasks.py
│   │   ├── output/               # Quotation generation & PDF
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py         #   Quotation
│   │   │   ├── service.py
│   │   │   ├── tasks.py          #   Async PDF generation
│   │   │   └── templates/        #   Jinja2 PDF templates
│   │   ├── catalog/              # Product marketplace catalog
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   └── monitoring/           # Admin monitoring & management
│   │       ├── router.py
│   │       └── models.py         #   AiCostLog
│   ├── shared/                   # Shared infrastructure
│   │   ├── database.py           #   Async SQLAlchemy engine & session factory
│   │   ├── redis_client.py       #   Redis connection pool
│   │   ├── storage.py            #   MinIO/S3 storage client
│   │   ├── celery_app.py         #   Celery app configuration
│   │   ├── ai_cost_tracker.py    #   AI API cost logging
│   │   ├── pagination.py         #   Pagination utilities
│   │   ├── logging.py            #   Structured JSON logging
│   │   ├── metrics.py            #   Prometheus metrics
│   │   ├── rate_limiter.py       #   Rate limiting middleware
│   │   ├── security_middleware.py #   Security headers, audit logging
│   │   ├── error_handlers.py     #   Global exception handlers
│   │   └── exceptions.py         #   Custom exception classes
│
├── frontend/                     # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/             #   ProtectedRoute, RoleGuard
│   │   │   └── layout/           #   AppLayout, ClientLayout, AgentLayout, AdminLayout
│   │   ├── pages/
│   │   │   ├── auth/             #   LoginPage, RegisterPage, AdminLoginPage
│   │   │   ├── dashboard/        #   AdminDashboard, AgentDashboard, ClientDashboard
│   │   │   ├── rfq/              #   RFQListPage, RFQCreatePage, RFQDetailPage
│   │   │   ├── documents/        #   DocumentUploadPage, DocumentDetailPage
│   │   │   ├── pricing/          #   PricingRulesPage, PricingCalcPage
│   │   │   ├── quotes/           #   QuotationListPage, QuotationDetailPage
│   │   │   ├── catalog/          #   MarketplacePage
│   │   │   └── settings/         #   SettingsPage
│   │   ├── services/             #   API service modules (Axios)
│   │   ├── constants/            #   API endpoints, route paths
│   │   ├── types/                #   TypeScript interfaces
│   │   ├── hooks/                #   Custom React hooks (useAuth)
│   │   ├── stores/               #   Zustand stores (authStore)
│   │   ├── lib/                  #   Utilities (api client, auth helpers)
│   │   └── router/               #   React Router config, route factories
│   └── package.json
│
├── tests/                        # Backend test suite
│   ├── conftest.py               #   Pytest fixtures & config
│   ├── test_config.py            #   Centralized test secrets (CI/CD overridable)
│   ├── test_auth/                #   Auth API tests
│   ├── test_intake/              #   Intake API tests
│   ├── test_documents/           #   Documents API tests
│   ├── test_pricing/             #   Pricing API tests
│   ├── test_output/              #   Output API & unit tests
│   └── test_integration/         #   Integration tests
│
├── scripts/                      # Utility scripts
│   ├── seed_demo_users.py        #   Seed demo admin/agent/client accounts
│   ├── seed_demo_rfqs.py         #   Seed demo RFQs with products
│   ├── seed_pricing_rules.py     #   Seed default pricing rules
│   └── scratch_catalog_data.py   #   Seed catalog products
│
├── alembic/                      # Database migrations
│   └── versions/                 #   Migration scripts (001-005)
│
├── docker-compose.yml            # Development Docker Compose
├── docker-compose.prod.yml       # Production Docker Compose
├── Dockerfile                    # Backend Docker image
├── deployment.md                 # Production deployment guide
├── railway.json                  # Railway deployment config
├── e2e_audit.py                  # End-to-end audit script
└── pyproject.toml                # Python project metadata & deps
```

---

## Getting Started

### Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) ≥ 24.x
- [Docker Compose Plugin](https://docs.docker.com/compose/install/) ≥ v2.24.x
- Python 3.12+ (for local development)
- Node.js 20+ (for frontend development)

### Quick Start (Docker)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-sourcing-hub
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your secrets (DB_PASSWORD, REDIS_PASSWORD, JWT_SECRET, etc.)
   ```

3. **Start all services**
   ```bash
   docker compose up -d
   ```

4. **Run database migrations**
   ```bash
   docker compose exec api alembic upgrade head
   ```

5. **Seed demo data** (optional)
   ```bash
   docker compose exec api python -m scripts.seed_demo_users
   docker compose exec api python -m scripts.seed_demo_rfqs
   docker compose exec api python -m scripts.seed_pricing_rules
   ```

6. **Access the application**
   - API: [http://localhost:8000](http://localhost:8000)
   - API Docs: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
   - Frontend: [http://localhost:5173](http://localhost:5173) (requires `cd frontend && npm run dev`)
   - MinIO Console: [http://localhost:9001](http://localhost:9001)

### Local Development (without Docker)

#### Backend

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e .[dev]

# Run migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000

# Start Celery worker (separate terminal)
celery -A app.shared.celery_app worker --loglevel=info
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Configuration

All configuration is via **environment variables**, loaded by [`app/config.py`](app/config.py) (Pydantic Settings).

### Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | — |
| `REDIS_PASSWORD` | Redis password | — |
| `JWT_SECRET` | JWT signing key (min 32 chars) | — |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | `development`, `staging`, or `production` | `development` |
| `DATABASE_URL` | Full database URL (overrides constructed URL) | — |
| `REDIS_URL` | Full Redis URL (overrides constructed URL) | — |
| `TOGETHER_API_KEY` | Together AI API key (for LLM features) | — |
| `OPENROUTER_API_KEY` | OpenRouter API key (for LLM features) | — |
| `EXCHANGE_RATE_API_KEY` | Exchange rate API key | — |
| `SENTRY_DSN` | Sentry DSN for error tracking | — |
| `MINIO_ACCESS_KEY` | MinIO access key | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO secret key | `minioadmin` |

See [`.env.example`](.env.example) for the full list.

---

## API Overview

The API is mounted under `/api/v1/` with the following endpoints:

| Prefix | Module | Key Endpoints |
|--------|--------|---------------|
| `/api/v1/auth` | Authentication | `POST /register`, `POST /login`, `POST /refresh`, `GET /me`, `POST /logout` |
| `/api/v1/intake` | RFQ Intake | `POST /translate`, `POST /rfqs`, `GET /rfqs`, `GET /rfqs/{id}`, `PUT /rfqs/{id}/status`, `POST /rfqs/{id}/products`, `GET /rfqs/{id}/products` |
| `/api/v1/documents` | Documents | `POST /upload`, `GET /`, `GET /{id}`, `DELETE /{id}`, `POST /{id}/process`, `GET /{id}/status`, `GET /{id}/items`, `PUT /{id}/items` |
| `/api/v1/pricing` | Pricing | `GET /rules`, `POST /rules`, `GET /rules/{id}`, `PUT /rules/{id}`, `DELETE /rules/{id}`, `POST /calculate`, `POST /exchange-rates/refresh` |
| `/api/v1/quotes` | Quotations | `POST /`, `GET /`, `GET /{id}`, `PUT /{id}/status`, `POST /generate`, `GET /{id}/pdf`, `POST /{id}/finalize` |
| `/api/v1/catalog` | Catalog | `GET /products` |
| `/api/v1/admin` | Admin | `GET /ai-costs`, `GET /stats`, `GET /users`, `PUT /users/{id}/status` |
| `/health` | System | `GET /health` (DB + Redis health check) |

Interactive API documentation is available at `/api/docs` (Swagger UI) and `/api/redoc` (ReDoc).

---

## Development

### Code Quality

The project uses:

- **Ruff** — Python linter & formatter
  ```bash
  ruff check app/ tests/
  ruff format app/ tests/
  ```
- **mypy** — Static type checking
  ```bash
  mypy app/
  ```
- **ESLint** — Frontend linting (in `frontend/`)
  ```bash
  cd frontend && npm run lint
  ```

### Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Seeding Demo Data

The [`scripts/`](scripts/) directory contains utilities to seed the database for development:

```bash
python -m scripts.seed_demo_users       # Creates admin, agent, and client accounts
python -m scripts.seed_demo_rfqs        # Creates demo RFQs linked to demo users
python -m scripts.seed_pricing_rules    # Creates default pricing rule categories
python -m scripts.scratch_catalog_data  # Seeds catalog products
```

---

## Testing

### Backend Tests

The test suite uses **pytest** with async support. Centralized test configuration is in [`tests/test_config.py`](tests/test_config.py) — all test secrets can be overridden via `TEST_*` environment variables (e.g., `TEST_DB_PASSWORD`) for CI/CD pipelines.

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run specific test module
pytest tests/test_auth/ -v

# Run with verbose output
pytest -v --tb=short
```

### Test Configuration

Test secrets are centralized in [`tests/test_config.py`](tests/test_config.py) and can be overridden in CI/CD:

```bash
# Override test database password in CI
export TEST_DB_PASSWORD="ci_secure_password_123"
export TEST_REDIS_PASSWORD="ci_redis_secure_456"
pytest
```

### End-to-End Audit

The [`e2e_audit.py`](e2e_audit.py) script runs a comprehensive end-to-end test against a running instance:

```bash
python e2e_audit.py
```

---

## Deployment

### Production Docker Compose

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Railway Deployment

The project includes a [`railway.json`](railway.json) for one-click deployment on [Railway](https://railway.app). Refer to [`DEPLOY_RAILWAY.md`](DEPLOY_RAILWAY.md) for instructions.

### Detailed Deployment Guide

See [`deployment.md`](deployment.md) for a comprehensive guide covering:

- SSL certificate provisioning
- Production image building
- Monitoring & logging
- Backup strategy
- Rollback procedures

---

## License

**Proprietary** — All rights reserved. This software is not open-source and may not be copied, modified, or distributed without explicit permission.

---

<p align="center">
  <sub>Built with ❤️ for the China–MENA trade corridor</sub>
</p>
