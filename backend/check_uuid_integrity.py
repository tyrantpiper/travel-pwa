import os
import uuid
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def is_valid_uuid(val):
    try:
        uuid.UUID(str(val))
        return True
    except ValueError:
        return False

print("--- Checking trip_members User ID Integrity ---")
res = supabase.table('trip_members').select('id, user_id, user_name').execute()

invalid_records = []
valid_count = 0

for record in res.data:
    uid = record.get('user_id')
    if not uid:
        print(f"⚠️  Blank User ID at Record: {record}")
        time.sleep(0.1)
        continue
        
    if is_valid_uuid(uid):
        valid_count += 1
    else:
        invalid_records.append(record)

print(f"\n✅ Valid Records: {valid_count}")
print(f"❌ Invalid Records: {len(invalid_records)}")

if invalid_records:
    print("\n--- Invalid Details ---")
    for r in invalid_records:
        print(f"ID: {r.get('id')} | Name: {r.get('user_name')} | UserID: '{r.get('user_id')}'")
else:
    print("\n✨ All records are safe to migrate to UUID type!")
