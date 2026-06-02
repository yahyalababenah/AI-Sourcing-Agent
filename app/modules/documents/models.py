"""
AI-Sourcing Hub — Document & Upload Models

Handles uploaded PDFs/images, extracted text, and parsed results.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.shared.database import Base


class DocumentType(str, enum.Enum):
    PDF = "pdf"
    IMAGE = "image"
    EXCEL = "excel"
    OTHER = "other"


class DocumentStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    EXTRACTED = "extracted"
    FAILED = "failed"


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(
        UUID(as_uuid=True), ForeignKey("rfqs.id"), nullable=False, index=True
    )
    uploaded_by_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)  # MinIO/S3 object key
    file_size_bytes = Column(
        "file_size_bytes",
        nullable=True,
    )
    content_type = Column(String(100), nullable=True)
    doc_type = Column(
        Enum(DocumentType), default=DocumentType.PDF, nullable=False
    )
    status = Column(
        Enum(DocumentStatus), default=DocumentStatus.UPLOADED, nullable=False, index=True
    )
    extracted_text = Column(Text, nullable=True)
    extracted_entities = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ---- Relationships ----
    rfq = relationship("app.modules.intake.models.RFQ", back_populates="documents")
    uploaded_by = relationship("app.modules.auth.models.User", back_populates="documents")

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, file={self.file_name}, status={self.status})>"
