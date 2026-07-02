"""
AI-Sourcing Hub — Catalog Review-Status Gate

Covers a previously entirely-untested module: no test file existed for
``app.modules.catalog`` before this one. Verifies:
  - GET /api/v1/catalog/products never returns non-APPROVED products.
  - The approve/reject review flow (PATCH /products/{id}/review), including
    field-edit-on-approve and ownership enforcement.
  - GET /products/pending is scoped to the requesting agent's own uploads.

Note: ``review_product()`` (catalog/service.py:504) calls ``db.commit()``
directly rather than ``db.flush()``, unlike most other service functions in
this codebase — so assertions here scope by exact IDs/names created within
each test rather than asserting on overall result-set size, since committed
rows aren't rolled back between tests within the same session-scoped engine.
"""
import uuid

import pytest

from app.modules.auth.service import _create_access_token
from app.modules.catalog.models import ProductReviewStatus


def _headers(user) -> dict:
    return {"Authorization": f"Bearer {_create_access_token(str(user.id))}"}


@pytest.mark.asyncio
class TestCatalogSearchOnlyReturnsApproved:
    async def test_pending_product_not_returned(self, client, make_user, make_catalog_product):
        # NOTE: not using the `q` full-text-search param — see module docstring
        # and TESTING_FINDINGS.md: it requires PostgreSQL's `@@` operator with
        # no working fallback, so it can't run against SQLite. Scoping by a
        # unique `category` instead, which uses a plain (portable) equality filter.
        agent = await make_user(role="agent")
        unique_category = f"cat-{uuid.uuid4().hex[:8]}"
        await make_catalog_product(
            supplier=agent, category=unique_category, review_status=ProductReviewStatus.PENDING,
        )

        resp = await client.get(
            "/api/v1/catalog/products", params={"category": unique_category}, headers=_headers(agent),
        )
        assert resp.status_code == 200
        assert resp.json()["items"] == []

    async def test_rejected_product_not_returned(self, client, make_user, make_catalog_product):
        agent = await make_user(role="agent")
        unique_category = f"cat-{uuid.uuid4().hex[:8]}"
        await make_catalog_product(
            supplier=agent, category=unique_category, review_status=ProductReviewStatus.REJECTED,
        )

        resp = await client.get(
            "/api/v1/catalog/products", params={"category": unique_category}, headers=_headers(agent),
        )
        assert resp.status_code == 200
        assert resp.json()["items"] == []

    async def test_approved_product_is_returned(self, client, make_user, make_catalog_product):
        agent = await make_user(role="agent")
        unique_category = f"cat-{uuid.uuid4().hex[:8]}"
        unique_name = f"Approved Widget {uuid.uuid4().hex[:8]}"
        await make_catalog_product(
            supplier=agent, product_name=unique_name, category=unique_category,
            review_status=ProductReviewStatus.APPROVED,
        )

        resp = await client.get(
            "/api/v1/catalog/products", params={"category": unique_category}, headers=_headers(agent),
        )
        assert resp.status_code == 200
        names = [item["product_name"] for item in resp.json()["items"]]
        assert unique_name in names

    async def test_search_requires_authenticated_role(self, client):
        resp = await client.get("/api/v1/catalog/products")
        assert resp.status_code in (401, 403)


@pytest.mark.asyncio
class TestPendingProductsInbox:
    async def test_agent_sees_only_their_own_pending_products(
        self, client, make_user, make_catalog_product,
    ):
        agent_a = await make_user(role="agent")
        agent_b = await make_user(role="agent")
        name_a = f"Agent A Product {uuid.uuid4().hex[:8]}"
        name_b = f"Agent B Product {uuid.uuid4().hex[:8]}"
        await make_catalog_product(supplier=agent_a, product_name=name_a, review_status=ProductReviewStatus.PENDING)
        await make_catalog_product(supplier=agent_b, product_name=name_b, review_status=ProductReviewStatus.PENDING)

        resp = await client.get("/api/v1/catalog/products/pending", headers=_headers(agent_a))
        assert resp.status_code == 200
        names = [item["product_name"] for item in resp.json()["items"]]
        assert name_a in names
        assert name_b not in names

    async def test_forbidden_for_client_role(self, client, make_user):
        client_user = await make_user(role="client")
        resp = await client.get("/api/v1/catalog/products/pending", headers=_headers(client_user))
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestReviewProductEndpoint:
    async def test_approve_changes_status(self, client, make_user, make_catalog_product):
        agent = await make_user(role="agent")
        unique_category = f"cat-{uuid.uuid4().hex[:8]}"
        product = await make_catalog_product(
            supplier=agent, category=unique_category, review_status=ProductReviewStatus.PENDING,
        )

        resp = await client.patch(
            f"/api/v1/catalog/products/{product.id}/review",
            json={"action": "approve"},
            headers=_headers(agent),
        )
        assert resp.status_code == 200

        search_resp = await client.get(
            "/api/v1/catalog/products", params={"category": unique_category}, headers=_headers(agent),
        )
        names = [item["product_name"] for item in search_resp.json()["items"]]
        assert product.product_name in names

    async def test_reject_changes_status_and_hides_from_search(
        self, client, make_user, make_catalog_product,
    ):
        agent = await make_user(role="agent")
        unique_name = f"To Be Rejected {uuid.uuid4().hex[:8]}"
        unique_category = f"cat-{uuid.uuid4().hex[:8]}"
        product = await make_catalog_product(
            supplier=agent, product_name=unique_name, category=unique_category,
            review_status=ProductReviewStatus.PENDING,
        )

        resp = await client.patch(
            f"/api/v1/catalog/products/{product.id}/review",
            json={"action": "reject"},
            headers=_headers(agent),
        )
        assert resp.status_code == 200
        assert resp.json()["product_name"] == unique_name

        search_resp = await client.get(
            "/api/v1/catalog/products", params={"category": unique_category}, headers=_headers(agent),
        )
        names = [item["product_name"] for item in search_resp.json()["items"]]
        assert unique_name not in names

    async def test_approve_with_field_edits_applies_them(self, client, make_user, make_catalog_product):
        agent = await make_user(role="agent")
        product = await make_catalog_product(
            supplier=agent, review_status=ProductReviewStatus.PENDING, unit_price_rmb=10.0,
        )

        resp = await client.patch(
            f"/api/v1/catalog/products/{product.id}/review",
            json={"action": "approve", "unit_price_rmb": 99.5, "moq": 250},
            headers=_headers(agent),
        )
        assert resp.status_code == 200
        assert resp.json()["unit_price_rmb"] == 99.5
        assert resp.json()["moq"] == 250

    async def test_agent_cannot_review_another_suppliers_product(
        self, client, make_user, make_catalog_product,
    ):
        owner = await make_user(role="agent")
        intruder = await make_user(role="agent")
        product = await make_catalog_product(supplier=owner, review_status=ProductReviewStatus.PENDING)

        resp = await client.patch(
            f"/api/v1/catalog/products/{product.id}/review",
            json={"action": "approve"},
            headers=_headers(intruder),
        )
        assert resp.status_code == 404

    async def test_forbidden_for_client_role(self, client, make_user, make_catalog_product):
        agent = await make_user(role="agent")
        client_user = await make_user(role="client")
        product = await make_catalog_product(supplier=agent, review_status=ProductReviewStatus.PENDING)

        resp = await client.patch(
            f"/api/v1/catalog/products/{product.id}/review",
            json={"action": "approve"},
            headers=_headers(client_user),
        )
        assert resp.status_code == 403
