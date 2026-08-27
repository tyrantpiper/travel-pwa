import os
import sys
from supabase import create_client

# Environment Setup
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ ERROR: Missing Supabase environment variables.")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def probe_rpc():
    print("🔍 [PROBE] Checking for 'update_trip_credit_cards' RPC...")
    
    # Try to call it with a dummy ID
    dummy_id = "00000000-0000-0000-0000-000000000000"
    try:
        res = supabase.rpc("update_trip_credit_cards", {
            "target_trip_id": dummy_id,
            "new_cards": []
        }).execute()
        print("✅ RPC call finished (might not update if ID missing, but it exists)")
    except Exception as e:
        print(f"❌ RPC call FAILED: {e}")
        if "function" in str(e).lower() and "does not exist" in str(e).lower():
            print("🚨 LESION CONFIRMED: RPC function DOES NOT EXIST in the database!")

def audit_view_full():
    print("\n🔍 [PROBE] Auditing full content of '2026 東京家族之旅'...")
    trip_id = "3be7590a-aaf1-41ef-bafc-2fdd44815da2"
    res = supabase.table("itineraries").select("*").eq("id", trip_id).execute()
    if res.data:
        item = res.data[0]
        print(f"Title: {item.get('title')}")
        print(f"Content Field (Raw): {item.get('content')}")
        print(f"Content Keys: {list(item.get('content', {}).keys()) if item.get('content') else 'None/Empty'}")
    else:
        print("❌ Trip not found by ID")

if __name__ == "__main__":
    probe_rpc()
    audit_view_full()
