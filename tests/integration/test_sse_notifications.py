"""
AI-Sourcing Hub — SSE Notification Stream Tests

Covers the in-memory pub/sub (``app.shared.notifications``) directly and the
real HTTP streaming endpoint (``GET /api/v1/notifications/stream``) via the
``open_sse_stream`` fixture (see ``tests/conftest.py``), which manually drives
the ASGI app rather than going through ``httpx.ASGITransport`` — that
transport runs the whole app to completion before returning a response,
so it cannot observe a genuinely never-ending SSE stream at all (verified:
even a minimal FastAPI app with no custom middleware hangs indefinitely).
This is a test-tooling limitation, not a product bug.

Per TESTING_FINDINGS.md: this pub/sub is plain ``asyncio.Queue`` per-process,
not Redis-backed, so these tests only prove single-process delivery (which is
also the only topology this system currently supports in production).
"""
import asyncio

import pytest

from app.modules.auth.service import _create_access_token
from app.shared.notifications import notify_role, notify_user, subscribe_user


async def _prime(gen) -> "asyncio.Task":
    """Start ``gen.__anext__()`` as a background task and let it run up to its
    first ``await queue.get()`` (which registers the subscription as a side
    effect) — WITHOUT cancelling it, since cancelling an async generator's
    pending ``anext()`` triggers its ``finally`` block (unsubscribing) before
    the test ever gets to send it an event."""
    task = asyncio.ensure_future(gen.__anext__())
    await asyncio.sleep(0)
    return task


class TestPubSubDeliveryDirect:
    @pytest.mark.asyncio
    async def test_notify_user_delivers_to_subscribed_queue(self):
        gen = subscribe_user("user-1", "agent")
        task = await _prime(gen)

        await notify_user("user-1", {"type": "new_rfq", "title": "test"})
        event = await asyncio.wait_for(task, timeout=1.0)
        assert event["type"] == "new_rfq"

        await gen.aclose()

    @pytest.mark.asyncio
    async def test_notify_user_with_no_subscribers_does_not_raise(self):
        await notify_user("nobody-subscribed", {"type": "new_rfq"})  # should not raise

    @pytest.mark.asyncio
    async def test_notify_role_reaches_all_subscribed_users_of_that_role(self):
        gen_a = subscribe_user("agent-a", "agent")
        gen_b = subscribe_user("agent-b", "agent")
        task_a = await _prime(gen_a)
        task_b = await _prime(gen_b)

        await notify_role("agent", {"type": "new_rfq", "title": "broadcast"})

        event_a = await asyncio.wait_for(task_a, timeout=1.0)
        event_b = await asyncio.wait_for(task_b, timeout=1.0)
        assert event_a["title"] == "broadcast"
        assert event_b["title"] == "broadcast"

        await gen_a.aclose()
        await gen_b.aclose()

    @pytest.mark.asyncio
    async def test_notify_role_does_not_reach_other_roles(self):
        gen_client = subscribe_user("client-1", "client")
        task = await _prime(gen_client)

        await notify_role("agent", {"type": "new_rfq"})

        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(asyncio.shield(task), timeout=0.2)

        # task (gen_client.__anext__()) is still pending — cancel it directly
        # rather than gen_client.aclose(), which raises RuntimeError against
        # a generator with an in-flight anext() call.
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    @pytest.mark.asyncio
    async def test_multiple_subscriptions_for_same_user_each_receive_event(self):
        """Two browser tabs for the same user should both get notified."""
        gen_1 = subscribe_user("multi-tab-user", "agent")
        gen_2 = subscribe_user("multi-tab-user", "agent")
        task_1 = await _prime(gen_1)
        task_2 = await _prime(gen_2)

        await notify_user("multi-tab-user", {"type": "quote_ready"})

        event_1 = await asyncio.wait_for(task_1, timeout=1.0)
        event_2 = await asyncio.wait_for(task_2, timeout=1.0)
        assert event_1["type"] == "quote_ready"
        assert event_2["type"] == "quote_ready"

        await gen_1.aclose()
        await gen_2.aclose()

    @pytest.mark.asyncio
    async def test_closing_generator_unsubscribes_user(self):
        from app.shared import notifications as notif_module

        gen = subscribe_user("cleanup-user", "agent")
        task = await _prime(gen)
        assert "cleanup-user" in notif_module._user_subscribers

        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

        assert "cleanup-user" not in notif_module._user_subscribers
        assert "cleanup-user" not in notif_module._role_to_users.get("agent", set())


@pytest.mark.asyncio
class TestNotificationStreamEndpointRealHTTP:
    """A genuine SSE connection through the real ASGI app (full middleware
    stack, real auth, real pub/sub) via ``open_sse_stream`` — not a mock."""

    async def test_stream_sends_connected_event_then_delivers_new_rfq(
        self, open_sse_stream, make_user,
    ):
        agent = await make_user(role="agent")
        token = _create_access_token(str(agent.id))

        stream = await open_sse_stream(
            "/api/v1/notifications/stream", query_string=f"token={token}",
        )
        assert stream.status_code == 200

        connected = await stream.next_event()
        assert connected["event"] == "connected"
        assert connected["data"]["user_id"] == str(agent.id)

        await notify_user(str(agent.id), {
            "type": "new_rfq", "title": "طلب جديد", "body": "تفاصيل", "rfq_id": "abc-123",
        })

        new_rfq = await stream.next_event()
        assert new_rfq["event"] == "new_rfq"
        assert new_rfq["data"]["rfq_id"] == "abc-123"

    async def test_stream_requires_token(self, open_sse_stream):
        stream = await open_sse_stream("/api/v1/notifications/stream")
        assert stream.status_code == 401

    async def test_stream_rejects_invalid_token(self, open_sse_stream):
        stream = await open_sse_stream(
            "/api/v1/notifications/stream", query_string="token=not-a-real-jwt",
        )
        assert stream.status_code == 401

    async def test_two_users_each_only_receive_their_own_notifications(
        self, open_sse_stream, make_user,
    ):
        agent_a = await make_user(role="agent")
        agent_b = await make_user(role="agent")
        stream_a = await open_sse_stream(
            "/api/v1/notifications/stream",
            query_string=f"token={_create_access_token(str(agent_a.id))}",
        )
        stream_b = await open_sse_stream(
            "/api/v1/notifications/stream",
            query_string=f"token={_create_access_token(str(agent_b.id))}",
        )
        await stream_a.next_event()  # connected
        await stream_b.next_event()  # connected

        await notify_user(str(agent_a.id), {"type": "new_rfq", "rfq_id": "only-for-a"})

        event_a = await stream_a.next_event()
        assert event_a["data"]["rfq_id"] == "only-for-a"

        with pytest.raises(asyncio.TimeoutError):
            await stream_b.next_event(timeout=0.2)
