
import asyncio
import httpx
import json

API_URL = "http://localhost:8000"

async def verify_weather_persistence():
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("\n🌧️ Testing Weather Location Persistence...")

        # 1. Create a Trip
        print("   1️⃣ Creating Trip...")
        trip_payload = {
            "title": "Weather Test Trip",
            "creator_name": "Tester",
            "user_id": "test-user-weather",
            "start_date": "2025-06-01",
            "end_date": "2025-06-05",
            "cover_image": "https://example.com/img.jpg"
        }
        res = await client.post(f"{API_URL}/api/trip/create-manual", json=trip_payload)
        if res.status_code != 200:
            print(f"   ❌ Create Trip Failed: {res.text}")
            return
        
        trip_id = res.json()["trip_id"]
        print(f"   ✅ Created Trip: {trip_id}")

        # 2. Update Location for Day 1
        print("   2️⃣ Updating Location for Day 1...")
        loc_payload = {
            "day": 1,
            "name": "Tokyo Station",
            "lat": 35.6812,
            "lng": 139.7671
        }
        res = await client.patch(f"{API_URL}/api/trips/{trip_id}/location", json=loc_payload)
        if res.status_code != 200:
            print(f"   ❌ Update Location Failed: {res.text}")
            return
        print("   ✅ Update Success")

        # 3. Read Trip Back
        print("   3️⃣ Reading Trip Data...")
        res = await client.get(f"{API_URL}/api/trips/{trip_id}")
        if res.status_code != 200:
            print(f"   ❌ Get Trip Failed: {res.text}")
            return
        
        data = res.json()
        daily_locs = data.get("daily_locations", {})
        print(f"   🔍 Daily Locations: {json.dumps(daily_locs, indent=2)}")

        # 4. Verify
        day1_loc = daily_locs.get("1")
        if not day1_loc:
            print("   ❌ Key '1' not found in daily_locations!")
        elif day1_loc["name"] != "Tokyo Station":
             print(f"   ❌ Name mismatch: Expected 'Tokyo Station', got '{day1_loc['name']}'")
        else:
            print("   ✅ Weather Persistence VERIFIED!")

        # Cleanup
        await client.delete(f"{API_URL}/api/trips/{trip_id}")

if __name__ == "__main__":
    asyncio.run(verify_weather_persistence())
