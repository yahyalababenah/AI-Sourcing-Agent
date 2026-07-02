"""
AI-Sourcing Hub — Chat SSE Multi-User Tests

Opens two independent SSE connections (one per user, mirroring two browser
tabs) to the same chat room's stream and verifies both receive the same
``new_message`` event when either side sends a message — using the
``open_sse_stream`` fixture (see ``tests/conftest.py`` / TESTING_FINDINGS.md
#5d for why plain httpx can't observe genuinely infinite SSE streams).

``_translate_message`` is patched to a no-op passthrough: no LLM API keys are
configured in this test environment, and translation correctness isn't what
this file is testing (chat auto-translation itself would need its own test
file if that's ever a priority — this one is purely about multi-user SSE
delivery).
"""
from unittest.mock import patch

import pytest

from app.modules.auth.service import _create_access_token


def _auth_header(user) -> dict:
    return {"Authorization": f"Bearer {_create_access_token(str(user.id))}"}


@pytest.fixture(autouse=True)
def _no_op_translation():
    with patch(
        "app.modules.chat.service._translate_message",
        side_effect=lambda content, source_lang, target_lang: content,
    ):
        yield


@pytest.mark.asyncio
class TestChatSSEMultiUser:
    async def test_both_participants_receive_the_same_new_message_event(
        self, client, open_sse_stream, make_user,
    ):
        client_user = await make_user(role="client")
        supplier = await make_user(role="agent")

        create_resp = await client.post(
            "/api/v1/chat/rooms",
            json={"supplier_id": str(supplier.id)},
            headers=_auth_header(client_user),
        )
        assert create_resp.status_code == 201
        room_id = create_resp.json()["id"]

        stream_client = await open_sse_stream(
            f"/api/v1/chat/rooms/{room_id}/stream", headers=_auth_header(client_user),
        )
        stream_supplier = await open_sse_stream(
            f"/api/v1/chat/rooms/{room_id}/stream", headers=_auth_header(supplier),
        )
        assert stream_client.status_code == 200
        assert stream_supplier.status_code == 200

        send_resp = await client.post(
            f"/api/v1/chat/rooms/{room_id}/messages",
            json={"content": "أحتاج عرض سعر لهذا المنتج"},
            headers=_auth_header(client_user),
        )
        assert send_resp.status_code == 201
        sent_message_id = send_resp.json()["id"]

        event_client = await stream_client.next_event()
        event_supplier = await stream_supplier.next_event()

        assert event_client["event"] == "new_message"
        assert event_supplier["event"] == "new_message"
        assert event_client["data"]["id"] == sent_message_id
        assert event_supplier["data"]["id"] == sent_message_id

    async def test_message_from_supplier_also_reaches_both_tabs(
        self, client, open_sse_stream, make_user,
    ):
        client_user = await make_user(role="client")
        supplier = await make_user(role="agent")

        create_resp = await client.post(
            "/api/v1/chat/rooms",
            json={"supplier_id": str(supplier.id)},
            headers=_auth_header(client_user),
        )
        room_id = create_resp.json()["id"]

        stream_client = await open_sse_stream(
            f"/api/v1/chat/rooms/{room_id}/stream", headers=_auth_header(client_user),
        )
        stream_supplier = await open_sse_stream(
            f"/api/v1/chat/rooms/{room_id}/stream", headers=_auth_header(supplier),
        )

        await client.post(
            f"/api/v1/chat/rooms/{room_id}/messages",
            json={"content": "工业LED投光灯报价：45元/件"},
            headers=_auth_header(supplier),
        )

        event_client = await stream_client.next_event()
        event_supplier = await stream_supplier.next_event()
        assert event_client["data"]["sender_id"] == str(supplier.id)
        assert event_supplier["data"]["sender_id"] == str(supplier.id)

    async def test_non_member_cannot_open_room_stream(
        self, client, open_sse_stream, make_user,
    ):
        client_user = await make_user(role="client")
        supplier = await make_user(role="agent")
        intruder = await make_user(role="agent")

        create_resp = await client.post(
            "/api/v1/chat/rooms",
            json={"supplier_id": str(supplier.id)},
            headers=_auth_header(client_user),
        )
        room_id = create_resp.json()["id"]

        stream = await open_sse_stream(
            f"/api/v1/chat/rooms/{room_id}/stream", headers=_auth_header(intruder),
        )
        assert stream.status_code == 403

    async def test_stream_requires_auth_header(self, open_sse_stream, client, make_user):
        client_user = await make_user(role="client")
        supplier = await make_user(role="agent")
        create_resp = await client.post(
            "/api/v1/chat/rooms",
            json={"supplier_id": str(supplier.id)},
            headers=_auth_header(client_user),
        )
        room_id = create_resp.json()["id"]

        stream = await open_sse_stream(f"/api/v1/chat/rooms/{room_id}/stream")
        assert stream.status_code == 401
