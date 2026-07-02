"""
AI-Sourcing Hub — Exclusive Window Expiry (PRIORITY per test-planning brief)

Confirms the exclusive→public transition happens automatically once
``exclusive_deadline`` passes, without manual intervention — resolving the
brief's single most uncertain Phase-0 question: yes, the Celery Beat task
``expire-stale-matches`` already exists (`app/modules/intake/tasks.py`,
scheduled every 5 min in `app/shared/celery_app.py`). This is a regression
test of existing behavior, not TDD of new code.

The Celery task *wrapper* (`expire_stale_matches_task`) can't be invoked
directly in this test environment — see TESTING_FINDINGS.md #3b/#3c: its sync
DB session always resolves to a real `postgres` host, regardless of the test
DATABASE_URL. These tests instead call the underlying async functions in
`app/modules/intake/matcher.py` directly against the SQLite test DB — the
same functions the Celery task calls internally — which fully exercises the
actual expiry logic.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.modules.intake.matcher import expire_stale_matches, open_rfq_to_public_pool
from app.modules.intake.models import MatchStatus, RFQMatch


@pytest.mark.asyncio
class TestExpireStaleMatches:
    async def test_rfq_past_deadline_becomes_public_without_manual_intervention(
        self, db_session, make_rfq,
    ):
        """PRIORITY scenario from the brief: create an RFQ with an
        exclusive_deadline in the past, run the scheduled expiry function
        (not manually flip is_public), and confirm is_public becomes True."""
        past_deadline = datetime.now(timezone.utc) - timedelta(hours=1)
        rfq = await make_rfq(
            is_public=False,
            exclusive_deadline=past_deadline,
        )
        await db_session.flush()
        assert rfq.is_public is False

        await expire_stale_matches(db_session)
        await db_session.refresh(rfq)

        assert rfq.is_public is True

    async def test_rfq_before_deadline_stays_exclusive(self, db_session, make_rfq):
        future_deadline = datetime.now(timezone.utc) + timedelta(hours=2)
        rfq = await make_rfq(is_public=False, exclusive_deadline=future_deadline)
        await db_session.flush()

        await expire_stale_matches(db_session)
        await db_session.refresh(rfq)

        assert rfq.is_public is False

    async def test_rfq_with_no_deadline_is_unaffected(self, db_session, make_rfq):
        """An RFQ that was never matched (exclusive_deadline=None) must not
        be swept into the public pool by the expiry job."""
        rfq = await make_rfq(is_public=False, exclusive_deadline=None)
        await db_session.flush()

        await expire_stale_matches(db_session)
        await db_session.refresh(rfq)

        assert rfq.is_public is False

    async def test_pending_match_past_response_deadline_is_expired(
        self, db_session, make_rfq, make_user,
    ):
        supplier = await make_user(role="agent")
        rfq = await make_rfq(is_public=False, exclusive_deadline=datetime.now(timezone.utc) + timedelta(hours=1))
        match = RFQMatch(
            rfq_id=rfq.id,
            supplier_id=supplier.id,
            match_score=0.8,
            response_deadline=datetime.now(timezone.utc) - timedelta(minutes=5),
            status=MatchStatus.PENDING,
        )
        db_session.add(match)
        await db_session.flush()

        expired_count = await expire_stale_matches(db_session)
        await db_session.refresh(match)

        assert expired_count == 1
        assert match.status == MatchStatus.EXPIRED

    async def test_responded_match_is_not_re_expired(self, db_session, make_rfq, make_user):
        """A match the supplier already responded to must not be touched,
        even if its response_deadline has technically passed."""
        supplier = await make_user(role="agent")
        rfq = await make_rfq(is_public=False)
        match = RFQMatch(
            rfq_id=rfq.id,
            supplier_id=supplier.id,
            match_score=0.8,
            response_deadline=datetime.now(timezone.utc) - timedelta(minutes=5),
            status=MatchStatus.RESPONDED,
        )
        db_session.add(match)
        await db_session.flush()

        expired_count = await expire_stale_matches(db_session)
        await db_session.refresh(match)

        assert expired_count == 0
        assert match.status == MatchStatus.RESPONDED

    async def test_returns_count_of_expired_matches_across_multiple_rfqs(
        self, db_session, make_rfq, make_user,
    ):
        supplier = await make_user(role="agent")
        for _ in range(3):
            rfq = await make_rfq(is_public=False)
            match = RFQMatch(
                rfq_id=rfq.id,
                supplier_id=supplier.id,
                match_score=0.5,
                response_deadline=datetime.now(timezone.utc) - timedelta(minutes=1),
                status=MatchStatus.PENDING,
            )
            db_session.add(match)
        await db_session.flush()

        expired_count = await expire_stale_matches(db_session)
        assert expired_count == 3


@pytest.mark.asyncio
class TestOpenRfqToPublicPool:
    """The manual/API-triggered counterpart to the scheduled expiry sweep."""

    async def test_opens_rfq_and_expires_its_pending_matches(
        self, db_session, make_rfq, make_user,
    ):
        supplier = await make_user(role="agent")
        rfq = await make_rfq(is_public=False)
        match = RFQMatch(
            rfq_id=rfq.id,
            supplier_id=supplier.id,
            match_score=0.7,
            status=MatchStatus.PENDING,
        )
        db_session.add(match)
        await db_session.flush()

        updated_rfq = await open_rfq_to_public_pool(db_session, rfq.id)
        await db_session.refresh(match)

        assert updated_rfq.is_public is True
        assert match.status == MatchStatus.EXPIRED

    async def test_raises_not_found_for_unknown_rfq(self, db_session):
        import uuid

        from app.shared.exceptions import NotFoundException

        # NOTE: passing uuid.UUID (not str) — see TESTING_FINDINGS.md #2 on the
        # RFQ.id == rfq_id comparison not converting str -> UUID itself, which
        # only works against real Postgres+asyncpg's native UUID support.
        with pytest.raises(NotFoundException):
            await open_rfq_to_public_pool(db_session, uuid.UUID(int=0))
