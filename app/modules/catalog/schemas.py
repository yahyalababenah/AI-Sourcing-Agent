"""Catalog module request/response Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CatalogProductResponse(BaseModel):
    """A single product listing in the global catalog.

    Aggregated from AI-extracted document items across all suppliers.
    """

    id: str = Field(..., description="Unique product entry identifier")
    product_name: Optional[str] = None
    model_number: Optional[str] = None
    unit_price_rmb: Optional[float] = None
    moq: Optional[int] = None
    weight_kg: Optional[float] = None
    dimensions: Optional[str] = None
    material: Optional[str] = None
    category: Optional[str] = Field(
        None,
        description="Product category derived from AI extraction or material field",
    )

    # Supplier info
    supplier_id: UUID
    supplier_name: str
    factory_name: Optional[str] = None
    location_in_china: Optional[str] = None

    # Source document
    document_id: UUID
    document_file_name: str
    extracted_at: Optional[datetime] = None


class CatalogListResponse(BaseModel):
    """Paginated catalog product listing."""

    items: list[CatalogProductResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
