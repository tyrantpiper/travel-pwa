
import requests
import json
import uuid

# Configuration
BASE_URL = "http://localhost:8000/api"
HEADERS = {"Content-Type": "application/json"}

# Test Data
USER_ID = str(uuid.uuid4())
USER_NAME = "Test User"

def run_test():
    print("🚀 Starting Credit Card Sharing Safe Merge Verification...")

    # 1. Create a Manual Trip
    print("\n1️⃣ Creating Test Trip...")
    trip_payload = {
        "title": "Card Sharing Test",
        "creator_name": USER_NAME,
        "user_id": USER_ID,
        "start_date": "2026-01-01",
        "end_date": "2026-01-05",
        "cover_image": ""
    }
    res = requests.post(f"{BASE_URL}/trip/create-manual", json=trip_payload, headers=HEADERS)
    if res.status_code != 200:
        print(f"❌ Failed to create trip: {res.text}")
        return
    trip_id = res.json()["trip_id"]
    print(f"   ✅ Trip Created: {trip_id}")

    # 2. Add Initial Shared Cards (User A)
    print("\n2️⃣ User A adds Shared Card A...")
    card_a = {
        "id": str(uuid.uuid4()),
        "name": "Card A (Shared)",
        "rewardRate": 3.0,
        "rewardLimit": 500,
        "notes": "User A's Card",
        "is_public": True,
        "creator_id": USER_ID
    }
    
    # Simulate fetch - currently empty
    
    # Save Card A
    update_payload = {
        "flight_info": {},
        "hotel_info": {},
        "credit_cards": [card_a]
    }
    res = requests.patch(f"{BASE_URL}/trips/{trip_id}/info", json=update_payload, headers=HEADERS)
    if res.status_code != 200:
        print(f"❌ Failed to add Card A: {res.text}")
        return
    print("   ✅ Card A Saved")

    # 3. Simulate User B Adding Card B (Safe Merge Test)
    # User B fetches current state, sees Card A.
    # User B adds Card B.
    # User B sends [Card A, Card B]
    # WAIT! Safe merge logic protects against User C adding Card C simultaneously.
    # Let's simulate a RACE CONDITION.
    
    print("\n3️⃣ Simulating Race Condition (Safe Merge)...")
    
    # Scenario: User B and User C both load the page with [Card A]
    # User B adds Card B -> sends [Card A, Card B]
    # User C adds Card C -> sends [Card A, Card C]
    # Expected Result: Both B and C should exist (Union), or at least not wipe each other out entirely?
    # Actually, my Safe Merge logic was: DB = (DB - RequestIDs) + Request
    # If User C sends [Card A, Card C] (without Card B because they didn't see it),
    # And User B already saved [Card A, Card B].
    # Then DB has [Card A, Card B].
    # User C Request has IDs {A, C}.
    # DB remaining = [Card A, Card B] excluding {A, C} -> {B} remains!
    # DB Result = {B} + {A, C} = {A, B, C}.
    # SUCCESS! The logic holds!

    # Step 3a: User B saves Card B
    print("   👤 User B saves Card B...")
    card_b = {
        "id": str(uuid.uuid4()),
        "name": "Card B (User B)",
        "rewardRate": 2.0,
        "rewardLimit": 0,
        "notes": "",
        "is_public": True
    }
    # User B sees [A], sends [A, B]
    payload_b = {
        "flight_info": {}, "hotel_info": {},
        "credit_cards": [card_a, card_b]
    }
    requests.patch(f"{BASE_URL}/trips/{trip_id}/info", json=payload_b, headers=HEADERS)
    print("   ✅ User B Saved")

    # Step 3b: User C (who hasn't seen B yet) saves Card C
    print("   👤 User C saves Card C (Concurrent)...")
    card_c = {
        "id": str(uuid.uuid4()),
        "name": "Card C (User C)",
        "rewardRate": 5.0,
        "rewardLimit": 0,
        "notes": "",
        "is_public": True
    }
    # User C sees [A], sends [A, C] (Unknowning of B)
    payload_c = {
        "flight_info": {}, "hotel_info": {},
        "credit_cards": [card_a, card_c]
    }
    requests.patch(f"{BASE_URL}/trips/{trip_id}/info", json=payload_c, headers=HEADERS)
    print("   ✅ User C Saved")

    # 4. Verify Final State
    print("\n4️⃣ Verifying Final State (Should have A, B, C)...")
    res = requests.get(f"{BASE_URL}/trips/{trip_id}", headers=HEADERS)
    trip_data = res.json()
    final_cards = trip_data.get("credit_cards", [])
    
    ids = {c["id"] for c in final_cards}
    names = [c["name"] for c in final_cards]
    print(f"   🃏 Final Cards: {names}")
    
    if len(ids) == 3:
        print("   ✅ SUCCESS: All 3 cards persisted (Safe Merge worked)!")
    else:
        print(f"   ❌ FAILED: Expected 3 cards, found {len(ids)}")
        if card_b["id"] not in ids: print("      ⚠️ Card B was lost (User C overwrote User B)")

if __name__ == "__main__":
    run_test()
