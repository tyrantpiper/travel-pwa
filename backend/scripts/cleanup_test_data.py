import os
import sys
from supabase import create_client
from dotenv import load_dotenv

# Add backend directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.append(backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Supabase credentials not found in env.")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def cleanup_test_data(target_code=None):
    """
    Cleans up test data from the database.
    If target_code is provided, deletes that specific trip.
    Otherwise, deletes all trips with 'TEST-' prefix in share_code.
    """
    print("🧹 Starting Test Data Cleanup...")
    
    try:
        query = supabase.table("itineraries").delete()
        
        if target_code:
            print(f"   Targeting specific share code: {target_code}")
            query = query.eq("share_code", target_code)
        else:
            print("   Targeting all 'TEST-' prefix trips")
            query = query.like("share_code", "TEST-%")
            
        res = query.execute()
        
        # Supabase-py v2 return structure check
        if hasattr(res, 'data'):
            count = len(res.data)
            print(f"✅ Cleanup successful. Deleted {count} test records.")
        else:
             print("✅ Cleanup executed (No count available).")
             
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Allow passing a specific code via arg, e.g., python cleanup_test_data.py TEST-1234
    target = sys.argv[1] if len(sys.argv) > 1 else None
    cleanup_test_data(target)
