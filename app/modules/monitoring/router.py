"""
AI-Sourcing Hub — Admin Monitoring Endpoints

/api/v1/admin/ai-costs              GET    Get AI cost statistics
/api/v1/admin/stats                 GET    Get system-wide statistics
/api/v1/admin/users                 GET    List all users (admin only)
/api/v1/admin/users/{id}/status     PUT    Activate/deactivate user (admin only)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.auth.models import User, UserRole
from app.modules.auth.schemas import UserResponse
from app.shared.database import get_db
from app.shared.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get(
    "/ai-costs",
    summary="Get AI cost statistics (admin only)",
)
async def get_ai_costs(
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_admin),
):
    """Get AI cost statistics from the ai_cost_log table.

    Returns:
        total_cost: Total estimated cost in USD.
        total_calls: Total number of AI API calls.
        cost_last_24h: Cost incurred in the last 24 hours.
        calls_last_24h: Number of calls in the last 24 hours.
        by_model: Breakdown of costs by model.
        by_provider: Breakdown of costs by provider.
    """
    # Total stats
    total_result = await db.execute(
        text("""
            SELECT
                COALESCE(SUM(estimated_cost_usd), 0) as total_cost,
                COUNT(*) as total_calls
            FROM ai_cost_log
            WHERE created_at >= NOW() - (:days || ' days')::INTERVAL
        """),
        {"days": days},
    )
    total_row = total_result.fetchone()

    # Last 24h stats
    last_24h_result = await db.execute(
        text("""
            SELECT
                COALESCE(SUM(estimated_cost_usd), 0) as cost_24h,
                COUNT(*) as calls_24h
            FROM ai_cost_log
            WHERE created_at >= NOW() - INTERVAL '24 hours'
        """),
    )
    last_24h_row = last_24h_result.fetchone()

    # By model breakdown
    by_model_result = await db.execute(
        text("""
            SELECT
                model,
                COUNT(*) as calls,
                COALESCE(SUM(estimated_cost_usd), 0) as cost
            FROM ai_cost_log
            WHERE created_at >= NOW() - (:days || ' days')::INTERVAL
            GROUP BY model
            ORDER BY cost DESC
        """),
        {"days": days},
    )
    by_model = [
        {"model": row[0], "calls": row[1], "cost": float(row[2])}
        for row in by_model_result.fetchall()
    ]

    # By provider breakdown
    by_provider_result = await db.execute(
        text("""
            SELECT
                provider,
                COUNT(*) as calls,
                COALESCE(SUM(estimated_cost_usd), 0) as cost
            FROM ai_cost_log
            WHERE created_at >= NOW() - (:days || ' days')::INTERVAL
            GROUP BY provider
            ORDER BY cost DESC
        """),
        {"days": days},
    )
    by_provider = [
        {"provider": row[0], "calls": row[1], "cost": float(row[2])}
        for row in by_provider_result.fetchall()
    ]

    return {
        "total_cost": float(total_row[0]) if total_row else 0.0,
        "total_calls": total_row[1] if total_row else 0,
        "cost_last_24h": float(last_24h_row[0]) if last_24h_row else 0.0,
        "calls_last_24h": last_24h_row[1] if last_24h_row else 0,
        "by_model": by_model,
        "by_provider": by_provider,
        "period_days": days,
    }


@router.get(
    "/stats",
    summary="Get system-wide statistics (admin only)",
)
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_admin),
):
    """Get system-wide statistics for the admin dashboard.

    Returns counts for: users, RFQs, documents, quotations, pricing rules.
    """
    # Count users by role
    users_result = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    users_by_role = {row[0].value if hasattr(row[0], "value") else row[0]: row[1] for row in users_result.fetchall()}

    # Total users
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar() or 0

    # Count RFQs
    rfqs_result = await db.execute(text("SELECT COUNT(*) FROM rfqs"))
    total_rfqs = rfqs_result.scalar() or 0

    # Count documents
    docs_result = await db.execute(text("SELECT COUNT(*) FROM documents"))
    total_documents = docs_result.scalar() or 0

    # Count quotations
    quotes_result = await db.execute(text("SELECT COUNT(*) FROM quotations"))
    total_quotations = quotes_result.scalar() or 0

    # Count pricing rules
    rules_result = await db.execute(text("SELECT COUNT(*) FROM pricing_rules"))
    total_pricing_rules = rules_result.scalar() or 0

    # Count catalog products (products inside extracted_entities->'products' across all EXTRACTED documents)
    catalog_result = await db.execute(
        text(
            "SELECT COALESCE(SUM(jsonb_array_length(extracted_entities->'products')), 0) "
            "FROM documents "
            "WHERE status = 'extracted' AND extracted_entities IS NOT NULL"
        )
    )
    total_catalog_products = catalog_result.scalar() or 0

    return {
        "total_users": total_users,
        "users_by_role": users_by_role,
        "total_rfqs": total_rfqs,
        "total_documents": total_documents,
        "total_quotations": total_quotations,
        "total_pricing_rules": total_pricing_rules,
        "total_catalog_products": total_catalog_products,
    }


@router.get(
    "/users",
    summary="List all users (admin only)",
)
async def list_users(
    role: str | None = Query(None, description="Filter by role (admin|agent|client)"),
    active_only: bool = Query(False, description="Only show active users"),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_admin),
):
    """List all users in the system. Admin only."""
    query = select(User).order_by(User.created_at.desc())

    if role:
        query = query.where(User.role == role)
    if active_only:
        query = query.where(User.is_active == True)

    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": len(users),
    }


@router.put(
    "/users/{user_id}/status",
    summary="Activate or deactivate a user (admin only)",
)
async def toggle_user_status(
    user_id: UUID,
    is_active: bool = Query(..., description="Set user active status"),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_admin),
):
    """Activate or deactivate a user account. Admin only.

    Deactivating a user prevents them from logging in or using the API.
    """
    from app.shared.exceptions import NotFoundException

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise NotFoundException(
            message="User not found",
            resource="User",
            resource_id=str(user_id),
        )

    user.is_active = is_active
    await db.commit()
    await db.refresh(user)

    return UserResponse.model_validate(user)
