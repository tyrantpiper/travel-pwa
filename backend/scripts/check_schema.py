import os
import sys
from supabase import create_client

# Environment Setup
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase Credentials")
    sys.exit(1)

try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"❌ Client Init Error: {e}")
    sys.exit(1)

def check_schema():
    print("🔍 [SCHEMA PROBE] Fetching one record from 'itinerary_items'...")
    try:
        # Fetch one record with all columns
        res = supabase.table("itinerary_items").select("*").limit(1).execute()
        
        if not res.data:
            print("⚠️ No records found in itinerary_items.")
            return

        record = res.data[0]
        columns = list(record.keys())
        print(f"✅ Columns found ({len(columns)}):")
        for col in sorted(columns):
            print(f"   - {col}")
            
        # Specific check for suspects
        suspects = ["website_link", "image_urls", "preview_metadata", "sort_order", "hide_navigation", "is_highlight", "is_private"]
        print("\n🔍 Checking Suspect Columns:")
        for s in suspects:
            exists = s in columns
            print(f"   - {s}: {'✅ Exists' if exists else '❌ MISSING (Possible 500 Cause)'}")

    except Exception as e:
        print(f"❌ Query failed: {e}")

if __name__ == "__main__":
    check_schema()
