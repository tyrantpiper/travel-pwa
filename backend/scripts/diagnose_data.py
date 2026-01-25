import os
import sys
import json
from supabase import create_client

# Environment Setup
# Need to load env vars from .env.local or .env if not in process scope
# But assuming the environment has them or we can pass them.
# The previous script implies they rely on os.environ.

# We will try to read from ../.env if possible, simplified for now
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
except ImportError:
    pass

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    # Try looking in a local file just in case
    print("⚠️ Missing Env Vars in process, checking common file locations...")
    # This is a bit hacky but for a probe script it works
    # (Omitted complex loading logic for brevity, relying on user environment usually working for this agent)
    # If this fails, I'll ask user for vars, but usually they are set in the session? 
    # Actually Agent environment might not have them.
    # I saw 'python main.py' running... so the env is likely set in the backend folder context?
    pass

# We'll try to connect. If it fails, I'll report it.
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"❌ Failed to init Supabase client: {e}")
    sys.exit(1)

def diagnose():
    print("🔍 [DIAGNOSE] Fetching 5 most recent itineraries...")
    try:
        # 🔧 FIX: Use created_at instead of updated_at since the latter doesn't exist
        res = supabase.table("itineraries").select("*").order("created_at", desc=True).limit(5).execute()
        
        if not res.data:
            print("❌ No itineraries found.")
            return

        for trip in res.data:
            print(f"n──────────────────────────────────────────────────")
            print(f"🆔 ID: {trip['id']}")
            print(f"📅 Created: {trip['created_at']}")
            print(f"🏷️ Title: {trip['title']}")
            print(f"👤 Creator: {trip['created_by']}")
            
            # Check Top-Level Columns
            notes_tl = trip.get('day_notes')
            costs_tl = trip.get('day_costs')
            
            has_tl_notes = bool(notes_tl and len(str(notes_tl)) > 2) # check for {} or empty
            has_tl_costs = bool(costs_tl and len(str(costs_tl)) > 2)

            print(f"   [Top-Level] day_notes: {'✅ Found' if has_tl_notes else '❌ Empty/Null'} ({str(notes_tl)[:50]}...)")
            print(f"   [Top-Level] day_costs: {'✅ Found' if has_tl_costs else '❌ Empty/Null'} ({str(costs_tl)[:50]}...)")

            # Check Content JSON Column
            content = trip.get('content') or {}
            notes_ct = content.get('day_notes')
            costs_ct = content.get('day_costs')
            
            has_ct_notes = bool(notes_ct and len(str(notes_ct)) > 2)
            has_ct_costs = bool(costs_ct and len(str(costs_ct)) > 2)
            
            print(f"   [Content]   day_notes: {'✅ Found' if has_ct_notes else '❌ Empty/Null'} ({str(notes_ct)[:50]}...)")
            print(f"   [Content]   day_costs: {'✅ Found' if has_ct_costs else '❌ Empty/Null'} ({str(costs_ct)[:50]}...)")
            
            # Check for structural drift
            if has_tl_notes and not has_ct_notes:
                print("   ⚠️ DATA IN OLD SCHEMA ONLY")
            elif has_ct_notes and not has_tl_notes:
                print("   ⚠️ DATA IN NEW SCHEMA ONLY")
            elif not has_tl_notes and not has_ct_notes:
                print("   🔥 DATA MISSING IN BOTH LOCATIONS")
            else:
                print("   ✅ Data exists in both")

    except Exception as e:
        print(f"❌ Query failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    diagnose()
