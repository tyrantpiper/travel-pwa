import json
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Get a trip to check the actual content structure
res = supabase.table("itineraries").select("id, title, content").limit(3).execute()
for trip in res.data:
    print(f"\n=== Trip: {trip['title']} ===")
    print(f"ID: {trip['id']}")
    content = trip.get("content") or {}
    daily_locs = content.get("daily_locations", {})
    print(f"daily_locations: {json.dumps(daily_locs, indent=2, ensure_ascii=False)}")
