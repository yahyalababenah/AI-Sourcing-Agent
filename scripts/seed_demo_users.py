#!/usr/bin/env python3
"""
AI-Sourcing Hub — Seed Demo Users

Creates 3 demo accounts — one for each role: admin, agent, client.
Also creates corresponding profiles (ClientProfile / SupplierProfile)
for client and agent users respectively.

Usage:
    python -m scripts.seed_demo_users
"""

import asyncio
import uuid

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Load all models FIRST so SQLAlchemy can resolve relationships
from app.main import create_app
from app.modules.auth.models import ClientProfile, SupplierProfile, User, UserRole
from app.shared.database import async_session_factory

DEMO_USERS = [
    {
        "email": "admin@example.com",
        "password": "Demo@123456!",
        "full_name": "إدارة النظام",
        "role": UserRole.ADMIN,
        "phone": "+962791111111",
    },
    {
        "email": "agent@example.com",
        "password": "Demo@123456!",
        "full_name": "أحمد الوكيل",
        "role": UserRole.AGENT,
        "phone": "+962792222222",
    },
    {
        "email": "client@example.com",
        "password": "Demo@123456!",
        "full_name": "محمد العميل",
        "role": UserRole.CLIENT,
        "phone": "+962793333333",
    },
]

# Profile data for agent and client users
DEMO_PROFILES = {
    "agent@example.com": {
        "factory_name": "Future Factory Ltd",
        "location_in_china": "Guangzhou, Guangdong",
        "specialty": "Electronics & Home Appliances",
        "business_registration_number": "CN-GZ-2024-8842",
    },
    "client@example.com": {
        "company_name": "شركة المستقبل للتجارة",
        "preferred_port": "Aqaba",
        "contact_number": "+962793333333",
    },
}


async def seed():
    """Insert demo users and their profiles into the database."""
    # Initialize app to load all models
    app = create_app()

    async with async_session_factory() as session:
        created = 0
        skipped = 0

        for user_data in DEMO_USERS:
            # Check if user already exists
            result = await session.execute(
                select(User).where(User.email == user_data["email"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"⏭️  User already exists: {user_data['email']}")
                skipped += 1
                continue

            password_hash = bcrypt.hashpw(
                user_data["password"].encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")

            user = User(
                id=uuid.uuid4(),
                email=user_data["email"],
                password_hash=password_hash,
                full_name=user_data["full_name"],
                role=user_data["role"],
                phone=user_data["phone"],
                is_active=True,
            )
            session.add(user)
            await session.flush()  # Get user.id

            # Create profile for agent/client users
            profile_data = DEMO_PROFILES.get(user_data["email"])
            if user_data["role"] == UserRole.CLIENT and profile_data:
                profile = ClientProfile(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    company_name=profile_data["company_name"],
                    preferred_port=profile_data.get("preferred_port"),
                    contact_number=profile_data.get("contact_number"),
                )
                session.add(profile)
                print(f"   └─ Created ClientProfile: {profile_data['company_name']}")

            elif user_data["role"] == UserRole.AGENT and profile_data:
                profile = SupplierProfile(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    factory_name=profile_data["factory_name"],
                    location_in_china=profile_data["location_in_china"],
                    specialty=profile_data.get("specialty"),
                    business_registration_number=profile_data.get("business_registration_number"),
                )
                session.add(profile)
                print(f"   └─ Created SupplierProfile: {profile_data['factory_name']}")

            created += 1
            print(f"✅ Created: {user_data['email']} ({user_data['role'].value})")

        await session.commit()
        print(f"\n📊 Summary: {created} created, {skipped} skipped.")
        print("🔑 All passwords: password123")


if __name__ == "__main__":
    asyncio.run(seed())
