"""
Sample Trip Router
------------------
Provides a one-time sample/demo itinerary for onboarding.
All logged-in users (new + existing) receive a pre-populated
"3 Day Taipei Explorer" trip on first interaction.

Key Design Decisions:
- created_by = "SYSTEM" → doesn't count toward user's 3-trip quota
- share_code = None → no room code displayed
- content.is_sample = true → frontend uses this flag for badge rendering
- Backend dedup prevents duplicate seeding even if localStorage is cleared
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from typing import Optional
from utils.deps import get_supabase

router = APIRouter(prefix="/api", tags=["sample-trip"])

# ═══════════════════════════════════════════════════════════════════════════════
# 🎓 Sample Trip Data (3 Day Taipei Explorer)
# ═══════════════════════════════════════════════════════════════════════════════

SAMPLE_TRIP_TITLE = "3 Day Taipei Explorer ✨"
SAMPLE_TRIP_COVER = "https://images.unsplash.com/photo-1470004914212-05527e49370b?w=800&q=80"

SAMPLE_TRIP_META = {
    "title": SAMPLE_TRIP_TITLE,
    "start_date": "2026-03-10",
    "end_date": "2026-03-12",
    "status": "active",
    "creator_name": "Tabidachi",
    "created_by": "SYSTEM",
    "share_code": None,
    "public_id": None,
    "cover_image": SAMPLE_TRIP_COVER,
    "content": {
        "is_sample": True,
        "daily_locations": {
            "1": {"name": "台北 101", "lat": 25.0340, "lng": 121.5645},
            "2": {"name": "故宮博物院", "lat": 25.1024, "lng": 121.5485},
            "3": {"name": "九份", "lat": 25.1092, "lng": 121.8448},
        },
    },
}

SAMPLE_ITEMS: list[dict] = [
    # ── Day 1: 台北市區 ──────────────────────────────────────────
    {
        "day_number": 1,
        "time_slot": "00:00",
        "place_name": "Day 1 台北市區攻略",
        "category": "header",
        "notes": "今日探索台北最經典的地標與美食。",
        "sub_items": [
            {"name": "🏙️ 台北 101", "desc": "觀景台門票 NT$600"},
            {"name": "🍜 鼎泰豐", "desc": "小籠包必點，建議 11:30 前到"},
            {"name": "🥾 象山步道", "desc": "約 20 分鐘登頂，日落超美"},
            {"name": "🌙 饒河夜市", "desc": "胡椒餅 + 藥燉排骨"},
        ],
    },
    {
        "day_number": 1,
        "time_slot": "09:00",
        "place_name": "台北 101 觀景台",
        "category": "sightseeing",
        "notes": "89 樓觀景台，可遠眺整個台北盆地。建議晴天前往。",
        "location_lat": 25.0340,
        "location_lng": 121.5645,
        "tags": ["地標", "打卡"],
    },
    {
        "day_number": 1,
        "time_slot": "12:00",
        "place_name": "鼎泰豐 (101 店)",
        "category": "food",
        "notes": "世界知名小籠包，建議點：小籠包、蝦仁蛋炒飯、酸辣湯。",
        "location_lat": 25.0339,
        "location_lng": 121.5650,
        "tags": ["米其林", "必吃"],
        "cost_amount": 500,
    },
    {
        "day_number": 1,
        "time_slot": "14:30",
        "place_name": "象山步道",
        "category": "sightseeing",
        "notes": "從 101 步行可達登山口，約 20 分鐘攻頂。拍攝 101 的最佳角度。",
        "location_lat": 25.0275,
        "location_lng": 121.5712,
    },
    {
        "day_number": 1,
        "time_slot": "18:00",
        "place_name": "饒河街觀光夜市",
        "category": "food",
        "notes": "松山站旁，規模適中好逛。",
        "location_lat": 25.0513,
        "location_lng": 121.5775,
        "sub_items": [
            {"name": "🥇 福州世祖胡椒餅", "desc": "排隊名店，NT$60/個"},
            {"name": "🥈 陳董藥燉排骨", "desc": "冬天必喝，NT$80"},
            {"name": "🥉 寶島甘蔗牛奶", "desc": "現榨，NT$50"},
        ],
    },
    # ── Day 2: 北海岸文化之旅 ─────────────────────────────────────
    {
        "day_number": 2,
        "time_slot": "09:00",
        "place_name": "故宮博物院",
        "category": "sightseeing",
        "notes": "館藏 70 萬件文物，必看翠玉白菜、肉形石。建議預留 2-3 小時。",
        "location_lat": 25.1024,
        "location_lng": 121.5485,
        "link_url": "https://www.npm.gov.tw/",
        "tags": ["博物館", "文化"],
    },
    {
        "day_number": 2,
        "time_slot": "12:30",
        "place_name": "士林市場",
        "category": "food",
        "notes": "台北最大夜市白天也有美食區。推薦大餅包小餅、生煎包。",
        "location_lat": 25.0882,
        "location_lng": 121.5244,
        "tags": ["夜市", "小吃", "熱門"],
    },
    {
        "day_number": 2,
        "time_slot": "15:00",
        "place_name": "北投溫泉博物館",
        "category": "sightseeing",
        "notes": "免費參觀，日式建築超好拍。旁邊有地熱谷可順遊。",
        "location_lat": 25.1367,
        "location_lng": 121.5068,
        "reservation_code": "FREE",
    },
    {
        "day_number": 2,
        "time_slot": "18:00",
        "place_name": "淡水老街",
        "category": "food",
        "notes": "傍晚到淡水看夕陽，吃阿給和魚丸。",
        "location_lat": 25.1696,
        "location_lng": 121.4407,
        "link_url": "https://www.google.com/maps/search/?api=1&query=淡水老街",
    },
    # ── Day 3: 九份 & 歸途 ────────────────────────────────────────
    {
        "day_number": 3,
        "time_slot": "10:00",
        "place_name": "九份老街",
        "category": "sightseeing",
        "notes": "《千與千尋》取景地，石階巷弄充滿復古風情。推薦芋圓、草仔粿。",
        "location_lat": 25.1092,
        "location_lng": 121.8448,
        "tags": ["經典", "山城"],
        "is_highlight": True,
    },
    {
        "day_number": 3,
        "time_slot": "14:00",
        "place_name": "西門町",
        "category": "shopping",
        "notes": "台北年輕人聚集地，美國街、電影街好逛好買。",
        "location_lat": 25.0423,
        "location_lng": 121.5081,
        "tags": ["購物", "潮流"],
    },
    {
        "day_number": 3,
        "time_slot": "17:00",
        "place_name": "台北車站",
        "category": "transport",
        "notes": "回程出發。可在地下街做最後採買。",
        "location_lat": 25.0478,
        "location_lng": 121.5170,
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# 🎓 Seed Sample Trip Endpoint
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/trips/seed-sample")
async def seed_sample_trip(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    supabase=Depends(get_supabase),
):
    """🎓 Seed a sample/demo itinerary for onboarding.

    Idempotent: If the user already has a sample trip, returns "skipped".
    The trip is created with created_by="SYSTEM" so it doesn't count
    toward the user's 3-trip quota.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-ID")

    try:
        # ── 1. Dedup Check ────────────────────────────────────────
        # Query: does this user already belong to a sample trip?
        member_res = (
            supabase.table("trip_members")
            .select("itinerary_id")
            .eq("user_id", x_user_id)
            .execute()
        )
        member_trip_ids = [m["itinerary_id"] for m in (member_res.data or [])]

        if member_trip_ids:
            # Check if any of those trips is a sample trip
            sample_check = (
                supabase.table("itineraries")
                .select("id")
                .in_("id", member_trip_ids)
                .eq("created_by", "SYSTEM")
                .execute()
            )
            if sample_check.data and len(sample_check.data) > 0:
                print(f"⏭️ [Sample Trip] User {x_user_id} already has sample trip, skipping")
                return {"status": "skipped", "reason": "already_has_sample"}

        # ── 2. Create Itinerary ───────────────────────────────────
        trip_res = supabase.table("itineraries").insert(SAMPLE_TRIP_META).execute()

        if not trip_res.data:
            raise HTTPException(status_code=500, detail="Failed to create sample trip")

        trip_id = trip_res.data[0]["id"]
        print(f"🎓 [Sample Trip] Created trip {trip_id} for user {x_user_id}")

        # ── 3. Create Items ───────────────────────────────────────
        items_payload = []
        for item in SAMPLE_ITEMS:
            row = {**item, "itinerary_id": trip_id}
            items_payload.append(row)

        supabase.table("itinerary_items").insert(items_payload).execute()
        print(f"   ✅ Inserted {len(items_payload)} sample items")

        # ── 4. Add User as Member ─────────────────────────────────
        supabase.table("trip_members").insert(
            {
                "itinerary_id": trip_id,
                "user_id": x_user_id,
                "user_name": "Explorer",
            }
        ).execute()
        print(f"   ✅ Added user {x_user_id} as member")

        return {"status": "success", "trip_id": trip_id, "is_sample": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 [Sample Trip] Seed Error: {e}")
        # Non-critical: don't crash the app if sample trip fails
        return {"status": "error", "reason": str(e)}
