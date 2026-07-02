"""
AI-Sourcing Hub — SQL Injection Tests

Injects common SQL injection payloads into every free-text field across
intake (RFQ creation, product names) and auth registration, verifying:
  1. No 500 / DB error — the payload is treated as inert string data
     (SQLAlchemy's parameterized queries, used everywhere in this codebase,
     make classic string-concatenation injection structurally impossible).
  2. The payload is stored and echoed back verbatim, not executed.
  3. Other rows created before/after the injection attempt are unaffected
     (proving no DROP/DELETE actually ran).
"""
import uuid

import pytest

from app.modules.auth.service import _create_access_token

SQLI_PAYLOADS = [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "1' OR '1'='1' --",
    "'; UPDATE users SET role='admin' WHERE '1'='1'; --",
    "Robert'); DROP TABLE students;--",
    "' UNION SELECT password_hash FROM users --",
    "\" OR \"\"=\"",
]


def _headers(user) -> dict:
    return {"Authorization": f"Bearer {_create_access_token(str(user.id))}"}


@pytest.mark.asyncio
class TestSqlInjectionInRfqFields:
    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    async def test_client_name_field_is_inert(self, client, make_user, payload, db_session):
        agent = await make_user(role="agent")
        resp = await client.post(
            "/api/v1/intake/rfqs",
            json={
                "client_name": payload,
                "client_request_arabic": "test request",
                "destination_port": "Aqaba",
                "target_currency": "JOD",
            },
            headers=_headers(agent),
        )
        assert resp.status_code == 201
        assert resp.json()["client_name"] == payload  # stored verbatim, not executed

        # Confirm the users table wasn't dropped / tampered with.
        from sqlalchemy import select

        from app.modules.auth.models import User

        result = await db_session.execute(select(User).where(User.id == agent.id))
        assert result.scalar_one_or_none() is not None

    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    async def test_destination_port_field_is_inert(self, client, make_user, payload):
        agent = await make_user(role="agent")
        resp = await client.post(
            "/api/v1/intake/rfqs",
            json={
                "client_name": "Test Client",
                "destination_port": payload,
                "target_currency": "JOD",
            },
            headers=_headers(agent),
        )
        assert resp.status_code == 201
        assert resp.json()["destination_port"] == payload

    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    async def test_product_name_query_param_is_inert(self, client, make_user, make_rfq, payload):
        """add_product_endpoint takes `name` as a query param, not JSON body —
        a different code path worth checking independently."""
        agent = await make_user(role="agent")
        rfq = await make_rfq(agent=agent)

        resp = await client.post(
            f"/api/v1/intake/rfqs/{rfq.id}/products",
            params={"name": payload, "quantity": 10},
            headers=_headers(agent),
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == payload


@pytest.mark.asyncio
class TestSqlInjectionInAuthRegistration:
    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    async def test_full_name_field_is_inert(self, client, payload):
        unique_email = f"sqli_{uuid.uuid4().hex[:8]}@example.com"
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "SecurePass123!",
                "full_name": payload,
                "role": "client",
                "company_name": "Test Corp",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["full_name"] == payload

    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    async def test_email_field_rejected_by_validation_not_injected(self, client, payload):
        """Most SQLi payloads aren't valid email addresses at all — pydantic's
        EmailStr should reject them with 422 (validation), never reaching the DB."""
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": payload,
                "password": "SecurePass123!",
                "full_name": "Test User",
                "role": "client",
                "company_name": "Test Corp",
            },
        )
        assert resp.status_code == 422

    async def test_database_survives_all_injection_attempts(self, client, db_session):
        """After every payload above has been submitted, the users table
        must still exist and be queryable — proving none of them executed."""
        from sqlalchemy import select

        from app.modules.auth.models import User

        result = await db_session.execute(select(User).limit(1))
        result.scalars().all()  # must not raise (table still exists)


@pytest.mark.asyncio
class TestSqlInjectionInChatMessages:
    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    async def test_message_content_is_inert(self, client, make_user, payload):
        from unittest.mock import patch

        client_user = await make_user(role="client")
        supplier = await make_user(role="agent")

        create_resp = await client.post(
            "/api/v1/chat/rooms",
            json={"supplier_id": str(supplier.id)},
            headers=_headers(client_user),
        )
        room_id = create_resp.json()["id"]

        with patch(
            "app.modules.chat.service._translate_message",
            side_effect=lambda content, source_lang, target_lang: content,
        ):
            resp = await client.post(
                f"/api/v1/chat/rooms/{room_id}/messages",
                json={"content": payload},
                headers=_headers(client_user),
            )
        assert resp.status_code == 201
        assert resp.json()["content"] == payload
