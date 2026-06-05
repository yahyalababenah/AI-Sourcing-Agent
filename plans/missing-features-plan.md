# Targeted RFQ Matching — Phase 1 Implementation

> Scope: Exclusive 3-hour RFQ matching window + Public Pool
> F5 Visual Tree: DROPPED (tabular format kept)
> Cleanup: ✅ Saleor/Docker remnants cleaned, ✅ json_repair.py committed

---

## Database Schema

### 1. [`app/modules/intake/models.py`](app/modules/intake/models.py) — RFQ additions

```python
# ── NEW columns on existing RFQ model ──
matched_supplier_ids = Column(JSONB, nullable=True, default=list)
"""List of supplier UUIDs auto-matched by the matching algorithm."""

exclusive_deadline = Column(DateTime(timezone=True), nullable=True)
"""Timestamp when the 3-hour exclusive matching window expires."""

is_public = Column(Boolean, default=False, nullable=False)
"""False = exclusive window active, True = public pool."""

# ── NEW relationship ──
matches = relationship("RFQMatch", back_populates="rfq", cascade="all, delete-orphan")
```

### 2. [`app/modules/intake/models.py`](app/modules/intake/models.py) — New enum + RFQMatch model

```python
class MatchStatus(str, enum.Enum):
    PENDING = "pending"
    RESPONDED = "responded"
    EXPIRED = "expired"
    DECLINED = "declined"


class RFQMatch(Base):
    __tablename__ = "rfq_matches"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    match_score = Column(Float, default=0.0)
    match_reason = Column(Text, nullable=True)
    response_deadline = Column(DateTime(timezone=True), nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(MatchStatus, values_callable=lambda obj: [e.value for e in obj]), default=MatchStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    rfq = relationship("RFQ", back_populates="matches")
    supplier = relationship("app.modules.auth.models.User", foreign_keys=[supplier_id])
    
    __table_args__ = (UniqueConstraint("rfq_id", "supplier_id", name="uq_rfq_supplier_match"),)
```

### 3. [`app/modules/auth/models.py`](app/modules/auth/models.py) — SupplierProfile addition

```python
product_categories = Column(JSONB, nullable=True, default=list)
```

---

## Implementation Order

| Step | File | Description |
|------|------|-------------|
| 1 | [`app/modules/intake/models.py`](app/modules/intake/models.py) | Add RFQMatch model + new RFQ columns |
| 2 | [`app/modules/auth/models.py`](app/modules/auth/models.py) | Add product_categories to SupplierProfile |
| 3 | [`app/modules/intake/schemas.py`](app/modules/intake/schemas.py) | Add RFQMatch schemas (response, list) |
| 4 | [`alembic/versions/010_add_rfq_match_tables.py`](alembic/versions/010_add_rfq_match_tables.py) | Migration for RFQMatch |
| 5 | [`app/modules/intake/matcher.py`](app/modules/intake/matcher.py) | Matching algorithm |
| 6 | [`app/modules/intake/service.py`](app/modules/intake/service.py) | Match + exclusive window + public pool logic |
| 7 | [`app/modules/intake/router.py`](app/modules/intake/router.py) | API endpoints (matched, public, claim) |
| 8 | [`app/shared/celery_app.py`](app/shared/celery_app.py) | Scheduled task for public pool expiry |
| 9 | [`frontend/src/pages/rfq/SupplierRfqInbox.tsx`](frontend/src/pages/rfq/SupplierRfqInbox.tsx) | Exclusive/Public tabs + countdown |
| 10 | [`frontend/src/pages/rfq/RFQDetailPage.tsx`](frontend/src/pages/rfq/RFQDetailPage.tsx) | Match status display |
| 11 | [`frontend/src/services/intakeService.ts`](frontend/src/services/intakeService.ts) | New API calls |
| 12 | [`frontend/src/types/intake.ts`](frontend/src/types/intake.ts) | New TypeScript types |
