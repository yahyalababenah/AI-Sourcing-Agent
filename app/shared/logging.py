"""
AI-Sourcing Hub — Structured JSON Logging

All services log structured JSON to stdout for collection by
systemd-journald, Docker logs, or Grafana Loki.

Usage:
    from app.shared.logging import setup_logging

    setup_logging()  # Call once at app startup
    logger = logging.getLogger("aisourcing")
    logger.info("Service started", extra={"version": "1.0.0"})
"""

import logging
import sys

from pythonjsonlogger import jsonlogger


def setup_logging() -> None:
    """Configure root logger to output structured JSON to stdout.

    Sets up:
        - Root logger at INFO level
        - JSON formatter with timestamp, level, name, message
        - Reduced noise from third-party libraries
    """
    root_logger = logging.getLogger()

    # Avoid duplicate handlers
    if any(isinstance(h, logging.StreamHandler) for h in root_logger.handlers):
        return

    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
        json_ensure_ascii=False,
    )
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)

    # ---- Third-party logger levels ----
    # Reduce uvicorn access log noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    # Reduce HTTP client debug noise
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    # Celery
    logging.getLogger("celery").setLevel(logging.INFO)
    # SQLAlchemy
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a named logger instance.

    Args:
        name: Logger name (typically __name__).

    Returns:
        Configured logger instance.
    """
    return logging.getLogger(name)
