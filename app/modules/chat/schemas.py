"""
AI-Sourcing Hub — Chat Module Pydantic Schemas
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════
# Chat Room
# ═══════════════════════════════════════════════════════════


class CreateRoomRequest(BaseModel):
    """Create a new chat room between a client and supplier."""
    supplier_id: str = Field(..., description="Supplier (agent) user UUID")
    rfq_id: Optional[str] = Field(None, description="Optional RFQ UUID to associate")


class RoomResponse(BaseModel):
    """Single chat room."""
    id: str
    rfq_id: Optional[str] = None
    client_id: str
    supplier_id: str
    status: str
    client_name: Optional[str] = None
    supplier_name: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class RoomListResponse(BaseModel):
    """List of chat rooms."""
    items: list[RoomResponse]
    total: int


# ═══════════════════════════════════════════════════════════
# Chat Message
# ═══════════════════════════════════════════════════════════


class SendMessageRequest(BaseModel):
    """Send a message in a chat room."""
    content: str = Field(..., min_length=1, max_length=5000, description="Message text")
    source_lang: Optional[str] = Field(None, description="Source language code (ar/zh/en)")


class MessageResponse(BaseModel):
    """Single chat message."""
    id: str
    room_id: str
    sender_id: str
    sender_name: Optional[str] = None
    content: str
    original_content: Optional[str] = None
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None
    is_translated: bool = False
    created_at: datetime
    read_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MessageListResponse(BaseModel):
    """Paginated list of messages."""
    items: list[MessageResponse]
    total: int
    page: int
    page_size: int


# ═══════════════════════════════════════════════════════════
# SSE Event
# ═══════════════════════════════════════════════════════════


class SseEvent(BaseModel):
    """Server-Sent Event payload for new message notification."""
    type: str = "new_message"
    room_id: str
    message: MessageResponse
