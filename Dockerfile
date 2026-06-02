# ===================================================================
# AI-Sourcing Hub — Multi-Stage Docker Build
# Target Stack: Python 3.12, FastAPI, Celery, WeasyPrint
# ===================================================================

# ---- Stage 1: Base ----
FROM python:3.12-slim-bookworm AS base

ENV \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    POETRY_VERSION=1.7.0 \
    VIRTUAL_ENV=/opt/venv

# System dependencies for WeasyPrint, PDF processing, and psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    # WeasyPrint dependencies
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    libcairo2 \
    # PDF/image processing
    poppler-utils \
    # PostgreSQL client
    libpq-dev \
    # Build tools
    gcc \
    && rm -rf /var/lib/apt/lists/*

# ---- Stage 2: Builder ----
FROM base AS builder

RUN python -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# ---- Stage 3: Production ----
FROM base AS production

# Copy virtualenv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user
RUN groupadd -r aisourcing && useradd -r -g aisourcing -d /app -s /bin/false aisourcing

WORKDIR /app

# Copy application code
COPY --chown=aisourcing:aisourcing . .

# Create required directories with proper permissions
RUN mkdir -p /app/app/static/fonts /app/app/static/logos && \
    chown -R aisourcing:aisourcing /app

USER aisourcing

EXPOSE 8000

# Default command — overridden by docker-compose for api vs worker
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
