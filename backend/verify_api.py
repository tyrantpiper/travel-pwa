
import httpx
import asyncio
import json

BASE_URL = "http://localhost:8000"
HEADERS = {"X-User-ID": "test_user_frontend_verify"}

async def run_verification():
    print("🚀 Starting Frontend API Compatibility Verification...")
    
    async with httpx.AsyncClient(base_url=BASE_URL, headers=HEADERS, timeout=30.0) as client:
        # 1. List Trips
        print("\n1. Testing Trip List...")
        try:
            resp = await client.get("/api/trips")
            print(f"   GET /api/trips: {resp.status_code}")
            if resp.status_code != 200:
                print(f"   ❌ Failed: {resp.text}")
                return
            trips = resp.json()
            print(f"   ✅ Found {len(trips)} trips")
            
            trip_id = None
            if trips:
                trip_id = trips[0]['id']
            else:
                # Create a temp trip if none exist
                print("   ⚠️ No trips found, creating one...")
                create_resp = await client.post("/api/trip/create-manual", json={
                    "title": "Frontend Verify Trip",
                    "start_date": "2026-01-01",
                    "end_date": "2026-01-05",
                    "creator_name": "Test User",
                    "user_id": "test_user_frontend_verify",
                    "cover_image": ""
                })
                if create_resp.status_code != 200:
                    print(f"   ❌ Creation Failed: {create_resp.text}")
                    return
                trip_id = create_resp.json()['trip_id']
                print(f"   ✅ Created temp trip: {trip_id}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return

        # 2. Get Trip Details
        print(f"\n2. Testing Trip Details for {trip_id}...")
        try:
            resp = await client.get(f"/api/trips/{trip_id}")
            print(f"   GET /api/trips/{trip_id}: {resp.status_code}")
            if resp.status_code == 200:
                print("   ✅ Trip details loaded")
            else:
                print(f"   ❌ Failed: {resp.text}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

        # 3. Chat (Verification of Chat Endpoint which was preserved in main.py)
        print("\n3. Testing Chat Endpoint...")
        try:
            chat_payload = {
                "message": "Hello from frontend verification",
                "history": [],
                "location": {"lat": 35.6895, "lng": 139.6917}
            }
            # Note: 401 is expected if API key is missing, which confirms endpoint is reachable
            # We just want to ensure it doesn't 500 or 404
            resp = await client.post("/api/chat", json=chat_payload)
            print(f"   POST /api/chat: {resp.status_code}")
            
            if resp.status_code == 401:
                print("   ✅ Endpoint reachable (Auth challenge received, normal for BYOK)")
            elif resp.status_code == 200:
                print("   ✅ Chat response received")
            else:
                print(f"   ⚠️ Unexpected status: {resp.status_code} (Check logs)")
        except Exception as e:
            print(f"   ❌ Error: {e}")

        # 4. Geocode Search (Router: /api/geocode)
        print("\n4. Testing Map Search...")
        try:
            search_payload = {
                "query": "Tokyo Tower",
                "limit": 1
            }
            resp = await client.post("/api/geocode/search", json=search_payload)
            print(f"   POST /api/geocode/search: {resp.status_code}")
            if resp.status_code == 200:
                results = resp.json()
                print(f"   ✅ Found: {results[0]['name'] if results else 'None'}")
            else:
                print(f"   ❌ Failed: {resp.text}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

        # 5. POI Nearby (Router: /api/poi)
        print("\n5. Testing POI Nearby...")
        try:
            resp = await client.get("/api/poi/nearby?lat=35.6895&lng=139.6917&category=restaurant")
            print(f"   GET /api/poi/nearby: {resp.status_code}")
            if resp.status_code == 200:
                print("   ✅ POI list loaded")
            else:
                print(f"   ❌ Failed: {resp.text}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_verification())
