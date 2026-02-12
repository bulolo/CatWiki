import asyncio
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.infra.config import settings
from app.core.vector.vector_store import VectorStoreManager

async def check_indexes():
    manager = await VectorStoreManager.get_instance()
    await manager._ensure_initialized()  # Ensure connection is ready
    
    print(f"Checking indexes for table: {manager.collection_name}")
    
    sql = text(f"SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '{manager.collection_name}'")
    
    async with manager._sa_engine.connect() as conn:
        result = await conn.execute(sql)
        indexes = result.fetchall()
        
        if not indexes:
            print("❌ No indexes found!")
        else:
            print(f"Found {len(indexes)} indexes:")
            for idx in indexes:
                print(f"  - {idx.indexname}: {idx.indexdef}")
                
    await manager.close()

if __name__ == "__main__":
    asyncio.run(check_indexes())
