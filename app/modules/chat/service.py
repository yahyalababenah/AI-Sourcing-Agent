"""
AI-Sourcing Hub — Chat Service Layer

Manages chat rooms, message sending with auto-translation,
and real-time event streaming via an in-memory event bus.
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Optional

from sqlalchemy import select, desc, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.modules.chat.models import ChatMessage, ChatRoom, RoomStatus
from app.modules.chat.schemas import (
    MessageResponse,
    RoomListResponse,
    RoomResponse,
    MessageListResponse,
)
from app.modules.auth.models import User
from app.shared.exceptions import NotFoundException, ValidationError
from app.shared.logging import get_logger

logger = get_logger(__name__)

# ═══════════════════════════════════════════════════════════
# In-Memory Event Bus for SSE
# ═══════════════════════════════════════════════════════════

_room_subscribers: dict[str, list[asyncio.Queue]] = {}


async def _notify_room(room_id: str, event: dict) -> None:
    """Push an event to all subscribers of a room."""
    subscribers = _room_subscribers.get(room_id, [])
    for queue in subscribers:
        await queue.put(event)


async def subscribe_room(room_id: str) -> AsyncGenerator[dict, None]:
    """Subscribe to new messages in a chat room (SSE)."""
    queue: asyncio.Queue = asyncio.Queue()
    _room_subscribers.setdefault(room_id, []).append(queue)
    try:
        while True:
            event = await queue.get()
            yield event
    finally:
        subs = _room_subscribers.get(room_id, [])
        if queue in subs:
            subs.remove(queue)


# ═══════════════════════════════════════════════════════════
# Translation Helper
# ═══════════════════════════════════════════════════════════


async def _translate_message(content: str, source_lang: str, target_lang: str) -> str:
    """Translate message content using the LLM client.

    Falls back to original content on translation failure.
    """
    if source_lang == target_lang or not target_lang:
        return content

    try:
        # Use the intake LLM client for translation
        from app.modules.intake.llm_client import translate_to_chinese

        if target_lang == "zh":
            # Translate Arabic → Chinese
            result = await translate_to_chinese(
                arabic_text=content,
                extracted_entities={"products": [], "destination_port": "", "target_currency": "", "urgency": ""},
            )
            return result.get("translated_query", content)
        elif source_lang == "zh" and target_lang == "ar":
            # Chinese → Arabic: use the English prompt template
            from app.modules.intake.llm_client import _call_with_fallback
            from app.modules.intake.prompt_templates import TRANSLATE_SYSTEM_PROMPT_EN

            messages = [
                {"role": "system", "content": TRANSLATE_SYSTEM_PROMPT_EN},
                {"role": "user", "content": f"Translate the following Chinese text to Arabic:\n\n{content}"},
            ]
            result = await _call_with_fallback(messages)
            return result.get("translated_text", content)
        else:
            # Fallback: return original
            return content
    except Exception as exc:
        logger.warning("Chat translation failed", extra={"error": str(exc)})
        return content


# ═══════════════════════════════════════════════════════════
# Room CRUD
# ═══════════════════════════════════════════════════════════


async def create_room(
    db: AsyncSession,
    client_id: str,
    supplier_id: str,
    rfq_id: Optional[str] = None,
) -> ChatRoom:
    """Create a new chat room.

    Args:
        db: Database session.
        client_id: Client user UUID.
        supplier_id: Supplier (agent) user UUID.
        rfq_id: Optional RFQ UUID.

    Returns:
        Created ChatRoom instance.

    Raises:
        ValidationError: If room already exists for this client-supplier pair.
    """
    # Check for existing active room
    result = await db.execute(
        select(ChatRoom).where(
            ChatRoom.client_id == uuid.UUID(client_id),
            ChatRoom.supplier_id == uuid.UUID(supplier_id),
            ChatRoom.status == RoomStatus.ACTIVE,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise ValidationError(
            message="An active chat room already exists between these users",
            details={"room_id": str(existing.id)},
        )

    room = ChatRoom(
        client_id=uuid.UUID(client_id),
        supplier_id=uuid.UUID(supplier_id),
        rfq_id=uuid.UUID(rfq_id) if rfq_id else None,
    )
    db.add(room)
    await db.flush()
    await db.refresh(room)
    return room


async def list_rooms(
    db: AsyncSession,
    user_id: str,
    page: int = 1,
    page_size: int = 20,
) -> RoomListResponse:
    """List chat rooms for a user (either as client or supplier).

    Args:
        db: Database session.
        user_id: Current user UUID.
        page: Page number (1-indexed).
        page_size: Items per page.

    Returns:
        Paginated room list with last message preview and unread count.
    """
    uid = uuid.UUID(user_id)
    query = (
        select(ChatRoom)
        .options(selectinload(ChatRoom.client), selectinload(ChatRoom.supplier))
        .where(
            or_(ChatRoom.client_id == uid, ChatRoom.supplier_id == uid)
        )
        .order_by(desc(ChatRoom.updated_at))
    )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    rooms = list(result.scalars().all())

    items: list[RoomResponse] = []
    for room in rooms:
        # Get last message
        last_msg_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.room_id == room.id)
            .order_by(desc(ChatMessage.created_at))
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        # Count unread messages
        unread_count = 0
        if last_msg and str(last_msg.sender_id) != user_id:
            unread_count = 1 if last_msg.read_at is None else 0

        client_name = room.client.full_name if room.client else "Client"
        supplier_name = room.supplier.full_name if room.supplier else "Supplier"

        items.append(RoomResponse(
            id=str(room.id),
            rfq_id=str(room.rfq_id) if room.rfq_id else None,
            client_id=str(room.client_id),
            supplier_id=str(room.supplier_id),
            status=room.status.value,
            client_name=client_name,
            supplier_name=supplier_name,
            last_message=last_msg.content[:100] if last_msg else None,
            last_message_at=last_msg.created_at if last_msg else None,
            unread_count=unread_count,
            created_at=room.created_at,
        ))

    return RoomListResponse(items=items, total=total)


async def get_room(db: AsyncSession, room_id: str) -> ChatRoom:
    """Get a chat room by ID.

    Raises:
        NotFoundException: If room not found.
    """
    result = await db.execute(
        select(ChatRoom)
        .options(selectinload(ChatRoom.client), selectinload(ChatRoom.supplier))
        .where(ChatRoom.id == uuid.UUID(room_id))
    )
    room = result.scalar_one_or_none()
    if not room:
        raise NotFoundException(resource="ChatRoom", resource_id=room_id)
    return room


# ═══════════════════════════════════════════════════════════
# Messages
# ═══════════════════════════════════════════════════════════


async def send_message(
    db: AsyncSession,
    room_id: str,
    sender_id: str,
    content: str,
    source_lang: Optional[str] = None,
) -> ChatMessage:
    """Send a message in a chat room with auto-translation.

    Steps:
        1. Verify room exists and is active
        2. Auto-detect language if not provided
        3. Translate to the recipient's language
        4. Save message with both original and translated content
        5. Notify SSE subscribers

    Args:
        db: Database session.
        room_id: Chat room UUID.
        sender_id: Sender user UUID.
        content: Message text.
        source_lang: Optional source language code.

    Returns:
        Created ChatMessage instance.

    Raises:
        NotFoundException: If room not found.
        ValidationError: If room is closed.
    """
    room = await get_room(db, room_id)
    if room.status != RoomStatus.ACTIVE:
        raise ValidationError(message="Cannot send messages in a closed chat room")

    sender_uuid = uuid.UUID(sender_id)
    recipient_id = str(room.client_id) if str(room.supplier_id) == sender_id else str(room.supplier_id)

    # Determine source language (default: Arabic for clients, Chinese for suppliers)
    if not source_lang:
        source_lang = "ar" if str(room.client_id) == sender_id else "zh"

    # Determine target language
    target_lang = "zh" if source_lang == "ar" else ("ar" if source_lang == "zh" else source_lang)

    # Translate
    translated_content = await _translate_message(content, source_lang, target_lang)
    is_translated = translated_content != content

    msg = ChatMessage(
        room_id=uuid.UUID(room_id),
        sender_id=sender_uuid,
        content=translated_content if is_translated else content,
        original_content=content if is_translated else None,
        source_lang=source_lang,
        target_lang=target_lang if is_translated else None,
        is_translated=is_translated,
    )
    db.add(msg)

    # Update room's updated_at
    room.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(msg)

    # Notify SSE subscribers
    event = {
        "type": "new_message",
        "room_id": room_id,
        "message": {
            "id": str(msg.id),
            "room_id": room_id,
            "sender_id": str(msg.sender_id),
            "sender_name": msg.sender.full_name if msg.sender else None,
            "content": msg.content,
            "original_content": msg.original_content,
            "source_lang": msg.source_lang,
            "target_lang": msg.target_lang,
            "is_translated": msg.is_translated,
            "created_at": msg.created_at.isoformat(),
            "read_at": None,
        },
    }
    await _notify_room(room_id, event)

    return msg


async def get_messages(
    db: AsyncSession,
    room_id: str,
    user_id: str,
    page: int = 1,
    page_size: int = 50,
) -> MessageListResponse:
    """Get paginated messages for a chat room.

    Also marks unread messages as read if the current user is the recipient.

    Args:
        db: Database session.
        room_id: Chat room UUID.
        user_id: Current user UUID.
        page: Page number (1-indexed).
        page_size: Items per page.

    Returns:
        Paginated message list.

    Raises:
        NotFoundException: If room not found.
    """
    room = await get_room(db, room_id)

    # Count total messages
    count_query = select(func.count()).select_from(
        select(ChatMessage).where(ChatMessage.room_id == uuid.UUID(room_id)).subquery()
    )
    total = (await db.execute(count_query)).scalar() or 0

    # Fetch messages (most recent first for pagination, reversed for display)
    offset = (page - 1) * page_size
    query = (
        select(ChatMessage)
        .options(selectinload(ChatMessage.sender))
        .where(ChatMessage.room_id == uuid.UUID(room_id))
        .order_by(desc(ChatMessage.created_at))
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    messages = list(reversed(result.scalars().all()))

    # Mark messages as read if current user is the recipient
    now = datetime.now(timezone.utc)
    for msg in messages:
        if str(msg.sender_id) != user_id and msg.read_at is None:
            msg.read_at = now
    await db.flush()

    items = [
        MessageResponse(
            id=str(m.id),
            room_id=str(m.room_id),
            sender_id=str(m.sender_id),
            sender_name=m.sender.full_name if m.sender else None,
            content=m.content,
            original_content=m.original_content,
            source_lang=m.source_lang,
            target_lang=m.target_lang,
            is_translated=m.is_translated,
            created_at=m.created_at,
            read_at=m.read_at,
        )
        for m in messages
    ]

    return MessageListResponse(items=items, total=total, page=page, page_size=page_size)
