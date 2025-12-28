import json
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
s = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
r = s.table("itineraries").select("id, title, content").execute()

print("All trips in database:")
print("=" * 60)
for t in r.data:
    content = t.get("content") or {}
    daily_locs = content.get("daily_locations", {})
    print(f"ID: {t['id'][:8]}...")
    print(f"Title: {t['title']}")
    print(f"daily_locations: {json.dumps(daily_locs, ensure_ascii=False)}")
    print("-" * 40)
