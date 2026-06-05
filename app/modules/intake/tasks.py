"""
AI-Sourcing Hub — Intake Celery Tasks

Background tasks for RFQ match lifecycle management.

Task Naming Convention:
  - ``expire-stale-matches`` — runs every 5 minutes via Celery Beat

Both tasks use **sync** SQLAlchemy sessions because Celery workers run
in a separate process from the async FastAPI app.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.modules.intake.models import RFQMatch, MatchStatus, RFQ
from app.shared.celery_app import celery_app
from app.shared.database import create_sync_session_factory
from app.shared.logging import get_logger

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════
# Sync DB Session Factory (uses shared infrastructure)
# ═══════════════════════════════════════════════════════════

_SyncSession = create_sync_session_factory(pool_size=2, max_overflow=4)


def _get_session() -> Session:
    """Get a sync database session for Celery tasks."""
    return _SyncSession()


# ═══════════════════════════════════════════════════════════
# Task: expire_stale_matches_task
# ═══════════════════════════════════════════════════════════

@celery_app.task(
    bind=True,
    name="expire-stale-matches",
    acks_late=True,
    max_retries=3,
    default_retry_delay=60,
)
def expire_stale_matches_task(self) -> dict:
    """Periodic task to expire stale RFQ matches (runs every 5 min via Celery Beat).

    Implementation:
      1. Open sync DB session.
      2. Find all PENDING matches past their ``response_deadline``.
      3. Set their status to EXPIRED.
      4. Find all RFQs whose exclusive window has expired and open them
         to the public pool (``is_public = True``).
      5. Log counts and commit.
    """
    logger.info("Starting scheduled stale match expiry")

    db: Session = _get_session()

    try:
        now = datetime.now(timezone.utc)

        # ── Step 1: Expire stale matches ──
        expired_count = db.execute(
            RFQMatch.__table__.update()
            .where(
                RFQMatch.status == MatchStatus.PENDING,
                RFQMatch.response_deadline.isnot(None),
                RFQMatch.response_deadline <= now,
            )
            .values(status=MatchStatus.EXPIRED)
        ).rowcount

        if expired_count > 0:
            logger.info("Expired %d stale RFQ matches", expired_count)

        # ── Step 2: Open expired RFQs to public pool ──
        public_count = db.execute(
            RFQ.__table__.update()
            .where(
                RFQ.is_public == False,  # noqa: E712
                RFQ.exclusive_deadline.isnot(None),
                RFQ.exclusive_deadline <= now,
            )
            .values(is_public=True)
        ).rowcount

        if public_count > 0:
            logger.info("Opened %d RFQs to public pool after deadline expiry", public_count)

        db.commit()

        return {
            "status": "success",
            "task": "expire-stale-matches",
            "expired_matches": expired_count,
            "opened_to_public": public_count,
        }

    except Exception as exc:
        db.rollback()
        logger.error(
            "Stale match expiry failed",
            extra={"error": str(exc)},
        )
        raise self.retry(exc=exc)

    finally:
        db.close()
