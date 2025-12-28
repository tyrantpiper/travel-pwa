import requests
import json

# Get all trips first
print("=== Checking all trips ===")
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
s = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
r = s.table("itineraries").select("id, title").execute()

for t in r.data[:3]:
    trip_id = t['id']
    print(f"\n--- Trip: {t['title']} ---")
    
    # Test local API
    try:
        res = requests.get(f"http://localhost:8000/api/trips/{trip_id}", timeout=5)
        data = res.json()
        print(f"API Response daily_locations: {json.dumps(data.get('daily_locations', {}), ensure_ascii=False)}")
    except Exception as e:
        print(f"Error: {e}")
