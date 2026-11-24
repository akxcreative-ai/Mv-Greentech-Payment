"""
MV Payment Approval System - Administrative CLI.
Provides command-line utilities for system administration, including creating superadmin users.
"""

import argparse
import asyncio
import sys
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.role import Role, RoleEnum
from app.models.user import User
from app.utils.security import hash_password


async def create_admin(email: str, name: str, password: str):
    """Create a new superadmin user in the database."""
    async with AsyncSessionLocal() as session:
        try:
            # Check if user already exists
            query = select(User).where(User.email == email.lower().strip())
            result = await session.execute(query)
            existing_user = result.scalar_one_or_none()

            if existing_user:
                print(f"[!] User with email '{email}' already exists.")
                return

            # Check for or create super_admin role
            role_query = select(Role).where(Role.name == RoleEnum.SUPER_ADMIN.value)
            role_result = await session.execute(role_query)
            admin_role = role_result.scalar_one_or_none()

            if not admin_role:
                admin_role = Role(
                    name=RoleEnum.SUPER_ADMIN.value,
                    display_name="Super Administrator",
                    description="Full administrative access to all system functions",
                    is_system_role=True,
                )
                session.add(admin_role)
                await session.flush()

            # Split name into first and last
            parts = name.strip().split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else "Admin"

            # Hash the password
            hashed_pw = hash_password(password)

            # Create the superadmin user record
            admin_user = User(
                email=email.lower().strip(),
                first_name=first_name,
                last_name=last_name,
                password_hash=hashed_pw,
                role_id=admin_role.id,
                is_active=True,
                is_locked=False,
            )
            session.add(admin_user)
            await session.commit()
            print(f"[✓] Superadmin '{name}' ({email}) created successfully.")
        except Exception as e:
            await session.rollback()
            print(f"[x] Failed to create admin: {e}", file=sys.stderr)
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="MV Payment Approval CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # create-admin sub-command
    admin_parser = subparsers.add_parser("create-admin", help="Create a new superadmin user")
    admin_parser.add_argument("--email", required=True, help="Superadmin email address")
    admin_parser.add_argument("--name", required=True, help="Superadmin full name")
    admin_parser.add_argument("--password", required=True, help="Superadmin password")

    args = parser.parse_args()

    if args.command == "create-admin":
        asyncio.run(create_admin(args.email, args.name, args.password))


if __name__ == "__main__":
    main()
