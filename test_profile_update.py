import asyncio
import httpx
import uuid

async def test_update():
    url = "http://localhost:8000/api/users/me"
    
    async with httpx.AsyncClient() as client:
        headers = {
            "X-User-ID": "00000000-0000-0000-0000-000000000001",
            "Content-Type": "application/json"
        }
        print("Sending PUT request to:", url)
        try:
            resp = await client.put(url, headers=headers, json={"name": "Test User", "avatar_url": None})
            print(f"Status Code: {resp.status_code}")
            print(f"Response: {resp.text}")
        except Exception as e:
            print("Request failed:", e)

if __name__ == "__main__":
    asyncio.run(test_update())
