"""
檢查資料庫中的孤兒私人項目
"""
import os
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

# Supabase 連線
url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_KEY", "")

if not url or not key:
    print("❌ 請設定環境變數 SUPABASE_URL 和 SUPABASE_KEY")
    exit(1)

supabase = create_client(url, key)

# 查所有行程
trips = supabase.table("itineraries").select("id, title, content").execute()

orphan_count = {"costs": 0, "tickets": 0, "checklists": 0}

for trip in trips.data:
    content = trip.get("content") or {}
    
    # 檢查 day_costs
    for day, items in content.get("day_costs", {}).items():
        if isinstance(items, list):
            for item in items:
                if item.get("is_private") and not item.get("private_owner_id"):
                    orphan_count["costs"] += 1
                    print(f"[COST] Trip: {trip['title']}, Day {day}: {item.get('item')}")
    
    # 檢查 day_tickets
    for day, items in content.get("day_tickets", {}).items():
        if isinstance(items, list):
            for item in items:
                if item.get("is_private") and not item.get("private_owner_id"):
                    orphan_count["tickets"] += 1
                    print(f"[TICKET] Trip: {trip['title']}, Day {day}: {item.get('name')}")
    
    # 檢查 day_checklists
    for day, items in content.get("day_checklists", {}).items():
        if isinstance(items, list):
            for item in items:
                if item.get("is_private") and not item.get("private_owner_id"):
                    orphan_count["checklists"] += 1
                    print(f"[CHECKLIST] Trip: {trip['title']}, Day {day}: {item.get('text')}")

print("\n" + "="*50)
print(f"孤兒私人項目統計:")
print(f"  - Costs: {orphan_count['costs']}")
print(f"  - Tickets: {orphan_count['tickets']}")
print(f"  - Checklists: {orphan_count['checklists']}")
print(f"  - 總計: {sum(orphan_count.values())}")
