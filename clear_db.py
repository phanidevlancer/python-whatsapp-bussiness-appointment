#!/usr/bin/env python3
"""
Clear all records from database tables.
Useful for development/testing to reset the database.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.core.config import settings


async def clear_database():
    """Clear all data from all tables."""
    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Disable foreign key checks temporarily
        await conn.execute(text("SET CONSTRAINTS ALL DEFERRED"))
        
        # List of tables to truncate (in order to respect foreign keys)
        tables = [
            "appointment_status_history",
            "appointments",
            "time_slots",
            "customers",
            "providers",
            "services",
            "admin_users",
            "user_sessions",
            "notifications",
        ]
        
        for table in tables:
            try:
                await conn.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
                print(f"✓ Cleared: {table}")
            except Exception as e:
                print(f"✗ Error clearing {table}: {e}")
        
        # Commit the transaction
        await conn.commit()
        
        print("\n✅ Database cleared successfully!")


if __name__ == "__main__":
    print("⚠️  This will delete ALL records from the database!")
    print("    Make sure you want to do this!\n")
    
    confirm = input("Type 'YES' to confirm: ")
    
    if confirm.strip() == "YES":
        asyncio.run(clear_database())
    else:
        print("❌ Cancelled - no data was deleted")
