"""
AI-Sourcing Hub — Reusable Pagination Dependency

Provides:
    - PaginationParams: FastAPI query params dependency
    - PaginatedResponse: Generic response model

Usage:
    @router.get("/items")
    async def list_items(
        pagination: PaginationParams = Depends(),
        db: AsyncSession = Depends(get_db),
    ):
        query = select(Item).offset(pagination.skip).limit(pagination.page_size)
        result = await db.execute(query)
        items = result.scalars().all()
        total = await db.scalar(select(func.count(Item.id)))
        return PaginatedResponse(
            items=items,
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
        )
"""

import math
from typing import Generic, Sequence, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")


class PaginationParams:
    """FastAPI dependency for pagination query parameters.

    Usage:
        @router.get("/items")
        async def list_items(p: PaginationParams = Depends()):
            skip = p.skip
            limit = p.page_size
    """

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-indexed)"),
        page_size: int = Query(
            20, ge=1, le=100, description="Items per page (max 100)"
        ),
    ):
        self.page = page
        self.page_size = page_size

    @property
    def skip(self) -> int:
        """Number of items to skip (for SQL OFFSET)."""
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        """Alias for page_size (for SQL LIMIT)."""
        return self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper.

    Usage:
        return PaginatedResponse(
            items=items,
            total=total,
            page=p.page,
            page_size=p.page_size,
        )
    """

    items: Sequence[T]
    total: int
    page: int
    page_size: int

    @property
    def total_pages(self) -> int:
        """Total number of pages."""
        return math.ceil(self.total / self.page_size) if self.page_size > 0 else 0

    @property
    def has_next(self) -> bool:
        """Whether there is a next page."""
        return self.page < self.total_pages

    @property
    def has_previous(self) -> bool:
        """Whether there is a previous page."""
        return self.page > 1
