"""
Notifications SSE router.

GET /api/v1/notifications/stream
  - EventSource doesn't support custom headers, so we accept the JWT
    as a `token` query parameter in addition to the Authorization header.
"""

import json
from typing import Annotated, Optional
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.modules.auth.models import User
from app.shared.database import get_db
from app.shared.exceptions import AuthenticationError
from app.shared.notifications import subscribe_user

router = APIRouter()


async def _get_user_from_token(token: str, db: AsyncSession) -> User:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AuthenticationError(message="Token has expired")
    except jwt.InvalidTokenError as e:
        raise AuthenticationError(message="Invalid token", details={"error": str(e)})

    raw_user_id = payload.get("sub")
    if not raw_user_id:
        raise AuthenticationError(message="Token missing subject claim")

    try:
        user_id = UUID(raw_user_id)
    except ValueError:
        raise AuthenticationError(message="Invalid user ID in token")

    stmt = (
        select(User)
        .options(selectinload(User.client_profile), selectinload(User.supplier_profile))
        .where(User.id == user_id)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise AuthenticationError(message="User not found or inactive")
    return user


@router.get("/stream", summary="SSE notification stream for current user")
async def notification_stream(
    request: Request,
    token: Optional[str] = Query(None, description="JWT token (for EventSource)"),
    authorization: Annotated[Optional[str], None] = None,
    db: AsyncSession = Depends(get_db),
):
    """Server-Sent Events stream delivering real-time notifications.

    Accepts JWT via query param `?token=...` (for browser EventSource)
    or via `Authorization: Bearer ...` header.
    """
    # Resolve token from query param or header
    raw_token: Optional[str] = None
    if token:
        raw_token = token
    elif authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            raw_token = parts[1]

    if not raw_token:
        raise AuthenticationError(message="Missing token")

    user = await _get_user_from_token(raw_token, db)
    user_id = str(user.id)
    role = user.role.value if hasattr(user.role, "value") else str(user.role)

    async def event_generator():
        # Send a "connected" ping immediately so the client knows the stream is live
        yield f"event: connected\ndata: {json.dumps({'user_id': user_id})}\n\n"
        async for event in subscribe_user(user_id, role):
            if await request.is_disconnected():
                break
            yield f"event: {event.get('type', 'notification')}\ndata: {json.dumps(event, default=str)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
