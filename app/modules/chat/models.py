"""
AI-Sourcing Hub — Chat / Negotiation Room Models

Two tables:
    - ChatRoom: links a client and supplier (optionally tied to an RFQ)
    - ChatMessage: individual messages with auto-translation fields
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.shared.database import Base


class RoomStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="SET NULL"), nullable=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(RoomStatus, values_callable=lambda x: [e.value for e in x]), default=RoomStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # relationships
    client = relationship("User", foreign_keys=[client_id], lazy="joined")
    supplier = relationship("User", foreign_keys=[supplier_id], lazy="joined")
    messages = relationship("ChatMessage", back_populates="room", order_by="ChatMessage.created_at", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<ChatRoom {self.id} client={self.client_id} supplier={self.supplier_id}>"


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("chat_rooms.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    # Original content before translation (preserves sender's language)
    original_content = Column(Text, nullable=True)
    source_lang = Column(String(10), nullable=True)  # e.g., "ar", "zh", "en"
    target_lang = Column(String(10), nullable=True)  # auto-translated to this language
    is_translated = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    # relationships
    room = relationship("ChatRoom", back_populates="messages")
    sender = relationship("User", lazy="joined")

    def __repr__(self) -> str:
        return f"<ChatMessage {self.id} room={self.room_id} sender={self.sender_id}>"
