"""
AI-Sourcing Hub — Chat / Negotiation Room Endpoints

/api/v1/chat/rooms                    POST   Create a chat room
/api/v1/chat/rooms                    GET    List user's chat rooms
/api/v1/chat/rooms/{room_id}          GET    Get room details
/api/v1/chat/rooms/{room_id}/messages GET    Get room messages
/api/v1/chat/rooms/{room_id}/messages POST   Send a message
/api/v1/chat/rooms/{room_id}/stream   GET    SSE stream for real-time updates
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_user, require_any_role
from app.modules.auth.models import User, UserRole
from app.modules.chat.schemas import (
    CreateRoomRequest,
    MessageListResponse,
    MessageResponse,
    RoomListResponse,
    RoomResponse,
    SendMessageRequest,
)
from app.modules.chat.service import (
    create_room,
    get_messages,
    get_room,
    list_rooms,
    send_message,
    subscribe_room,
)
from app.shared.database import get_db

router = APIRouter()


@router.post(
    "/rooms",
    response_model=RoomResponse,
    status_code=201,
    summary="Create a chat room",
)
async def create_chat_room(
    body: CreateRoomRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new chat room between the current user (client) and a supplier.

    The current user must be a CLIENT or ADMIN. The supplier_id must be an AGENT.
    Only one active room per client-supplier pair is allowed.
    """
    room = await create_room(
        db,
        client_id=str(current_user.id),
        supplier_id=body.supplier_id,
        rfq_id=body.rfq_id,
    )

    client_name = room.client.full_name if room.client else "Client"
    supplier_name = room.supplier.full_name if room.supplier else "Supplier"

    return RoomResponse(
        id=str(room.id),
        client_id=str(room.client_id),
        supplier_id=str(room.supplier_id),
        status=room.status.value,
        client_name=client_name,
        supplier_name=supplier_name,
        created_at=room.created_at,
    )


@router.get(
    "/rooms",
    response_model=RoomListResponse,
    summary="List user's chat rooms",
)
async def list_chat_rooms(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all chat rooms for the current user (as client or supplier).

    Includes last message preview and unread count.
    """
    return await list_rooms(db, user_id=str(current_user.id), page=page, page_size=page_size)


@router.get(
    "/rooms/{room_id}",
    response_model=RoomResponse,
    summary="Get chat room details",
)
async def get_chat_room(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get details of a specific chat room."""
    room = await get_room(db, room_id)
    client_name = room.client.full_name if room.client else "Client"
    supplier_name = room.supplier.full_name if room.supplier else "Supplier"
    return RoomResponse(
        id=str(room.id),
        rfq_id=str(room.rfq_id) if room.rfq_id else None,
        client_id=str(room.client_id),
        supplier_id=str(room.supplier_id),
        status=room.status.value,
        client_name=client_name,
        supplier_name=supplier_name,
        created_at=room.created_at,
    )


@router.get(
    "/rooms/{room_id}/messages",
    response_model=MessageListResponse,
    summary="Get room messages",
)
async def get_room_messages(
    room_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get paginated messages for a chat room.

    Messages are returned oldest-first. Unread messages are marked as read.
    """
    return await get_messages(
        db, room_id=room_id, user_id=str(current_user.id), page=page, page_size=page_size
    )


@router.post(
    "/rooms/{room_id}/messages",
    response_model=MessageResponse,
    status_code=201,
    summary="Send a message",
)
async def send_chat_message(
    room_id: str,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a message in a chat room with auto-translation.

    The message is automatically translated to the recipient's language:
    - Client sends in Arabic → translated to Chinese for supplier
    - Supplier sends in Chinese → translated to Arabic for client
    """
    msg = await send_message(
        db,
        room_id=room_id,
        sender_id=str(current_user.id),
        content=body.content,
        source_lang=body.source_lang,
    )
    return MessageResponse(
        id=str(msg.id),
        room_id=str(msg.room_id),
        sender_id=str(msg.sender_id),
        sender_name=msg.sender.full_name if msg.sender else None,
        content=msg.content,
        original_content=msg.original_content,
        source_lang=msg.source_lang,
        target_lang=msg.target_lang,
        is_translated=msg.is_translated,
        created_at=msg.created_at,
    )


@router.get(
    "/rooms/{room_id}/stream",
    summary="SSE stream for real-time message updates",
)
async def stream_room_messages(
    room_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Server-Sent Events endpoint for real-time message updates.

    Emits events when new messages are sent to this room.
    Client should use EventSource on the frontend.
    """
    async def event_generator():
        async for event in subscribe_room(room_id):
            if await request.is_disconnected():
                break
            yield f"event: {event['type']}\ndata: {json.dumps(event['message'], default=str)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
