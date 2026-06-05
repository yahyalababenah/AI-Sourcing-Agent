
<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12-%233776AB?logo=python&logoColor=white" alt="Python 3.12"/>
  <img src="https://img.shields.io/badge/FastAPI-0.115-%23009688?logo=fastapi&logoColor=white" alt="FastAPI 0.115"/>
  <img src="https://img.shields.io/badge/React-18.3-%2361DAFB?logo=react&logoColor=white" alt="React 18"/>
  <img src="https://img.shields.io/badge/TypeScript-5.5-%233178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/PostgreSQL-16-%234169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16"/>
  <img src="https://img.shields.io/badge/Docker-Compose-%232496ED?logo=docker&logoColor=white" alt="Docker Compose"/>
  <img src="https://img.shields.io/badge/AI-PaddleOCR-%23FF6F00?logo=tensorflow&logoColor=white" alt="AI-PaddleOCR"/>
  <img src="https://img.shields.io/badge/Celery-5.4-%2337814C?logo=celery&logoColor=white" alt="Celery"/>
  <img src="https://img.shields.io/badge/Redis-7-%23DC382D?logo=redis&logoColor=white" alt="Redis"/>
  <img src="https://img.shields.io/badge/License-MIT-%23green" alt="License MIT"/>
</p>

<h1 align="center">🚢 AI-Sourcing Hub</h1>
<h3 align="center">A Deep-Tech B2B Marketplace for China–MENA Cross-Border Trade</h3>

<p align="center">
  <b>Local OCR Pipeline</b> · <b>Predictive Pricing Engine</b> · <b>Trilingual NLP</b> · <b>Smart RFQ Matching</b>
</p>

---

**AI-Sourcing Hub** is a full-stack, production-grade B2B marketplace that bridges Chinese suppliers with Middle Eastern & North African (MENA) buyers. Rather than relying on expensive third-party OCR APIs, the system runs a **fully offline PaddleOCR PP-Structure pipeline** to extract structured product data from Chinese supplier catalogues. A **9-step landed-cost pricing engine** computes real-time quotations inclusive of freight, customs, and commission. A **trilingual NLP layer** (Arabic ↔ English ↔ Chinese) handles real-time translation and entity extraction, while an **algorithmic RFQ matching engine** intelligently routes buyer requests to the most relevant suppliers with an exclusive bidding window and public pool fallback.

---

## 🧠 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         NGINX (Reverse Proxy)                    │
└─────────────────┬───────────────────────────────────────────────┘
                  │
      ┌───────────┴───────────────┐
      │                           │
┌─────▼──────┐            ┌──────▼───────┐
│  FastAPI   │            │  React SPA   │
│  Backend   │◄──────────►│  Frontend    │
│  :8000     │    REST    │  :5173       │
└─────┬──────┘            └──────────────┘
      │
      ├────────────┬───────────────┬────────────────┐
      │            │               │                │
┌─────▼────┐ ┌────▼────┐ ┌──────▼──────┐ ┌──────▼───────┐
│PostgreSQL│ │ Redis   │ │ Celery      │ │   MinIO      │
│   :5432  │ │ :6379   │ │ Workers     │ │  S3-compat   │
└──────────┘ └─────────┘ │ :beat       │ │   :9000      │
                         │ :worker     │ └──────────────┘
                         └─────────────┘
```

| Layer | Technology | Role |
|-------|-----------|------|
| **API** | Python 3.12 + FastAPI 0.115 | Modular monolith with 8 domain modules |
| **Frontend** | React 18 + TypeScript 5.5 + Vite | Arabic-first RTL SPA with role-based dashboards |
| **Database** | PostgreSQL 16 + asyncpg | Relational data with JSONB, full-text search (tsvector) |
| **Cache** | Redis 7 | Token blacklist, rate limiting, Celery broker/result backend |
| **Async Tasks** | Celery 5.4 | Document processing, exchange rate refresh, match expiry |
| **Storage** | MinIO (S3 API) | Document uploads, quotation PDFs |
| **Orchestration** | Docker Compose | 7-service topology |

### Module Map

```
app/modules/
├── auth/        JWT auth, role-based access (client/agent/admin), supplier verification
├── intake/      RFQ lifecycle, LLM translation/extraction, matching engine, public pool
├── documents/   Upload, PaddleOCR table extraction, catalog sync
├── pricing/     Landed-cost engine, exchange rate caching, configurable rules
├── catalog/     Product catalog search, supplier showroom, tsvector full-text search
├── chat/        Real-time messaging via SSE, Arabic↔Chinese translation
├── output/      Quotation PDF generation (Jinja2 + WeasyPrint), order tracking
└── monitoring/  Prometheus metrics, health checks
```

---

## 🤖 Core AI Innovations

### 1. 🏭 Local AI OCR Pipeline — Offline Document Intelligence

**File:** [`app/modules/documents/ocr_client.py`](app/modules/documents/ocr_client.py)

Replaces expensive cloud Vision LLM APIs (OpenRouter/Qwen-VL) with a **fully offline, CPU-based PaddleOCR PP-Structure engine**:

```
PDF/Image → pdf2image → PP-Structure (CPU) → HTML Table Parser → Structured JSON
```

| Feature | Implementation |
|---------|---------------|
| **Engine** | PaddleOCR PP-Structure (`from paddleocr import PPStructure`) |
| **Initialisation** | Lazy, thread-safe singleton (`threading.Lock`) — first-call init only |
| **PDF Support** | Multi-page via `pdf2image` (configurable DPI, page limit) |
| **Table Parsing** | Python stdlib `html.parser` — zero extra dependencies |
| **Column Mapping** | Heuristic Chinese→English header map covering 20+ catalogue fields |
| **Product Extraction** | `_rows_to_products()` with fuzzy scoring, MOQ/price parsing |
| **Output Format** | `list[dict]` matching legacy VLM contract — drop-in replacement |

**Key metrics:** `MAX_PDF_PAGES = 20`, `PDF_DPI = 200`, ~500MB model cache downloaded once at first use.

### 2. 💰 Predictive Pricing Engine — Landed Cost Algorithm

**File:** [`app/modules/pricing/engine.py`](app/modules/pricing/engine.py)

Implements a 9-step landed cost calculation that converts RMB ex-works prices into all-in delivered costs:

```
1. price_usd = price_rmb × exchange_rate_cny_usd
2. price_local = price_usd × (USD → target currency)
3. volume_cbm = weight_kg / 500  (sea freight density)
4. freight_per_unit = (sea_freight_cbm × volume_cbm) / quantity
5. customs_per_unit = price_local × (customs_rate / 100)
6. clearance_per_unit = clearance_fee / quantity
7. commission = (price + freight + customs + clearance) × commission_rate
8. total = price + freight + customs + clearance + commission
9. Apply MOQ discount + early payment discount + VAT
```

| Component | Configurable | Default | Unit |
|-----------|-------------|---------|------|
| Exchange Rate (CNY→USD) | ✅ | 0.14 | rate |
| Sea Freight (per CBM) | ✅ | $150 | USD |
| Customs Duty | ✅ | 5.0 | % |
| Clearance Fee | ✅ | $200 | flat |
| Commission | ✅ | 3.0 | % |
| VAT | ✅ | 16.0 | % |
| MOQ Discount | ✅ | 0.0 | % |
| Early Payment Discount | ✅ | 0.0 | % |

The engine loads rules from the database (`PricingRule` model) and supports real-time exchange rate caching via Redis with 15-minute refresh cycles.

### 3. 🌐 Trilingual NLP Engine — Arabic · English · Chinese

**File:** [`app/modules/intake/llm_client.py`](app/modules/intake/llm_client.py)

A two-stage LLM pipeline that converts Arabic buyer requests into structured Chinese supplier queries:

```
Stage 1 (Extract):  Arabic RFQ text → LLM → JSON {products, quantities, specs, port}
Stage 2 (Translate): JSON → LLM → Chinese translation for supplier communication
```

| Property | Value |
|----------|-------|
| **Primary Provider** | Together AI (`meta-llama/Llama-3.3-70B-Instruct-Turbo`) |
| **Fallback Provider** | OpenRouter (`meta-llama/llama-3.3-70b-instruct:free`) |
| **Retry Strategy** | Exponential backoff (3 attempts: 1s, 4s, 15s) |
| **Timeout** | 30s per request |
| **Error Handling** | `ProviderUnavailableError`, `IncompleteExtractionError` with fallback chain |
| **Language Routing** | Arabic input → extract entities (Arabic/English) → translate to Chinese |

The `translate_and_extract()` function at line 441 orchestrates the full pipeline atomically.

### 4. 🎯 Smart RFQ Matching — Algorithmic Supplier Discovery

**Files:** [`app/modules/intake/matcher.py`](app/modules/intake/matcher.py), [`app/modules/intake/service.py`](app/modules/intake/service.py)

A hybrid matching algorithm that pairs buyer RFQs with the most relevant suppliers:

```
RFQ Created → Category Extraction → Supplier Scoring → Match Creation → 3h Exclusive Window → Public Pool
```

| Score Component | Weight | Source |
|----------------|--------|--------|
| Catalog direct match | 0.60 | Supplier's `CatalogProduct` has the same category as RFQ |
| Profile specialty match | 0.30 | Supplier's `SupplierProfile.specialities` lists the category |
| Overlap bonus (max 0.30) | 0.10/product | Number of overlapping product categories |

**Lifecycle:**
1. RFQ reaches `OPEN` status → matching triggers automatically
2. Top-10 suppliers get `RFQMatch` records with a 3-hour `exclusive_deadline`
3. Matched suppliers see the RFQ in their **Exclusive Matches** tab with countdown timer
4. After deadline expiry → RFQ opens to **Public Pool** for all suppliers
5. A Celery Beat task (`expire-stale-matches`) runs every 5 minutes to enforce deadlines

---

## 🚀 Local Development Setup

### Prerequisites

- Docker & Docker Compose v2
- Git
- 8GB+ RAM recommended (PaddleOCR models ~500MB)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ai-sourcing-hub.git
cd ai-sourcing-hub

# 2. Copy environment file and set secrets
cp .env.example .env
# Edit .env — at minimum set:
#   DB_PASSWORD=your_secure_password
#   REDIS_PASSWORD=your_secure_password
#   JWT_SECRET=your_jwt_secret

# 3. Launch all services
docker compose up -d --build

# 4. Run database migrations
docker compose exec api alembic upgrade head

# 5. Seed demo data (optional)
docker compose exec api python scripts/seed_demo_users.py
docker compose exec api python scripts/seed_demo_rfqs.py
docker compose exec api python scripts/seed_pricing_rules.py

# 6. Install frontend deps and start dev server
cd frontend
npm install
npm run dev
```

The API is available at **`http://localhost:8000`** and the frontend at **`http://localhost:5173`**.

### Service Topology

```bash
docker compose ps
# NAME                   STATUS          PORTS
# ai-sourcing-hub-api    running (healthy)  0.0.0.0:8000->8000
# ai-sourcing-hub-beat   running             
# ai-sourcing-hub-worker running             
# ai-sourcing-hub-flower running            0.0.0.0:5555->5555
# postgres               running (healthy)  0.0.0.0:5432->5432
# redis                  running (healthy)  0.0.0.0:6379->6379
# minio                  running            0.0.0.0:9000->9000
```

### Running Tests

```bash
# Backend tests (SQLite in-memory, no PostgreSQL needed)
docker compose exec api pytest -v --cov=app

# Frontend lint
cd frontend && npm run lint
```

---

## 🧱 Tech Stack

### Backend

| Category | Libraries |
|----------|-----------|
| **Framework** | FastAPI 0.115, Uvicorn 0.30, Pydantic v2 |
| **Database** | SQLAlchemy 2.0 (async), asyncpg, Alembic |
| **Auth** | python-jose (JWT), passlib (bcrypt) |
| **AI/ML** | PaddlePaddle, PaddleOCR 2.10+, pdf2image |
| **Async Tasks** | Celery 5.4, Redis broker |
| **LLM Client** | httpx (Together AI, OpenRouter) |
| **Storage** | MinIO (S3 API via aioboto3) |
| **Monitoring** | Sentry SDK, Prometheus client, structlog |
| **Security** | slowapi (rate limiting), CORS, TrustedHost |

### Frontend

| Category | Libraries |
|----------|-----------|
| **Framework** | React 18.3, TypeScript 5.5, Vite 5 |
| **Routing** | React Router DOM v6 |
| **Data Fetching** | TanStack React Query 5, Axios |
| **State** | Zustand 4 |
| **Forms** | React Hook Form 7 + Zod |
| **Styling** | Tailwind CSS 3.4, tailwindcss-rtl, clsx |
| **Icons** | Lucide React |
| **Notifications** | react-hot-toast |

---

## 📂 Project Structure

```
ai-sourcing-hub/
├── app/                        # FastAPI backend
│   ├── modules/
│   │   ├── auth/               # JWT auth, RBAC, supplier verification
│   │   ├── intake/             # RFQ lifecycle, LLM NLP, matching engine
│   │   ├── documents/          # Upload, PaddleOCR pipeline, catalog sync
│   │   ├── pricing/            # Landed-cost engine, exchange rates
│   │   ├── catalog/            # Product search, supplier showroom
│   │   ├── chat/               # Real-time messaging, translation
│   │   ├── output/             # Quotation PDF, order tracking
│   │   └── monitoring/         # Prometheus metrics, health
│   ├── shared/                 # DB, Redis, storage, logging, middleware
│   ├── config.py               # Pydantic Settings (env-based)
│   └── main.py                 # FastAPI app factory
├── frontend/                   # React SPA
│   └── src/
│       ├── pages/              # Route-level page components
│       ├── components/         # Reusable UI components
│       ├── services/           # API client wrappers
│       ├── types/              # TypeScript interfaces
│       ├── constants/          # API routes, app constants
│       ├── hooks/              # Custom React hooks
│       ├── stores/             # Zustand state stores
│       └── lib/                # Axios instance, auth utils
├── alembic/                    # Database migrations
├── tests/                      # pytest suite (SQLite in-memory)
├── scripts/                    # Demo data seeding
├── nginx/                      # Production reverse proxy config
├── docker-compose.yml          # 7-service development topology
└── Dockerfile                  # Multi-stage (Python 3.12-slim)
```

---

## 👨‍💻 About the Developer

This project was built by a **Data Science & AI Engineering student** passionate about bridging the gap between academic machine learning research and production-grade enterprise architecture.

The developer's approach combines:
- **Deep ML/NLP fundamentals** — implementing offline OCR pipelines, LLM orchestration with fallback chains, and algorithmic matching engines rather than relying on black-box APIs
- **Systems engineering discipline** — modular monolith design, thread-safe lazy initialization, connection pooling, exponential backoff retry, and comprehensive error handling
- **Full-stack craftsmanship** — Arabic-first RTL frontend, TypeScript type safety, reactive data fetching with TanStack Query, and role-based UI routing
- **DevOps maturity** — multi-service Docker Compose orchestration, Celery async workers with beat scheduling, Prometheus monitoring, and Sentry error tracking

The result is a **portfolio-grade, deployable platform** that demonstrates the ability to take complex AI concepts from research papers to running production code.

---

<p align="center">
  <sub>Built with Python, FastAPI, React, and a lot of ☕ · © 2026</sub>
</p>
