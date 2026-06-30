"""
AI-Sourcing Hub — Admin Monitoring & Verification Endpoints

/api/v1/admin/ai-costs                   GET    Get AI cost statistics
/api/v1/admin/stats                      GET    Get system-wide statistics
/api/v1/admin/users                      GET    List all users (admin only)
/api/v1/admin/users/{id}/status          PUT    Activate/deactivate user (admin only)
/api/v1/admin/users/{id}/verification    PUT    Update supplier verification status (admin only)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.auth.models import User, UserRole, VerificationStatus
from app.modules.auth.schemas import (
    SupplierProfileResponse,
    UpdateVerificationRequest,
    UserResponse,
    build_user_response,
)
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
            WHERE created_at >= NOW() - make_interval(days => :days)
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
            WHERE created_at >= NOW() - make_interval(days => :days)
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
            WHERE created_at >= NOW() - make_interval(days => :days)
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
    # Single query fetching all counts at once — avoids 7 round trips to Supabase.
    row = (await db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM users)                                          AS total_users,
            (SELECT COUNT(*) FROM rfqs)                                           AS total_rfqs,
            (SELECT COUNT(*) FROM documents)                                      AS total_documents,
            (SELECT COUNT(*) FROM quotations)                                     AS total_quotations,
            (SELECT COUNT(*) FROM pricing_rules)                                  AS total_pricing_rules,
            COALESCE((
                SELECT SUM(jsonb_array_length(extracted_entities->'products'))
                FROM documents
                WHERE status = 'extracted' AND extracted_entities IS NOT NULL
            ), 0)                                                                 AS total_catalog_products,
            (
                SELECT json_object_agg(role, cnt)
                FROM (SELECT role::text, COUNT(*) AS cnt FROM users GROUP BY role) t
            )                                                                     AS users_by_role
    """))).fetchone()

    return {
        "total_users":            int(row.total_users),
        "users_by_role":          row.users_by_role or {},
        "total_rfqs":             int(row.total_rfqs),
        "total_documents":        int(row.total_documents),
        "total_quotations":       int(row.total_quotations),
        "total_pricing_rules":    int(row.total_pricing_rules),
        "total_catalog_products": int(row.total_catalog_products),
    }


@router.get(
    "/users",
    summary="List all users (admin only)",
)
async def list_users(
    role: str | None = Query(None, description="Filter by role (admin|agent|client)"),
    active_only: bool = Query(False, description="Only show active users"),
    verification_status: str | None = Query(
        None, description="Filter suppliers by verification status (pending|verified|rejected)"
    ),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_admin),
):
    """List all users in the system. Admin only.

    Supports optional filtering by role, active status, and supplier verification status.
    When verification_status filter is applied, only supplier (agent) users with a matching
    verification status are returned. Eager-loads profiles so nested profile data is available.
    """
    query = (
        select(User)
        .options(
            selectinload(User.client_profile),
            selectinload(User.supplier_profile),
        )
        .order_by(User.created_at.desc())
    )

    if role:
        query = query.where(User.role == role)
    if active_only:
        query = query.where(User.is_active == True)
    if verification_status:
        # Join supplier_profiles and filter by verification_status
        from app.modules.auth.models import SupplierProfile

        query = (
            query.join(SupplierProfile, User.id == SupplierProfile.user_id)
            .where(SupplierProfile.verification_status == verification_status)
        )

    result = await db.execute(query)
    users = result.unique().scalars().all()

    return {
        "items": [build_user_response(u) for u in users],
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

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.client_profile),
            selectinload(User.supplier_profile),
        )
        .where(User.id == user_id)
    )
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

    return build_user_response(user)


@router.put(
    "/users/{user_id}/verification",
    summary="Update supplier verification status (admin only)",
)
async def update_verification_status(
    user_id: UUID,
    body: UpdateVerificationRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_admin),
):
    """Update the verification status of a supplier's profile.

    Admin-only endpoint that allows approving or rejecting a supplier's
    registration by updating the verification_status field on their
    SupplierProfile. A rejection reason can optionally be provided.

    Valid transitions: pending -> verified | rejected
    """
    from app.modules.auth.models import SupplierProfile
    from app.shared.exceptions import NotFoundException, ValidationError

    # Find the user
    result = await db.execute(
        select(User)
        .options(selectinload(User.supplier_profile))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise NotFoundException(
            message="User not found",
            resource="User",
            resource_id=str(user_id),
        )

    # Only supplier/agent profiles have verification status
    if user.role != UserRole.AGENT:
        raise ValidationError(
            message="Only supplier (agent) profiles can be verified",
            details={"user_role": user.role.value},
        )

    # Validate the new status
    try:
        new_status = VerificationStatus(body.verification_status)
    except ValueError:
        raise ValidationError(
            message=f"Invalid verification status '{body.verification_status}'. "
                    f"Must be one of: {', '.join(v.value for v in VerificationStatus)}",
            details={"valid_statuses": [v.value for v in VerificationStatus]},
        )

    if user.supplier_profile is None:
        raise NotFoundException(
            message="Supplier profile not found for this user",
            resource="SupplierProfile",
            resource_id=str(user_id),
        )

    # Require rejection reason when rejecting
    if new_status == VerificationStatus.REJECTED and not body.rejection_reason:
        raise ValidationError(
            message="Rejection reason is required when rejecting a supplier",
            details={"field": "rejection_reason"},
        )

    user.supplier_profile.verification_status = new_status
    await db.commit()
    await db.refresh(user)

    return build_user_response(user)
