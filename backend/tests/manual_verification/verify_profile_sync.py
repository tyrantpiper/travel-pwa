import requests
import uuid
import time
import json

API_BASE = "http://localhost:8000/api"

def test_profile_sync():
    # 1. Create a random user UUID
    user_id = str(uuid.uuid4())
    original_name = f"Original Name {user_id[:8]}"
    print(f"🚀 Starting verification for user: {user_id}")
    
    # 2. Update/Create profile
    print(f"📝 Creating profile with name: {original_name}")
    resp = requests.put(
        f"{API_BASE}/users/me",
        headers={"X-User-ID": user_id},
        json={"name": original_name}
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to create profile: {resp.status_code}")
        return

    print("✅ Profile created.")

    # 3. Create a trip
    print("路 建立測試行程...")
    trip_req = {
        "title": "Sync Test Trip",
        "creator_name": original_name,
        "user_id": user_id,
        "items": [],
        "daily_locations": {},
        "day_notes": {},
        "day_costs": {},
        "day_tickets": {},
        "day_checklists": {},
        "ai_review": ""
    }
    
    resp = requests.post(f"{API_BASE}/save-itinerary", json=trip_req)
    if resp.status_code != 200:
        print(f"❌ Failed to create trip: {resp.status_code}")
        return
    
    # 🔧 FIX: Correct key is 'trip_id'
    trip_id = resp.json().get("trip_id")
    print(f"✅ Trip created. ID: {trip_id}")

    # 4. Verify initial member name
    print("🔍 驗證初始成員姓名...")
    resp = requests.get(f"{API_BASE}/trips/{trip_id}", headers={"X-User-ID": user_id})
    if resp.status_code != 200:
        print(f"❌ Failed to get trip details: {resp.status_code}")
        return
    
    detail = resp.json()
    members = detail.get('members', [])
    my_member = next((m for m in members if m['user_id'] == user_id), None)
    
    if not my_member:
        print("❌ User not found in trip members after creation")
        return
        
    print(f"   初始成員姓名: {my_member['user_name']} (Expected: {original_name})")
    if my_member['user_name'] != original_name:
        print("❌ Initial name mismatch!")
        return

    # 5. Update user name
    new_name = f"Updated Name {user_id[:8]}"
    print(f"🔄 更新使用者姓名為: {new_name}")
    resp = requests.put(
        f"{API_BASE}/users/me",
        headers={"X-User-ID": user_id},
        json={"name": new_name}
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to update profile: {resp.status_code}")
        print(f"   Response: {resp.text}")
        return
    print("✅ Name updated in users table.")

    # 6. Verify name propagation in trip_members
    print("🔍 驗證姓名同步結果 (Name Propagation)...")
    # Wait for trigger (though async triggers are usually fast, let's give it a tiny moment)
    time.sleep(1)
    
    resp = requests.get(f"{API_BASE}/trips/{trip_id}", headers={"X-User-ID": user_id})
    detail = resp.json()
    members = detail.get('members', [])
    my_member = next((m for m in members if m['user_id'] == user_id), None)
    
    if not my_member:
        print("❌ User disappeared from members list!?")
        return
        
    print(f"   同步後成員姓名: {my_member['user_name']}")
    
    if my_member['user_name'] == new_name:
        print("🎉 SUCCESS: Name correctly propagated to trip_members!")
    else:
        print(f"❌ FAILURE: Name did not propagate. Still shows: {my_member['user_name']}")

if __name__ == "__main__":
    test_profile_sync()
