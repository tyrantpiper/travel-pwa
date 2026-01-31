import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase credentials in .env")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def fix_schema():
    print("🛠️ Applying schema fix: Adding created_at to trip_members...")
    try:
        # We'll use the supabase-py client to execute a raw SQL-like operation or a RPC if available.
        # However, for most Supabase setups, adding a column via REST API is not directly supported.
        # We will use an RPC call if it exists, or just log that it must be done via SQL Editor.
        # Wait, I have an even better way: I'll use a local migration script or try to use the 'query' rpc if enabled.
        
        # Let's check if the rpc "exec_sql" exists (often used in dev)
        # Actually, let's just try to insert a dummy record with the field to see if it fails, 
        # but the user said they'll do SQL. Wait, I can try to do it via a simple table update if I hijack another field? 
        # No, the best way is to provide the SQL or use a tool if I have one.
        
        # I'll just keep it as a diagnostic tool that identifies the need.
        pass
    except Exception as e:
        print(f"❌ Migration failed: {e}")

def check_data():
    with open("diagnostic_output.txt", "w", encoding="utf-8") as f:
        def log(msg):
            print(msg)
            f.write(msg + "\n")

        log("--- 🔍 Database Diagnostic ---")
        
        # Check itineraries
        try:
            res = supabase.table("itineraries").select("id, title, created_by, created_at").order("created_at", desc=True).limit(5).execute()
            log(f"\n📋 Latest 5 Itineraries:")
            if res.data:
                for trip in res.data:
                    log(f"  - [{trip['id']}] {trip['title']} (Created by: {trip['created_by']} at {trip['created_at']})")
            else:
                log("  (Empty)")
        except Exception as e:
            log(f"❌ Error fetching itineraries: {e}")

        # Check trip_members (Detailed)
        try:
            res = supabase.table("trip_members").select("*").limit(10).execute()
            log(f"\n👤 trip_members Sample Data (Total: {len(res.data) if res.data else 0}):")
            if res.data:
                for member in res.data:
                    log(f"  - Trip: {member.get('itinerary_id')}, User: {member.get('user_id')}, Name: {member.get('user_name')}")
            else:
                log("  (Empty)")
        except Exception as e:
            log(f"❌ Error fetching trip_members: {e}")

        # Check itinerary_items
        try:
            res = supabase.table("itinerary_items").select("id, itinerary_id, day_number, place_name").limit(5).execute()
            log(f"\n📍 itinerary_items Sample Data:")
            if res.data:
                for item in res.data:
                    log(f"  - Item: {item.get('id')}, Trip: {item.get('itinerary_id')}, Day {item.get('day_number')}: {item.get('place_name')}")
            else:
                log("  (Empty)")
        except Exception as e:
            log(f"❌ Error fetching itinerary_items: {e}")

        # Check specific User ID
        target_uid = "3f7abf22-b447-4281-b240-584549c79943"
        log(f"\n🎯 Probing specific Recovery Key: {target_uid}")
        
        try:
            res = supabase.table("itineraries").select("id, title").eq("created_by", target_uid).execute()
            log(f"  - Owned Itineraries: {len(res.data) if res.data else 0}")
            if res.data:
                for trip in res.data:
                    log(f"    * [{trip['id']}] {trip['title']}")
        except Exception as e:
            log(f"❌ Error probing itineraries for UID: {e}")

        try:
            res = supabase.table("trip_members").select("itinerary_id").eq("user_id", target_uid).execute()
            log(f"  - Trip Memberships: {len(res.data) if res.data else 0}")
            if res.data:
                for m in res.data:
                    log(f"    * Membership in Trip: {m['itinerary_id']}")
        except Exception as e:
            log(f"❌ Error probing members for UID: {e}")

        try:
            res = supabase.table("users").select("*").eq("id", target_uid).execute()
            log(f"  - User Profile (users table): {'Found' if res.data else 'Not Found'}")
            if res.data:
                log(f"    * Name: {res.data[0].get('name')}")
        except Exception as e:
            log(f"❌ Error probing users table: {e}")

if __name__ == "__main__":
    check_data()
