# ===================================================================
# AI-Sourcing Hub — single Dockerfile for HF Spaces AND docker-compose
#
# HF Spaces always builds ./Dockerfile (a custom dockerfile path is not
# supported), so this image must serve both deployments. All HF-specific
# behavior (no Celery worker, in-memory rate limiting, optional bundled
# MinIO) is applied by entrypoint.hf.sh at runtime, gated on the SPACE_ID
# env var that HF injects — never baked in as ENV here, because compose
# services share this image and would inherit it.
# Port: 7860 (HF Spaces default; compose overrides the command/port)
# ===================================================================

FROM python:3.12-slim-bookworm AS base

ENV \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    VIRTUAL_ENV=/opt/venv

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    libcairo2 \
    poppler-utils \
    libpq-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# ---- Builder ----
FROM base AS builder

RUN python -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# ---- Production ----
FROM base AS production

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# In-container MinIO for single-container HF Spaces demos. The entrypoint
# starts it ONLY when running on a Space (SPACE_ID set) with no external
# S3 configured — it stays inert in docker-compose deployments.
RUN curl -fsSL https://dl.min.io/server/minio/release/linux-amd64/minio \
    -o /usr/local/bin/minio && chmod +x /usr/local/bin/minio

RUN groupadd -r aisourcing && useradd -r -g aisourcing -d /app -s /bin/false aisourcing

WORKDIR /app

COPY --chown=aisourcing:aisourcing . .

RUN mkdir -p /app/app/static/fonts /app/app/static/logos \
             /app/.paddleocr /app/.paddlex /data/minio && \
    chown -R aisourcing:aisourcing /app /data/minio && \
    chmod +x /app/entrypoint.hf.sh

ENV PADDLEOCR_HOME=/app/.paddleocr

USER aisourcing

EXPOSE 7860

ENTRYPOINT ["/app/entrypoint.hf.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
