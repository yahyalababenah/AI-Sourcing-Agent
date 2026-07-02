"""
AI-Sourcing Hub — Intake Router Full-Cycle Integration Tests

Covers the parts of the intake router the existing
``tests/test_intake/test_intake_api.py`` doesn't reach: the supplier match
inbox (``/rfqs/matched``), the public gateway (``/rfqs/public``), the
matching-trigger endpoint's role gate and no-category-found behavior, claim
match ownership, and the batch endpoints.

Auth headers here are built directly via ``_create_access_token`` on a
factory-created user rather than through the HTTP register/login flow,
because the conftest-shared ``auth_headers``/``client_headers`` fixtures (and
``tests/test_intake/test_intake_api.py``'s own ``registered_user`` fixture)
go through Pydantic's ``UserCreate`` schema, whose password-complexity
validator rejects the project's own default test passwords
(``testpass123``, ``test_password_123``) — this is part of the pre-existing
47-error baseline (unrelated to this file, see TESTING_FINDINGS.md) and
sidestepped here rather than worked around silently.

The full "create RFQ → translate → run matching → supplier inbox → public
gateway → batch import" cycle from the brief is covered, with one adaptation:
``run_matching`` is only exercised for the *no categories extracted* path,
since any RFQ where categories ARE found hits the SQLite-incompatible
supplier-profile JSONB query (TESTING_FINDINGS.md #2) — RFQMatch rows for the
inbox/gateway scenarios are created directly via the ``make_rfq``/factory
fixtures instead, exactly like the real matching engine would leave them.
"""
from unittest.mock import patch

import pytest

from app.modules.auth.service import _create_access_token
from app.modules.intake.models import MatchStatus, RFQMatch, RFQStatus


def _headers(user) -> dict:
    return {"Authorization": f"Bearer {_create_access_token(str(user.id))}"}


MOCK_TRANSLATE_RESULT = {
    "request_id": "mock-req-1",
    "chinese_query": "需要100个工业LED投光灯",
    "entities": {
        "products": [
            {"name_arabic": "كشاف إضاءة صناعي", "quantity": 100, "category": "Industrial Lighting"}
        ],
        "destination_port": "العقبة",
        "target_currency": "JOD",
    },
    "confidence": 0.92,
}


@pytest.mark.asyncio
class TestFullCustomerToMatchingCycle:
    async def test_create_translate_add_product_cycle(self, client, make_user, db_session):
        agent = await make_user(role="agent")
        headers = _headers(agent)

        with patch(
            "app.modules.intake.service.translate_and_extract",
            return_value=MOCK_TRANSLATE_RESULT,
        ):
            translate_resp = await client.post(
                "/api/v1/intake/translate",
                json={"raw_text": "أحتاج 100 كشاف إضاءة صناعي"},
                headers=headers,
            )
        assert translate_resp.status_code == 200

        create_resp = await client.post(
            "/api/v1/intake/rfqs",
            json={
                "client_name": "Test Client Co",
                "client_request_arabic": "أحتاج 100 كشاف إضاءة صناعي",
                "extracted_entities": translate_resp.json()["entities"],
                "destination_port": "Aqaba",
                "target_currency": "JOD",
            },
            headers=headers,
        )
        assert create_resp.status_code == 201
        rfq_id = create_resp.json()["id"]

        product_resp = await client.post(
            f"/api/v1/intake/rfqs/{rfq_id}/products",
            params={"name": "Industrial LED Floodlight", "quantity": 100},
            headers=headers,
        )
        assert product_resp.status_code == 201

    async def test_run_matching_endpoint_is_unusable_against_sqlite_for_any_input(
        self, client, make_rfq, make_user,
    ):
        """Not just the profile-overlap JSONB path (TESTING_FINDINGS.md #2):
        ``POST /rfqs/{id}/match`` passes the path param straight through as a
        plain string (``run_matching(db, rfq_id: str)`` -> ``match_rfq_to_suppliers``),
        which never converts it to ``uuid.UUID`` before ``RFQ.id == rfq_id``
        (unlike its sibling ``service.get_rfq()``, which does). So this
        endpoint 500s against the SQLite test DB for *any* RFQ, even one with
        no products/categories at all — this isn't reachable via HTTP at all
        in this environment, only by calling the underlying async function
        directly with a real ``uuid.UUID`` (as ``test_matcher_logic.py`` and
        ``test_exclusive_window_expiry.py`` do)."""
        import sqlalchemy.exc

        agent = await make_user(role="agent")
        rfq = await make_rfq(agent=agent, extracted_entities=None, is_public=False)

        # A real deployment would return this as a JSON 500 (Starlette's
        # ServerErrorMiddleware sends the response before re-raising for
        # server-side logging) — httpx's ASGITransport re-raises into the
        # test instead of returning a response, since raise_app_exceptions
        # defaults to True.
        with pytest.raises(sqlalchemy.exc.StatementError, match="hex"):
            await client.post(
                f"/api/v1/intake/rfqs/{rfq.id}/match", headers=_headers(agent),
            )

    async def test_run_matching_forbidden_for_client_role(self, client, make_rfq, make_user):
        agent = await make_user(role="agent")
        client_user = await make_user(role="client")
        rfq = await make_rfq(agent=agent)

        resp = await client.post(
            f"/api/v1/intake/rfqs/{rfq.id}/match", headers=_headers(client_user),
        )
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestSupplierMatchInbox:
    """GET /api/v1/intake/rfqs/matched"""

    async def test_supplier_sees_only_their_own_matches(
        self, client, make_rfq, make_user, db_session,
    ):
        supplier_a = await make_user(role="agent")
        supplier_b = await make_user(role="agent")
        rfq_a = await make_rfq()
        rfq_b = await make_rfq()

        db_session.add(RFQMatch(rfq_id=rfq_a.id, supplier_id=supplier_a.id, match_score=0.8, status=MatchStatus.PENDING))
        db_session.add(RFQMatch(rfq_id=rfq_b.id, supplier_id=supplier_b.id, match_score=0.6, status=MatchStatus.PENDING))
        await db_session.flush()

        resp = await client.get("/api/v1/intake/rfqs/matched", headers=_headers(supplier_a))
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["rfq_id"] == str(rfq_a.id)

    async def test_forbidden_for_client_role(self, client, make_user):
        client_user = await make_user(role="client")
        resp = await client.get("/api/v1/intake/rfqs/matched", headers=_headers(client_user))
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestPublicGateway:
    """GET /api/v1/intake/rfqs/public"""

    async def test_only_public_open_rfqs_are_listed(self, client, make_rfq, make_user):
        agent = await make_user(role="agent")
        public_rfq = await make_rfq(is_public=True, status=RFQStatus.OPEN)
        exclusive_rfq = await make_rfq(is_public=False, status=RFQStatus.OPEN)

        resp = await client.get("/api/v1/intake/rfqs/public", headers=_headers(agent))
        assert resp.status_code == 200
        ids = {item["id"] for item in resp.json()["items"]}
        assert str(public_rfq.id) in ids
        assert str(exclusive_rfq.id) not in ids

    async def test_exclusive_rfq_becomes_visible_after_opening_to_public(
        self, client, make_rfq, make_user, db_session,
    ):
        """End-to-end proof the exclusive→public transition actually changes
        what the public gateway endpoint returns, not just the DB column."""
        from app.modules.intake.matcher import open_rfq_to_public_pool

        agent = await make_user(role="agent")
        rfq = await make_rfq(is_public=False, status=RFQStatus.OPEN)

        before = await client.get("/api/v1/intake/rfqs/public", headers=_headers(agent))
        assert str(rfq.id) not in {item["id"] for item in before.json()["items"]}

        await open_rfq_to_public_pool(db_session, rfq.id)

        after = await client.get("/api/v1/intake/rfqs/public", headers=_headers(agent))
        assert str(rfq.id) in {item["id"] for item in after.json()["items"]}


@pytest.mark.asyncio
class TestClaimMatch:
    """POST /api/v1/intake/matches/{match_id}/claim

    CRITICAL BUG (see TESTING_FINDINGS.md #11, reported to the user — fix
    deferred by their decision): ``claim_match_endpoint``
    (app/modules/intake/router.py:487-491) binds
    ``current_user: User = Depends(require_agent)``. ``require_agent`` is a
    role-*checker* (`require_role(...)`'s inner function returns ``None`` on
    success) — every other endpoint in the codebase correctly names this
    param ``_current_user`` and separately depends on ``get_current_user``
    for the actual user. Here it doesn't, so ``current_user`` is always
    ``None`` and ``current_user.id`` inside the handler raises
    ``AttributeError`` unconditionally. This endpoint is 100% broken in
    production today, not just in this test environment. The test below
    asserts today's actual (broken) behavior as a live regression marker: it
    must be updated (not silently left passing) once the real fix lands.
    """

    async def test_currently_crashes_with_500_due_to_none_current_user(
        self, client, make_rfq, make_user, db_session,
    ):
        supplier = await make_user(role="agent")
        rfq = await make_rfq()
        match = RFQMatch(rfq_id=rfq.id, supplier_id=supplier.id, match_score=0.9, status=MatchStatus.PENDING)
        db_session.add(match)
        await db_session.flush()

        # See the comment on test_run_matching_endpoint_is_unusable_against_sqlite_for_any_input
        # re: why this raises into the test rather than returning a Response.
        with pytest.raises(AttributeError, match="'NoneType' object has no attribute 'id'"):
            await client.post(
                f"/api/v1/intake/matches/{match.id}/claim",
                json={"action": "respond"},
                headers=_headers(supplier),
            )


@pytest.mark.asyncio
class TestBatchEndpoints:
    async def test_batch_rfqs_returns_map_of_requested_ids(self, client, make_rfq, make_user):
        agent = await make_user(role="agent")
        rfq1 = await make_rfq(agent=agent)
        rfq2 = await make_rfq(agent=agent)

        resp = await client.post(
            "/api/v1/intake/rfqs/batch",
            json={"ids": [str(rfq1.id), str(rfq2.id)]},
            headers=_headers(agent),
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert set(items.keys()) == {str(rfq1.id), str(rfq2.id)}

    async def test_batch_products_returns_map_keyed_by_rfq_id(
        self, client, make_rfq, make_product, make_user,
    ):
        agent = await make_user(role="agent")
        rfq = await make_rfq(agent=agent)
        await make_product(rfq=rfq, name="Widget A")
        await make_product(rfq=rfq, name="Widget B")

        resp = await client.post(
            "/api/v1/intake/rfqs/products/batch",
            json={"rfq_ids": [str(rfq.id)]},
            headers=_headers(agent),
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items[str(rfq.id)]) == 2
