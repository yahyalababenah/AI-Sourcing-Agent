"""Intake module request/response Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    """Arabic text translation request."""

    raw_text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        examples=["عاوز 500 كرتونة صابون زيت زيتون حلب بوزن 200 جرام"],
    )


class TranslateResponse(BaseModel):
    """Translation result with extracted entities."""

    request_id: str
    chinese_query: str
    entities: dict
    confidence: float = Field(ge=0.0, le=1.0)


class RFQCreate(BaseModel):
    """RFQ creation request (after translation) — used by agents and admins."""

    client_name: Optional[str] = Field(None, max_length=255)
    client_phone: Optional[str] = Field(None, max_length=50)
    client_request_arabic: Optional[str] = None
    translated_query_chinese: Optional[str] = None
    extracted_entities: Optional[dict] = None
    destination_port: Optional[str] = Field(None, max_length=100)
    target_currency: Optional[str] = Field(default="JOD", max_length=10)


class ClientRFQCreate(BaseModel):
    """Restricted RFQ creation schema for clients — no agent/translation fields."""

    client_name: Optional[str] = Field(None, max_length=255)
    client_phone: Optional[str] = Field(None, max_length=50)
    client_request_arabic: Optional[str] = None
    destination_port: Optional[str] = Field(None, max_length=100)
    target_currency: Optional[str] = Field(default="JOD", max_length=10)


class RFQResponse(BaseModel):
    """RFQ detail response."""

    id: UUID
    agent_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_request_arabic: Optional[str] = None
    translated_query_chinese: Optional[str] = None
    status: str
    extracted_entities: Optional[dict] = None
    destination_port: Optional[str] = None
    target_currency: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RFQListResponse(BaseModel):
    """Paginated RFQ list response."""

    items: list[RFQResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
