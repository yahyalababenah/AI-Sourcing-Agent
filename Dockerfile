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
    VIRTUAL_ENV=/opt/venv

# System dependencies for WeasyPrint, PDF processing, psycopg2, and OpenCV
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
    # OpenCV (required by PaddleOCR)
    libgl1-mesa-glx \
    libglib2.0-0 \
    # Health check
    curl \
    # Build tools
    gcc \
    && rm -rf /var/lib/apt/lists/*

# ---- Stage 2: Builder ----
FROM base AS builder

RUN python -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# 1. Copy ONLY the requirements file first (leverages Docker layer caching)
COPY requirements.txt ./

# 2. Install dependencies directly into the virtualenv using cached pip
#    This layer only rebuilds when requirements.txt changes
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy the rest of the application code AFTER dependencies are installed
#    Code changes do NOT trigger a full pip reinstall
COPY . .

# ---- Stage 3: Production ----
FROM base AS production

# Copy virtualenv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user
RUN groupadd -r aisourcing && useradd -r -g aisourcing -d /app -s /bin/false aisourcing

WORKDIR /app

# Copy application code with correct ownership
COPY --chown=aisourcing:aisourcing . .

# Create required directories with proper permissions
# PaddleOCR/PaddleX cache dirs are needed for model downloads
RUN mkdir -p /app/app/static/fonts /app/app/static/logos \
             /app/.paddleocr /app/.paddlex && \
    chown -R aisourcing:aisourcing /app && \
    chmod +x /app/entrypoint.sh

ENV PADDLEOCR_HOME=/app/.paddleocr

USER aisourcing

EXPOSE 8000

# Run migrations then start the server.
# The ENTRYPOINT runs alembic upgrade head before any CMD.
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
