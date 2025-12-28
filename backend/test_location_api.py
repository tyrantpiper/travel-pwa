import requests
import json

trip_id = "0f2410b7-65f7-4489-a5b7-52f435d9213d"
url = f"http://localhost:8000/api/trips/{trip_id}/location"

payload = {
    "day": 1,
    "name": "大阪",
    "lat": 34.6937,
    "lng": 135.5023
}

print(f"Testing PATCH {url}")
print(f"Payload: {json.dumps(payload, ensure_ascii=False)}")

try:
    res = requests.patch(url, json=payload)
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")
except Exception as e:
    print(f"Error: {e}")

# Now verify the data
print("\n--- Verifying saved data ---")
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

res = supabase.table("itineraries").select("content").eq("id", trip_id).single().execute()
content = res.data.get("content") or {}
daily_locs = content.get("daily_locations", {})
print(f"daily_locations after PATCH: {json.dumps(daily_locs, indent=2, ensure_ascii=False)}")
