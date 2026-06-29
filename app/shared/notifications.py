"""
In-memory notification pub/sub for SSE delivery.

Usage:
    await notify_user(user_id, {"type": "new_rfq", "title": "...", "body": "..."})
    await notify_role("agent", {"type": "new_rfq", ...})

    async for event in subscribe_user(user_id):
        yield event  # send to SSE client
"""

import asyncio
from typing import Any, AsyncGenerator

# {user_id: [Queue, ...]}
_user_subscribers: dict[str, list[asyncio.Queue]] = {}

# {role: [user_id, ...]}  — tracks which users are currently subscribed per role
_role_to_users: dict[str, set[str]] = {}


async def notify_user(user_id: str, event: dict[str, Any]) -> None:
    for queue in _user_subscribers.get(user_id, []):
        await queue.put(event)


async def notify_role(role: str, event: dict[str, Any]) -> None:
    for user_id in list(_role_to_users.get(role, set())):
        await notify_user(user_id, event)


async def subscribe_user(user_id: str, role: str) -> AsyncGenerator[dict, None]:
    queue: asyncio.Queue = asyncio.Queue()
    _user_subscribers.setdefault(user_id, []).append(queue)
    _role_to_users.setdefault(role, set()).add(user_id)
    try:
        while True:
            event = await queue.get()
            yield event
    finally:
        subs = _user_subscribers.get(user_id, [])
        if queue in subs:
            subs.remove(queue)
        if not subs:
            _user_subscribers.pop(user_id, None)
        role_users = _role_to_users.get(role, set())
        role_users.discard(user_id)
