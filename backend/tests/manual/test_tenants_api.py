import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:8000")
ADMIN_TOKEN = os.getenv("VERIFY_ADMIN_TOKEN")  # Need to get a valid token


async def test_list_tenants():
    if not ADMIN_TOKEN:
        print("❌ Skip: VERIFY_ADMIN_TOKEN not set")
        return

    headers = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{API_URL}/admin/v1/tenants", headers=headers)
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                print("✅ Success: Tenant list retrieved")
                print(resp.json())
            else:
                print(f"❌ Failed: {resp.text}")
        except Exception as e:
            print(f"❌ Error: {e}")


if __name__ == "__main__":
    asyncio.run(test_list_tenants())
