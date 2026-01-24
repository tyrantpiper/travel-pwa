"""
Trips Router
------------
Handles all trip-related API endpoints including:
- Trip CRUD operations
- Day management (add/delete)
- Item management (CRUD)
- Legacy endpoints (save-itinerary, join-trip)

Note: This is a large router containing 17 endpoints.
"""

import re
import traceback
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header

from models.base import (
    JoinTripRequest,
    CreateManualTripRequest,
    UpdateTripTitleRequest,
    SaveItineraryRequest,
    ImportToTripRequest,
    UpdateDayDataRequest,
    UpdateLocationRequest,
    UpdateInfoRequest,
    CreateItemRequest,
    UpdateItemRequest,
    AddDayRequest,
    ReorderRequest  # 🆕 拖曳排序
)
from utils.deps import get_supabase, get_verified_user
from utils.helpers import generate_room_code, generate_public_id, ensure_user_exists
from utils.constants import DAY_MAP_FIELDS, CLONEABLE_FIELDS

router = APIRouter(prefix="/api", tags=["trips"])

# ensure_user_exists moved to utils.helpers


# ═══════════════════════════════════════════════════════════════════════════════
# 🆕 Public Share Endpoint (ISR-enabled, no auth required)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/trips/share/{public_id}")
async def get_public_trip_by_public_id(
    public_id: str,
    supabase=Depends(get_supabase)
):
    """🌐 公開行程分享 (無需認證, 支援 ISR)
    
    用於 Next.js ISR 頁面的 Server-side fetch。
    注意：這是公開 API，隱私資料會被過濾。
    
    Rate Limit: 10 requests/minute per IP (防暴力枚舉)
    """
    # 🛡️ Input Validation
    if not re.match(r'^pub_[a-z0-9]{8}$', public_id):
        raise HTTPException(status_code=400, detail="Invalid public ID format")
    try:
        # 1. 透過 public_id 查詢行程
        trip_res = supabase.table("itineraries").select("*").eq("public_id", public_id).execute()
        
        if not trip_res.data or len(trip_res.data) == 0:
            raise HTTPException(status_code=404, detail="Trip not found")
            
        trip = trip_res.data[0]
        
        # 2. 抓該行程的所有細項 (公開資料，不過濾)
        items_res = supabase.table("itinerary_items").select("*").eq("itinerary_id", trip["id"]).order("day_number").order("sort_order").order("time_slot").execute()
        
        # 3. 整理成前端要的格式
        days_map = {}
        if items_res.data:
            for item in items_res.data:
                d = item["day_number"]
                if d not in days_map:
                    days_map[d] = []
                
                days_map[d].append({
                    "id": item["id"],
                    "time_slot": item["time_slot"][:5] if item["time_slot"] else "00:00",
                    "time": item["time_slot"][:5] if item["time_slot"] else "00:00",
                    "place_name": item["place_name"],
                    "place": item["place_name"],
                    "category": item["category"] or "sightseeing",
                    "notes": item["notes"],
                    "desc": item["notes"],
                    "lat": item["location_lat"],
                    "lng": item["location_lng"],
                    "image_url": item.get("image_url"),
                    "tags": item.get("tags", []),
                    "link_url": item.get("link_url"),
                    "hide_navigation": item.get("hide_navigation", False)
                })
        
        content = trip.get("content") or {}
        
        # 4. 回傳公開資料 (過濾敏感資訊)
        return {
            "id": trip["id"],
            "title": trip["title"],
            "start_date": trip["start_date"],
            "end_date": trip.get("end_date"),
            "cover_image": trip.get("cover_image"),
            "share_code": trip.get("share_code", ""),
            "creator_name": trip.get("creator_name", "Guest"),
            "daily_locations": content.get("daily_locations", {}),
            # 不回傳: day_costs, day_tickets (私人財務資訊)
            # 不回傳: members (隱私)
            "days": [{"day": d, "activities": days_map[d]} for d in sorted(days_map.keys())] if days_map else []
        }

    except HTTPException:
        raise
    except Exception as e:
        # 🛡️ 安全日誌：內部記錄細節，但不暴露給客戶端
        print(f"🔥 Public Share Error: {e}")
        raise HTTPException(status_code=500, detail="Unable to retrieve trip data")


# ═══════════════════════════════════════════════════════════════════════════════
# Trip CRUD Operations
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/trips")
async def get_trips(
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """📋 取得我參與的所有行程
    
    🛡️ 已強化身分驗證：
    1. 優先從 JWT 驗證
    2. 回落至 Header (向後相容)
    """
    print(f"📋 查詢使用者 {user_id} 的所有行程")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="需要提供 X-User-ID Header")
    
    try:
        # 🆕 Phase 3: 使用 user_trips_view 一次性取得所有相關行程 (Dashboard Optimization)
        # 這取代了原本需要兩次查詢 (trip_members + itineraries) 的邏輯
        try:
            res = supabase.table("user_trips_view")\
                .select("*")\
                .eq("user_id", user_id)\
                .execute()
            trips_data = res.data or []
            print(f"📊 Dashboard: Using optimized user_trips_view")
        except Exception as view_err:
            print(f"⚠️ [Fallback] user_trips_view missing or error: {view_err}")
            # 🔄 Fallback Logic: 同時抓取成員表與創立表
            members_res = supabase.table("trip_members").select("itinerary_id").eq("user_id", user_id).execute()
            member_ids = [m['itinerary_id'] for m in members_res.data] if members_res.data else []
            
            owned_res = supabase.table("itineraries").select("id").eq("created_by", user_id).execute()
            owned_ids = [i['id'] for i in owned_res.data] if owned_res.data else []
            
            all_ids = list(set(member_ids + owned_ids))
            if not all_ids:
                return []
                
            res = supabase.table("itineraries").select("*").in_("id", all_ids).order("created_at", desc=True).execute()
            trips_data = res.data or []

        # 整理資料結構 - 🔧 FIX: 解析 content 欄位，將 daily_locations 提升到頂層
        trips = []
        for trip in trips_data:
            content = trip.get('content') or {}
            # 🆕 將 content 內的欄位提升到頂層，與 get_trip_by_id 格式一致
            # 如果欄位已在頂層 (從 View 來的)，則保留原值
            trip['daily_locations'] = trip.get('daily_locations') or content.get('daily_locations', {})
            trip['day_notes'] = trip.get('day_notes') or content.get('day_notes', {})
            trip['day_costs'] = trip.get('day_costs') or content.get('day_costs', {})
            trip['day_tickets'] = trip.get('day_tickets') or content.get('day_tickets', {})
            trip['day_checklists'] = trip.get('day_checklists') or content.get('day_checklists', {})
            trip['ai_review'] = trip.get('ai_review') or content.get('ai_review', "")
            trip['credit_cards'] = trip.get('credit_cards') or content.get('credit_cards', [])
            trips.append(trip)
        
        print(f"✅ 找到 {len(trips)} 個行程")
        return trips
        
    except Exception as e:
        print(f"🔥 Get Trips Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trips/{trip_id}")
async def get_trip_by_id(
    trip_id: str, 
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """🆕 獲取特定行程 (by ID)
    
    支援隱私過濾：
    - 成員：看到所有項目 (包含私人)
    - 非成員：私人項目會被過濾
    """
    try:
        # 1. 查詢指定的行程
        trip_res = supabase.table("itineraries").select("*").eq("id", trip_id).execute()
        
        if not trip_res.data or len(trip_res.data) == 0:
            raise HTTPException(status_code=404, detail="Trip not found")
            
        trip = trip_res.data[0]
        
        # 🆕 Auto-Migration: If public_id is missing, generate and save it
        if not trip.get("public_id"):
            from utils.helpers import generate_public_id
            new_public_id = generate_public_id()
            try:
                # 僅在此處嘗試更新，若 column 不存在會失敗但會被 catch
                supabase.table("itineraries").update({"public_id": new_public_id}).eq("id", trip_id).execute()
                trip["public_id"] = new_public_id
                print(f"🪄 Auto-Migrated Legacy Trip: Generated public_id={new_public_id}")
            except Exception as e:
                print(f"⚠️ Failed to auto-migrate public_id: {e} (Maybe column missing?)")

        # 🆕 判斷是否為成員 (擁有者或透過 Share Code 加入)
        is_member = False
        if user_id:
            member_res = supabase.table("trip_members").select("user_id").eq("itinerary_id", trip_id).eq("user_id", user_id).execute()
            is_member = len(member_res.data) > 0
            print(f"🔍 [DEBUG] user_id={user_id}, trip_id={trip_id}, member_query_result={member_res.data}, is_member={is_member}")
        else:
            print(f"🔍 [DEBUG] No user_id provided, treating as non-member")
        
        # 🆕 取得所有成員 (用於成員列表功能)
        all_members_res = supabase.table("trip_members").select("user_id, user_name, user_avatar").eq("itinerary_id", trip_id).execute()
        members = all_members_res.data or []
        created_by = trip.get("created_by", "")
        
        # 2. 抓該行程的所有細項 (按 time_slot 排序，確保符合時間軸)
        items_res = supabase.table("itinerary_items").select("*").eq("itinerary_id", trip["id"]).order("day_number").order("time_slot").order("sort_order").execute()
        
        # 3. 整理成前端要的格式
        days_map = {}
        if items_res.data:
            for item in items_res.data:
                d = item["day_number"]
                if d not in days_map:
                    days_map[d] = []
                
                days_map[d].append({
                    "id": item["id"],
                    "time": item["time_slot"][:5] if item["time_slot"] else "00:00",
                    "place": item["place_name"],
                    "original_name": item["original_name"],
                    "category": item["category"] or "sightseeing",
                    "desc": item["notes"],
                    "memo": item.get("memo") or "",
                    "lat": item["location_lat"],
                    "lng": item["location_lng"],
                    "cost": item["cost_amount"],
                    "reservation_code": item.get("reservation_code"),
                    "tags": item.get("tags", []),
                    "link_url": item.get("link_url"), 
                    "sub_items": item.get("sub_items") or [],
                    "image_url": item.get("image_url"),
                    "image_urls": item.get("image_urls") or ([item.get("image_url")] if item.get("image_url") else []),  # 🆕 多圖片
                    "hide_navigation": item.get("hide_navigation", False),  # 🆕 v4.8: 修正導航隱藏失效
                    "is_private": item.get("is_private", False),            # 🆕 修正權限標記失效
                    "private_owner_id": item.get("private_owner_id")
                })
        
        # 🆕 隱私過濾輔助函數（修正版：使用 private_owner_id）
        def filter_private_items(items_dict: dict) -> dict:
            """過濾私人項目：只有設定者本人可見"""
            filtered = {}
            for day_key, items_list in items_dict.items():
                if isinstance(items_list, list):
                    # 過濾掉私人項目（除非是自己設定的）
                    filtered[day_key] = [
                        item for item in items_list 
                        if not item.get("is_private") or  # 公開項目
                           item.get("private_owner_id") == user_id  # 或是自己的私人項目
                    ]
                else:
                    filtered[day_key] = items_list
            return filtered

        def filter_private_cards(cards: list) -> list:
            """過濾私人信用卡：只有建立者本人可見"""
            if not cards: return []
            return [
                card for card in cards
                if card.get("is_public") or card.get("creator_id") == user_id
            ]
        
        # 取得 content 並過濾
        content = trip.get("content") or {}
        day_costs = filter_private_items(content.get("day_costs", {}))
        day_tickets = filter_private_items(content.get("day_tickets", {}))
        day_checklists = filter_private_items(content.get("day_checklists", {}))
        
        return {
            "id": trip["id"],
            "title": trip["title"],
            "creator": trip.get("creator_name", "Guest"),
            "start_date": trip["start_date"],
            "end_date": trip.get("end_date"),
            "share_code": trip.get("share_code", ""),
            "public_id": trip.get("public_id", ""),
            "cover_image": trip.get("cover_image"),
            "daily_locations": content.get("daily_locations", {}),
            "day_notes": content.get("day_notes", {}),
            "day_costs": day_costs,
            "day_tickets": day_tickets,
            "day_checklists": day_checklists,
            "ai_review": content.get("ai_review", ""),
            "day_ai_reviews": content.get("day_ai_reviews", {}),  # 🆕 每日 AI 審核報告
            "flight_info": content.get("flight_info") or trip.get("flight_info") or {},
            "hotel_info": content.get("hotel_info") or trip.get("hotel_info") or {},
            "credit_cards": filter_private_cards(content.get("credit_cards", [])),
            "is_member": is_member,  # 🆕 告訴前端是否為成員
            "members": members,  # 🆕 所有成員列表 (用於成員管理)
            "created_by": created_by,  # 🆕 創建者 ID (用於判斷踢人權限)
            "days": [{"day": d, "activities": days_map[d]} for d in sorted(days_map.keys())] if days_map else []
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Fetch Error for Trip {trip_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/trips/{trip_id}/members/{member_user_id}")
async def kick_member(
    trip_id: str,
    member_user_id: str,
    x_user_id: Optional[str] = Header(None),
    supabase=Depends(get_supabase)
):
    """🚫 踢出成員 (僅行程創建者可用)"""
    try:
        if not x_user_id:
            raise HTTPException(status_code=401, detail="未提供使用者 ID")
        
        # 1. 驗證請求者是創建者
        trip_res = supabase.table("itineraries").select("created_by").eq("id", trip_id).single().execute()
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="找不到行程")
        
        created_by = trip_res.data.get("created_by")
        if x_user_id != created_by:
            raise HTTPException(status_code=403, detail="只有行程創建者可以踢出成員")
        
        # 2. 不能踢出自己 (創建者)
        if member_user_id == created_by:
            raise HTTPException(status_code=400, detail="無法踢出行程創建者")
        
        # 3. 從 trip_members 刪除
        result = supabase.table("trip_members").delete().eq("itinerary_id", trip_id).eq("user_id", member_user_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="找不到此成員")
        
        print(f"🚫 已踢出成員 {member_user_id} from trip {trip_id}")
        return {"status": "success", "kicked_user_id": member_user_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Kick Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, supabase=Depends(get_supabase)):
    """🗑️ 刪除整趟行程 (誠實版)"""
    try:
        print(f"🗑️ 嘗試刪除行程 ID: {trip_id}")
        
        # 1. 先刪除所有細項
        supabase.table("itinerary_items").delete().eq("itinerary_id", trip_id).execute()
        print("   ✅ 細項已刪除")
        
        # 2. 刪除所有成員關係
        supabase.table("trip_members").delete().eq("itinerary_id", trip_id).execute()
        print("   ✅ 成員關係已刪除")
        
        # 3. 最後刪除主行程
        res = supabase.table("itineraries").delete().eq("id", trip_id).execute()
        
        # 關鍵檢查：如果 data 是空的，代表根本沒刪到東西
        if not res.data:
            print(f"❌ 刪除失敗：資料庫回傳空值 (ID: {trip_id})")
            # 可能原因：ID 不存在，或是 RLS 權限擋住了
            raise HTTPException(status_code=404, detail="刪除失敗：找不到該行程或無權限")
        
        print(f"   ✅ 主行程已刪除: {res.data}")
        return {"status": "success", "message": "Trip deleted", "deleted_data": res.data}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trip/create-manual")
async def create_manual_trip(
    request: CreateManualTripRequest,
    supabase=Depends(get_supabase)
):
    """🔥 手動建立空白行程"""
    try:
        # 🆕 Phase 2: 行程數量限制（最多 3 個自建行程）
        count_res = supabase.table("itineraries")\
            .select("id", count="exact")\
            .eq("created_by", request.user_id)\
            .execute()
        
        owned_count = count_res.count or 0
        if owned_count >= 3:
            raise HTTPException(
                status_code=403, 
                detail="行程數量已達上限 (最多 3 個)，請先下載 PDF 後刪除舊行程"
            )
        
        room_code = generate_room_code()
        pub_id = generate_public_id()
        
        trip_data = {
            "title": request.title,
            "creator_name": request.creator_name,
            "created_by": request.user_id,
            "share_code": room_code,
            "public_id": pub_id,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "status": "active",
            "content": {},  # 👈 新增：給個空物件，不要讓它是 NULL
            "flight_info": {},
            "hotel_info": {},
            "cover_image": request.cover_image
        }
        
        
        # 🆕 Phase 3.1: 確保使用者存在 (滿足外鍵約束)
        await ensure_user_exists(supabase, request.user_id, request.creator_name)
        
        trip_res = supabase.table("itineraries").insert(trip_data).execute()
        trip_id = trip_res.data[0]['id']

        # 加入成員
        supabase.table("trip_members").insert({
            "itinerary_id": trip_id,
            "user_id": request.user_id,
            "user_name": request.creator_name
        }).execute()

        return {"status": "success", "trip_id": trip_id, "share_code": room_code, "public_id": pub_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/trips/{trip_id}/title")
async def update_trip_title(
    trip_id: str, 
    request: UpdateTripTitleRequest,
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """🔥 修改行程標題"""
    try:
        # 🛡️ 權限檢查 (只有成員能修改標題)
        member_check = supabase.table("trip_members")\
            .select("user_id")\
            .eq("itinerary_id", trip_id)\
            .eq("user_id", user_id)\
            .execute()
        
        if not member_check.data:
            raise HTTPException(status_code=403, detail="您沒有權限修改此行程標題")

        supabase.table("itineraries").update({"title": request.title}).eq("id", trip_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# Legacy Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/join-trip")
async def join_trip(request: JoinTripRequest, supabase=Depends(get_supabase)):
    """🚪 加入行程 (通過房間碼)"""
    print(f"🚪 使用者 {request.user_name} 嘗試加入房間: {request.share_code}")
    
    try:
        # 1. 找行程
        trip_res = supabase.table("itineraries").select("id, title").eq("share_code", request.share_code).execute()
        
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="找不到此行程代碼")
            
            
        trip = trip_res.data[0]
        print(f"✅ 找到行程: {trip['title']}")
        
        # 🆕 Phase 3.1: 確保加入者也存在於 users 表 (滿足外鍵約束)
        await ensure_user_exists(supabase, request.user_id, request.user_name)
        
        # 2. 加入成員 (如果已加入會報錯，我們用 try 接住忽略)
        try:
            supabase.table("trip_members").insert({
                "itinerary_id": trip['id'],
                "user_id": request.user_id,
                "user_name": request.user_name
            }).execute()
            print(f"✅ 成功加入成員")
        except Exception as member_err:
            print(f"ℹ️ 使用者可能已經是成員: {member_err}")
            pass  # 已經加入過就算了

        return {"status": "success", "trip": trip}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Join Trip Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/itinerary/latest")
async def get_latest_itinerary(supabase=Depends(get_supabase)):
    """🔥 讀取最新行程 (給主畫面用)"""
    try:
        # 1. 抓最新的一個行程
        trip_res = supabase.table("itineraries").select("*").order("created_at", desc=True).limit(1).execute()
        
        if not trip_res.data:
            return None
            
        trip = trip_res.data[0]
        
        # 2. 抓該行程的所有細項 (按 sort_order 排序，支援拖曳)
        items_res = supabase.table("itinerary_items").select("*").eq("itinerary_id", trip["id"]).order("day_number").order("sort_order").order("time_slot").execute()
        
        # 3. 整理成前端要的格式
        days_map = {}
        # ⚠️ 修正：如果 items_res.data 是空的 (手動建立時)，這裡迴圈不會跑，days_map 是空的
        if items_res.data:
            for item in items_res.data:
                d = item["day_number"]
                if d not in days_map:
                    days_map[d] = []
                
                days_map[d].append({
                    "id": item["id"],  # 👈 關鍵！補上這行，前端才知道要改哪一筆
                    "time": item["time_slot"][:5] if item["time_slot"] else "00:00",
                    "place": item["place_name"],
                    "original_name": item["original_name"],
                    "category": item["category"] or "sightseeing",
                    "desc": item["notes"],
                    "memo": item.get("memo") or "",  # 👈 新增這行，讀取備忘錄
                    "lat": item["location_lat"],
                    "lng": item["location_lng"],
                    "cost": item["cost_amount"],
                    "reservation_code": item.get("reservation_code"),
                    "tags": item.get("tags", []),
                    # 👇👇👇 補上這兩行！沒有這兩行，前端就是瞎子！
                    "link_url": item.get("link_url"), 
                    "sub_items": item.get("sub_items") or [],
                    "image_url": item.get("image_url"),  # 🆕 圖片 URL
                    "image_urls": item.get("image_urls") or ([item.get("image_url")] if item.get("image_url") else [])  # 🆕 多圖片
                })
            
        # 轉成陣列
        days_array = []
        for d in sorted(days_map.keys()):
            days_array.append({
                "day": d,
                "activities": days_map[d]
            })
            
        return {
            "id": trip["id"],
            "title": trip["title"],
            "creator": trip.get("creator_name", "Guest"),
            "start_date": trip["start_date"],  # 👈 關鍵！補上這行
            "end_date": trip.get("end_date"),  # 🐛 FIX: 補上缺失的 end_date
            "share_code": trip.get("share_code", ""),  # 順便補上分享碼
            # 👇 讀取並回傳
            "daily_locations": (trip.get("content") or {}).get("daily_locations", {}),
            # 🆕 每日提示
            "day_notes": (trip.get("content") or {}).get("day_notes", {}),
            "day_costs": (trip.get("content") or {}).get("day_costs", {}),
            "day_tickets": (trip.get("content") or {}).get("day_tickets", {}),
            "ai_review": (trip.get("content") or {}).get("ai_review", ""),  # 🆕 AI 審核
            "day_ai_reviews": (trip.get("content") or {}).get("day_ai_reviews", {}),  # 🆕 每日 AI 審核
            
            "flight_info": trip.get("flight_info") or {},  # 👈 新增航班資訊
            "hotel_info": trip.get("hotel_info") or {},    # 👈 新增住宿資訊
            # 即使 days_map 是空的，也要回傳空陣列，不然前端 map 會爆
            "days": [{"day": d, "activities": days_map[d]} for d in sorted(days_map.keys())] if days_map else []
        }

    except Exception as e:
        print(f"Fetch Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# Trip Data Updates (Batch 2)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/save-itinerary")
async def save_itinerary(
    request: SaveItineraryRequest, 
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """💾 儲存行程到資料庫
    
    產生房間碼，創建主行程，並批量插入細項。
    """
    print(f"💾 正在儲存行程: {request.title}...")
    print(f"   創建者: {request.creator_name}")
    print(f"   User ID: {request.user_id}")
    print(f"   項目數量: {len(request.items)}")
    
    try:
        # 🆕 Phase 2: 行程數量限制 (最多 3 個自建行程)
        # 🛡️ 競態防禦：在此進行最終檢查。注意：最高強度的防禦建議在資料庫端建立 Trigger
        # SQL範例: CREATE TRIGGER check_trip_limit BEFORE INSERT ON itineraries ...
        count_res = supabase.table("itineraries")\
            .select("id", count="exact")\
            .eq("created_by", request.user_id)\
            .execute()
        
        if (count_res.count or 0) >= 3:
            raise HTTPException(
                status_code=403, 
                detail="行程數量已達上限 (最多 3 個)，請先下載 PDF 後刪除舊行程"
            )

        
        # 1. 產生房間號與公開 ID
        room_code = generate_room_code()
        pub_id = generate_public_id()
        
        # 🆕 自動計算 end_date (如果未提供)
        start_date = request.start_date or "2026-01-01"
        if request.end_date:
            end_date = request.end_date
        elif request.items:
            # 從 items 中找最大的 day_number，計算 end_date
            max_day = max(item.day_number for item in request.items)
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = start + timedelta(days=max_day - 1)
            end_date = end.strftime("%Y-%m-%d")
            print(f"   🆕 自動計算 end_date: {end_date} (Day {max_day})")
        else:
            end_date = start_date
        
        # 2. 建立主行程 (Parent) - 將每日資訊存入 content
        trip_data = {
            "title": request.title,
            "creator_name": request.creator_name,
            "created_by": request.user_id,
            "share_code": room_code,
            "public_id": pub_id,
            "start_date": start_date,
            "end_date": end_date,
            "status": "active",
            # 👇 存入 JSONB 欄位: 包含 daily_locations 及新的 daily tips
            "content": {
                "daily_locations": request.daily_locations,
                "day_notes": request.day_notes,
                "day_costs": request.day_costs,
                "day_tickets": request.day_tickets,
                "day_checklists": request.day_checklists,
                "ai_review": request.ai_review
            }
        }
        
        # 🆕 Phase 3.1: 確保使用者存在 (滿足外鍵約束)
        await ensure_user_exists(supabase, request.user_id, request.creator_name)
        
        trip_res = supabase.table("itineraries").insert(trip_data).execute()
        
        if not trip_res.data:
            raise HTTPException(status_code=500, detail="無法建立主行程")
            
        trip_id = trip_res.data[0]["id"]
        print(f"✅ 主行程建立成功 ID: {trip_id}, 房間號: {room_code}")

        # 3. 自動把創建者加入成員列表
        member_data = {
            "itinerary_id": trip_id,
            "user_id": request.user_id,
            "user_name": request.creator_name
        }
        supabase.table("trip_members").insert(member_data).execute()

        # 4. 建立細項 (Children)
        items_data = []
        for item in request.items:
            items_data.append({
                "itinerary_id": trip_id,
                "day_number": item.day_number,
                "time_slot": item.time_slot,
                "place_name": item.place_name,
                "original_name": item.original_name,
                "category": item.category,
                "notes": item.desc,
                "location_lat": item.lat,
                "location_lng": item.lng,
                "cost_amount": item.cost_amount,
                "reservation_code": item.reservation_code,
                "tags": item.tags,
                "sub_items": item.sub_items,
                "link_url": item.link_url,
                "memo": item.memo,
                "image_url": item.image_url,
                "image_urls": item.image_urls or ([item.image_url] if item.image_url else []),
                "hide_navigation": item.hide_navigation
            })
            
        # 批次寫入
        if items_data:
            print(f"   📦 準備插入 {len(items_data)} 個細項...")
            try:
                supabase.table("itinerary_items").insert(items_data).execute()
                print(f"   ✅ 細項插入成功!")
            except Exception as item_err:
                print(f"   ❌ 細項插入失敗: {item_err}")
                # 嘗試逐個插入以找出問題項目
                for i, item in enumerate(items_data):
                    try:
                        supabase.table("itinerary_items").insert(item).execute()
                        print(f"      ✅ Item {i+1} OK")
                    except Exception as single_err:
                        print(f"      ❌ Item {i+1} FAILED: {single_err}")
                        print(f"         Data: {item}")
                raise item_err
            
        return {"status": "success", "trip_id": trip_id, "share_code": room_code, "public_id": pub_id}

    except Exception as e:
        print(f"🔥 Save Error: {e}")
        print(f"   Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import-to-trip")
async def import_to_trip(request: ImportToTripRequest, supabase=Depends(get_supabase)):
    """📥 匯入到現有行程
    
    將新項目合併到現有行程的 content 並新增 items。
    """
    print(f"📥 正在匯入至現有行程 ID: {request.trip_id}...")
    
    try:
        # 1. 檢查行程是否存在並獲取現有資料
        trip_res = supabase.table("itineraries").select("*").eq("id", request.trip_id).execute()
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="找不到指定的行程")
            
        existing_trip = trip_res.data[0]
        existing_content = existing_trip.get("content") or {}
        
        # 2. 合併 content 資料
        # 🆕 區分兩種合併模式：
        #    - merge_dicts: 用於 daily_locations (一天只有一個中心點，覆蓋)
        #    - deep_merge_day_arrays: 用於 notes/costs/tickets (同一天可追加)
        
        def merge_dicts(old_d, new_d):
            """簡單的 key-level 合併 (新值覆蓋舊值)"""
            if not new_d: return old_d or {}
            if not old_d: return new_d
            result = old_d.copy()
            result.update(new_d)
            return result
        
        def deep_merge_day_arrays(old_d: dict, new_d: dict) -> dict:
            """陣列型每日資料的深度合併 (追加而非覆蓋)
            
            用途：同一天分批匯入時，day_notes/costs/tickets 會追加合併
            範例：
              舊資料: {"1": [{"item": "交通", "amount": "¥1200"}]}
              新資料: {"1": [{"item": "午餐", "amount": "¥1000"}]}
              結果:   {"1": [{"item": "交通", "amount": "¥1200"}, {"item": "午餐", "amount": "¥1000"}]}
            """
            if not new_d: return old_d or {}
            if not old_d: return new_d
            result = old_d.copy()
            for day_key, new_items in new_d.items():
                existing = result.get(day_key, [])
                if isinstance(existing, list) and isinstance(new_items, list):
                    result[day_key] = existing + new_items  # 追加合併
                else:
                    result[day_key] = new_items  # 非陣列則覆蓋
            return result
            
        updated_content = {
            # daily_locations: 保持覆蓋 (一天只有一個地點中心)
            "daily_locations": merge_dicts(existing_content.get("daily_locations"), request.daily_locations),
            # 🆕 以下使用深度追加合併，支援分批匯入
            "day_notes": deep_merge_day_arrays(existing_content.get("day_notes"), request.day_notes),
            "day_costs": deep_merge_day_arrays(existing_content.get("day_costs"), request.day_costs),
            "day_tickets": deep_merge_day_arrays(existing_content.get("day_tickets"), request.day_tickets),
            "day_checklists": deep_merge_day_arrays(existing_content.get("day_checklists"), request.day_checklists),
            "ai_review": request.ai_review if request.ai_review else existing_content.get("ai_review")
        }
        
        # 3. 更新主行程 content
        supabase.table("itineraries").update({"content": updated_content}).eq("id", request.trip_id).execute()
        
        # 4. 插入細項 (Children)
        items_data = []
        for item in request.items:
            items_data.append({
                "itinerary_id": request.trip_id,
                "day_number": item.day_number,
                "time_slot": item.time_slot,
                "place_name": item.place_name,
                "original_name": item.original_name,
                "category": item.category,
                "notes": item.desc,
                "location_lat": item.lat,
                "location_lng": item.lng,
                "cost_amount": item.cost_amount,
                "reservation_code": item.reservation_code,
                "tags": item.tags,
                "sub_items": item.sub_items,
                "link_url": item.link_url,
                "memo": item.memo,
                "image_url": item.image_url,
                "image_urls": item.image_urls or ([item.image_url] if item.image_url else []),
                "hide_navigation": item.hide_navigation
            })
            
        if items_data:
            print(f"   📦 準備插入 {len(items_data)} 個細項...")
            supabase.table("itinerary_items").insert(items_data).execute()
            
        return {"status": "success", "message": f"成功匯入 {len(items_data)} 個項目"}

    except Exception as e:
        print(f"🔥 Import Error: {e}")
        print(f"   Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/trips/{trip_id}/day-data")
async def update_day_data(
    trip_id: str, 
    request: UpdateDayDataRequest, 
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    supabase=Depends(get_supabase)
):
    """📝 更新特定天的注意事項、預估花費、交通票券"""
    try:
        # 🛡️ 權限檢查 (Cautious Authorization Check)
        if x_user_id:
            member_check = supabase.table("trip_members")\
                .select("user_id")\
                .eq("itinerary_id", trip_id)\
                .eq("user_id", x_user_id)\
                .execute()
            
            if not member_check.data:
                raise HTTPException(status_code=403, detail="您沒有權限修改此行程資訊")
        print(f"📝 更新 Day {request.day} 資訊 for Trip {trip_id}")
        
        # 1. 取得現有行程
        trip_res = supabase.table("itineraries").select("content").eq("id", trip_id).execute()
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        content = trip_res.data[0].get("content") or {}
        
        # 2. 更新對應的資料 (注意: 前端傳來的 key 是字串或整數，需統一處理)
        day_key = str(request.day)
        
        if request.day_notes is not None:
            existing_notes = content.get("day_notes", {})
            # 前端傳來的格式: { "1": [...] } 或 { 1: [...] }
            new_data = request.day_notes.get(day_key) or request.day_notes.get(request.day) or []
            existing_notes[day_key] = new_data
            content["day_notes"] = existing_notes
            
        if request.day_costs is not None:
            existing_costs = content.get("day_costs", {})
            new_data = request.day_costs.get(day_key) or request.day_costs.get(request.day) or []
            existing_costs[day_key] = new_data
            content["day_costs"] = existing_costs
            
        if request.day_tickets is not None:
            existing_tickets = content.get("day_tickets", {})
            new_data = request.day_tickets.get(day_key) or request.day_tickets.get(request.day) or []
            existing_tickets[day_key] = new_data
            content["day_tickets"] = existing_tickets
        
        # 🆕 行前清單
        if request.day_checklists is not None:
            existing_checklists = content.get("day_checklists", {})
            new_data = request.day_checklists.get(day_key) or request.day_checklists.get(request.day) or []
            existing_checklists[day_key] = new_data
            content["day_checklists"] = existing_checklists
        
        # 🆕 AI 深度審核報告
        if request.day_ai_reviews is not None:
            existing_reviews = content.get("day_ai_reviews", {})
            # 允許傳入空字串或 None 來清除審核
            new_data = request.day_ai_reviews.get(day_key) or request.day_ai_reviews.get(request.day)
            if new_data == "" or new_data is None:
                # 清除審核：如果存在則刪除
                if day_key in existing_reviews:
                    del existing_reviews[day_key]
            else:
                existing_reviews[day_key] = new_data
            content["day_ai_reviews"] = existing_reviews
        
        # 3. 寫回資料庫
        update_res = supabase.table("itineraries").update({"content": content}).eq("id", trip_id).execute()
        
        print(f"✅ Day {request.day} 資訊更新成功")
        return {"status": "success", "day": request.day}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Update Day Data Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/trips/{trip_id}/location")
async def update_trip_location(trip_id: str, request: UpdateLocationRequest, supabase=Depends(get_supabase)):
    """🗺️ 更新行程的每日地點"""
    try:
        # 1. 先讀取現有的 content
        res = supabase.table("itineraries").select("content").eq("id", trip_id).single().execute()
        content = res.data['content'] or {}
        
        # 2. 更新該日期的地點
        if 'daily_locations' not in content:
            content['daily_locations'] = {}
        
        content['daily_locations'][str(request.day)] = {
            "name": request.name,
            "lat": request.lat,
            "lng": request.lng
        }
        
        # 3. 寫回資料庫
        supabase.table("itineraries").update({"content": content}).eq("id", trip_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/trips/{trip_id}/leave")
async def leave_trip(
    trip_id: str,
    user_id: str = Header(None, alias="X-User-ID"),
    supabase=Depends(get_supabase)
):
    """👋 退出行程"""
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-ID")

    try:
        # 1. Check trip ownership
        trip_res = supabase.table("itineraries").select("created_by").eq("id", trip_id).single().execute()
        if trip_res.data and trip_res.data.get("created_by") == user_id:
            raise HTTPException(status_code=400, detail="Owner cannot leave trip. Please delete the trip instead.")

        # 2. Remove from trip_members
        res = supabase.table("trip_members").delete().eq("itinerary_id", trip_id).eq("user_id", user_id).execute()
        
        if res.count == 0:
            return {"message": "User was not in trip or already left"}

        return {"message": "Successfully left the trip"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Leave Trip Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/trips/{trip_id}/info")
async def update_trip_info(
    trip_id: str, 
    request: UpdateInfoRequest, 
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """✈️ 更新行程資訊 (航班、住宿、信用卡)"""
    try:
        # 🛡️ 權限檢查 (Cautious Authorization Check)
        if user_id:
            # 驗證使用者是否為該行程的成員
            member_check = supabase.table("trip_members")\
                .select("user_id")\
                .eq("itinerary_id", trip_id)\
                .eq("user_id", user_id)\
                .execute()
            
            if not member_check.data:
                # 🔒 安全防線：拒絕非成員修改行程資訊
                print(f"🔒 [Auth Denied] User {user_id} tried to update Trip {trip_id}")
                raise HTTPException(status_code=403, detail="您沒有權限修改此行程資訊")

        # 1. 如果有更新信用卡，執行原子化 RPC 更新 (🛡️ Cautious Fix: 原子化更新，防止併發覆蓋)
        if request.credit_cards is not None:
            supabase.rpc("update_trip_credit_cards", {
                "target_trip_id": trip_id,
                "new_cards": request.credit_cards
            }).execute()

        # 2. 更新 Flight/Hotel (Hybrid Store: Columns + JSONB Content)
        # 🛡️ 謹慎更新：僅在有資料時更新，避免覆蓋為 NULL
        data = {}
        patch_content = {}
        
        if request.flight_info is not None:
            data["flight_info"] = request.flight_info
            patch_content["flight_info"] = request.flight_info
        if request.hotel_info is not None:
            data["hotel_info"] = request.hotel_info
            patch_content["hotel_info"] = request.hotel_info
            
        if data:
            # A. 更新獨立欄位 (Legacy Columns)
            supabase.table("itineraries").update(data).eq("id", trip_id).execute()
            
            # B. 同步更新 content (JSONB) 以確保 PWA 生態系一致性
            # 🧠 v4.2: 採用 Fetch-Merge-Save 策略 (因為無法建立 generic RPC)
            trip_res = supabase.table("itineraries").select("content").eq("id", trip_id).single().execute()
            if trip_res.data:
                current_content = trip_res.data.get("content") or {}
                # 僅合併本次更新的欄位，保留其他欄位 (如 day_notes)
                new_content = {**current_content, **patch_content}
                supabase.table("itineraries").update({"content": new_content}).eq("id", trip_id).execute()
        
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update Info Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# Items CRUD (Batch 3)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/items")
async def create_item(request: CreateItemRequest, supabase=Depends(get_supabase)):
    """➕ 新增單筆行程項目"""
    try:
        data = {
            "itinerary_id": request.itinerary_id,
            "day_number": request.day_number,
            "time_slot": request.time_slot,
            "place_name": request.place_name,
            "category": request.category,
            "notes": request.notes,
            "location_lat": request.lat,
            "location_lng": request.lng,
            "image_url": request.image_url,
            "image_urls": request.image_urls or ([request.image_url] if request.image_url else []),
            "tags": request.tags,
            "memo": request.memo,
            "sub_items": request.sub_items,
            "link_url": request.link_url,
            "reservation_code": request.reservation_code,
            "cost_amount": request.cost_amount,
            "hide_navigation": request.hide_navigation
        }
        
        res = supabase.table("itinerary_items").insert(data).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="插入失敗")
        
        print(f"✅ 單筆行程新增成功：{request.place_name}")
        return {"status": "success", "data": res.data}
    except Exception as e:
        print(f"🔥 Create Item Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 🆕 批次排序更新 API (Moved up to avoid conflict with {item_id})
@router.patch("/items/reorder")
async def reorder_items(request: ReorderRequest, supabase=Depends(get_supabase)):
    """🔄 批次更新多個項目的排序順序"""
    print(f"🔄 批次排序: {len(request.items)} 項目, adjust_times={request.adjust_times}")
    try:
        results = []
        for item in request.items:
            data = {"sort_order": item.sort_order}
            
            # 如果選擇自動調整時間
            if request.adjust_times and item.time_slot:
                data["time_slot"] = item.time_slot
            
            res = supabase.table("itinerary_items").update(data).eq("id", item.item_id).execute()
            results.append({"id": item.item_id, "updated": bool(res.data)})
        
        print(f"✅ 排序更新完成: {len(results)} 項目")
        return {"status": "success", "results": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"🔥 Reorder Error: {e}")
        raise HTTPException(status_code=500, detail=f"Reorder failed: {str(e)}")


@router.patch("/items/{item_id}")
async def update_item(item_id: str, request: UpdateItemRequest, supabase=Depends(get_supabase)):
    """📝 修改單一細項"""
    print(f"📝 嘗試更新細項 {item_id}: {request}")
    try:
        # 只更新有值的欄位
        data = {}
        if request.time_slot is not None: data["time_slot"] = request.time_slot
        if request.place_name is not None: data["place_name"] = request.place_name
        if request.notes is not None: data["notes"] = request.notes
        if request.cost_amount is not None: data["cost_amount"] = request.cost_amount
        # 👇 寫入資料庫
        if request.lat is not None: data["location_lat"] = request.lat
        if request.lng is not None: data["location_lng"] = request.lng
        # 👇 新增：處理備忘錄
        if request.memo is not None: data["memo"] = request.memo
        # 🆕 新增：處理預約資訊
        if request.link_url is not None: data["link_url"] = request.link_url
        if request.reservation_code is not None: data["reservation_code"] = request.reservation_code
        # 👇 新增：處理 sub_items (連結列表)
        if request.sub_items is not None: data["sub_items"] = request.sub_items
        # 👇 新增：處理分類與標籤
        if request.category is not None: data["category"] = request.category
        if request.tags is not None: data["tags"] = request.tags
        # 👇 新增：處理圖片 URL (向後相容)
        if request.image_url is not None: data["image_url"] = request.image_url
        # 🆕 新增：處理多圖片 URLs
        if request.image_urls is not None: data["image_urls"] = request.image_urls
        # 🆕 新增：處理排序順序 (拖曳排序)
        if request.sort_order is not None: data["sort_order"] = request.sort_order
        # 🆕 新增：手動隱藏導航
        if request.hide_navigation is not None: data["hide_navigation"] = request.hide_navigation
        
        if not data:
            print("⚠️ 沒有資料需要更新")
            return {"status": "no_change"}

        res = supabase.table("itinerary_items").update(data).eq("id", item_id).execute()
        
        if not res.data:
            print(f"❌ 更新失敗：找不到 ID {item_id}")
            raise HTTPException(status_code=404, detail="Item not found")

        print("✅ 更新成功")
        return {"status": "success", "data": res.data}
    except Exception as e:
        print(f"🔥 Update Item Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, supabase=Depends(get_supabase)):
    """🗑️ 刪除單一細項"""
    print(f"🗑️ 嘗試刪除細項 {item_id}")
    try:
        res = supabase.table("itinerary_items").delete().eq("id", item_id).execute()
        
        if not res.data:
             print(f"❌ 刪除失敗：找不到 ID {item_id}")
             # 這裡不噴錯，因為可能已經被刪掉了
             return {"status": "success", "message": "Item might already be deleted"}
             
        print("✅ 刪除成功")
        return {"status": "success"}
    except Exception as e:
        print(f"🔥 Delete Item Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# Day Management - HIGH RISK (Batch 4)
# ⚠️ Contains complex algorithms: Ghostbuster, Scorched Earth, Smart Clone
# ═══════════════════════════════════════════════════════════════════════════════

@router.delete("/trips/{trip_id}/days/{day_number}")
async def delete_day(trip_id: str, day_number: int, supabase=Depends(get_supabase)):
    """🗑️ 刪除整天行程 (Deep Logic Fix)
    
    包含 Deep Content Shift 算法，用於防止「幽靈資料」：
    - 刪除的天數資料必須清空
    - 後面的資料必須往前補
    """
    print(f"🗑️ 嘗試刪除行程 {trip_id} 的第 {day_number} 天 (With Deep Content Clean)")
    try:
        # 1. 取得現有行程與 content
        trip = supabase.table("itineraries").select("start_date, end_date, content").eq("id", trip_id).single().execute()
        if not trip.data:
            raise HTTPException(status_code=404, detail="行程不存在")

        # 2. 刪除該天的所有細項 (Activities)
        res = supabase.table("itinerary_items")\
            .delete()\
            .eq("itinerary_id", trip_id)\
            .eq("day_number", day_number)\
            .execute()
        deleted_count = len(res.data) if res.data else 0
        
        # 3. 調整後續天數的 activities (day_number - 1)
        remaining = supabase.table("itinerary_items")\
            .select("id, day_number")\
            .eq("itinerary_id", trip_id)\
            .gt("day_number", day_number)\
            .execute()
        
        for item in remaining.data:
             supabase.table("itinerary_items")\
                .update({"day_number": item["day_number"] - 1})\
                .eq("id", item["id"])\
                .execute()

        # 4. 🧠 Deep Content Shift (處理 content 內的 Map 結構)
        # 用來防止「幽靈資料」：刪除的天數資料必須清空，後面的資料必須往前補
        content = trip.data.get("content") or {}
        
        # 計算最大天數 (為了迴圈邊界)
        start_date = datetime.strptime(trip.data["start_date"], "%Y-%m-%d") if trip.data.get("start_date") else None
        end_date = datetime.strptime(trip.data["end_date"], "%Y-%m-%d") if trip.data.get("end_date") else None
        current_max_day = (end_date - start_date).days + 1 if (start_date and end_date) else 30 # Fallback 30

        for field in DAY_MAP_FIELDS:
            if field in content and isinstance(content[field], dict):
                # A. 先刪除目標天數的資料 (壁紙撕掉)
                if str(day_number) in content[field]:
                    del content[field][str(day_number)]
                
                # B. 後面的天數往前移 (10 -> 9, 9 -> 8 ... day_number+1 -> day_number)
                # 必須從 day_number + 1 開始往後掃描直到 current_max_day
                for i in range(day_number + 1, current_max_day + 2): # +2 for safety buffer
                    old_key = str(i)
                    new_key = str(i - 1)
                    
                    if old_key in content[field]:
                        # 搬移資料
                        content[field][new_key] = content[field][old_key]
                        # 刪除舊位址 (這是關鍵，不然會變成複製)
                        del content[field][old_key]

        # 5. 更新行程 (Content + EndDate)
        updates = {"content": content}
        
        if end_date:
            new_end = end_date - timedelta(days=1)
            updates["end_date"] = new_end.strftime("%Y-%m-%d")
            
        supabase.table("itineraries").update(updates).eq("id", trip_id).execute()

        print(f"   ✅ Day {day_number} 刪除完成，Content 已校正，Activities 已位移")
        return {"status": "success", "deleted_items": deleted_count}

    except Exception as e:
        print(f"🔥 Delete Day Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trips/{trip_id}/days")
async def add_day(trip_id: str, request: AddDayRequest, supabase=Depends(get_supabase)):
    """➕ 新增天數 (With Ghostbuster)
    
    包含複雜算法：
    - Ghostbuster: 偵測幽靈資料
    - Deep Content Shift: 反向位移
    - Scorched Earth Clean: 焦土清理
    - Smart Clone: 智慧複製內容
    """
    print(f"➕ 嘗試新增天數到行程 {trip_id}, 位置: {request.position}, 移植內容: {request.clone_content} (With Ghostbuster)")
    try:
        # 1. 取得現有行程資訊
        trip = supabase.table("itineraries").select("start_date, end_date, content").eq("id", trip_id).single().execute()
        if not trip.data:
            raise HTTPException(status_code=404, detail="行程不存在")
            
        content = trip.data.get("content") or {}

        # 2. 計算目前的天數 (精確計算) & Ghostbuster 👻 找出隱藏的最大天數
        start_date = datetime.strptime(trip.data["start_date"], "%Y-%m-%d") if trip.data.get("start_date") else datetime.now()
        end_date = datetime.strptime(trip.data["end_date"], "%Y-%m-%d") if trip.data.get("end_date") else start_date
        date_calculated_days = (end_date - start_date).days + 1
        
        # 🔍 Ghostbuster: 掃描 content 找出真正的 max key (解決字串排序問題 "10" < "2")
        all_content_keys = []
        for field in DAY_MAP_FIELDS:
            if field in content and isinstance(content[field], dict):
                all_content_keys.extend(content[field].keys())
        
        valid_day_nums = [int(k) for k in all_content_keys if k.isdigit()] # 強制轉 INT
        content_max_day = max(valid_day_nums) if valid_day_nums else 0
        
        # 取最大的作為當前邊界，確保位移時能覆蓋到所有幽靈資料
        # 但如果是 "新增到結尾"，我們應該忽略幽靈，直接覆蓋在正確的天數上
        shift_limit_day = max(date_calculated_days, content_max_day)
        
        if content_max_day > date_calculated_days:
            print(f"   👻 發現幽靈資料! Content Max: {content_max_day} > Date Max: {date_calculated_days}")

        new_day = -1
        source_day_for_clone = None

        # 3. 根據 position 處理
        if request.position == "end":
            # 新增到最後一天之後 - 直接鎖定正確的日期順序，無視幽靈 (Overwrite)
            new_day = date_calculated_days + 1
            print(f"   ➕ 新增 Day {new_day} 到結尾 (覆蓋該位置可能的幽靈)")
            source_day_for_clone = new_day - 1 # 若要複製，來源是原本的最後一天
            
        elif request.position.startswith("before:"):
            # 插入到指定天之前
            insert_before = int(request.position.split(":")[1])
            insert_before = max(1, insert_before)
            new_day = insert_before
            source_day_for_clone = insert_before 
            
            # A. 調整 Activities
            items_to_shift = supabase.table("itinerary_items")\
                .select("id, day_number")\
                .eq("itinerary_id", trip_id)\
                .gte("day_number", insert_before)\
                .order("day_number", desc=True)\
                .execute()
            
            for item in items_to_shift.data:
                supabase.table("itinerary_items")\
                    .update({"day_number": item["day_number"] + 1})\
                    .eq("id", item["id"])\
                    .execute()
            
            # B. 🧠 Deep Content Shift (Reverse Order)
            # 這裡必須使用 shift_limit_day，確保連同幽靈資料一起往後移，避免資料損失
            for field in DAY_MAP_FIELDS:
                if field not in content: content[field] = {}
                if not isinstance(content[field], dict): content[field] = {}

                for i in range(shift_limit_day, insert_before - 1, -1):
                    old_key = str(i)
                    new_key = str(i + 1)
                    
                    if old_key in content[field]:
                        content[field][new_key] = content[field][old_key]
                        del content[field][old_key]
            
            # 修正 Clone Source
            if insert_before == 1:
                source_day_for_clone = 2 
            else:
                source_day_for_clone = insert_before - 1

            print(f"   ➕ 插入 Day {new_day}, Content 已反向位移")

        else:
            raise HTTPException(status_code=400, detail="無效的 position 格式")
        
        # 4. 🔥 Scorched Earth Clean (焦土清理)
        # 強制清理 new_day 位置，不管之前有沒有幽靈，都得死
        target_key = str(new_day)
        print(f"   🔥 執行焦土清理 Day {new_day}")
        
        cleaned_count = 0
        for field in DAY_MAP_FIELDS:
             if field not in content: content[field] = {}
             if target_key in content[field]:
                 del content[field][target_key]
                 print(f"      🧹 已清除殘留資料: {field}[{target_key}]")
                 cleaned_count += 1
        
        if cleaned_count > 0:
            print(f"   ✅ 焦土清理完成，共清除 {cleaned_count} 個欄位")

        # 5. 🧠 Smart Clone 執行 (如果需要)
        # 此時 new_day 已經絕對乾淨
        if request.clone_content and source_day_for_clone:
            print(f"   🌱 執行智慧移植: 從 Day {source_day_for_clone} -> Day {new_day}")
            src_key = str(source_day_for_clone)
            
            import copy
            for field in CLONEABLE_FIELDS: # 只複製允許的欄位
                if field in content and src_key in content[field]:
                    content[field][target_key] = copy.deepcopy(content[field][src_key])
                    print(f"      ✅ 複製 {field}")

        # 6. 更新行程 (Content + EndDate)
        # 如果是 Append End: 總天數 = 舊天數 + 1
        # 如果是 Insert Before: 總天數 = 舊天數 + 1 (因為所有東西都推後了一天)
        # 注意：如果原本有幽靈資料 (Max > Date)，Insert 後 Max 也會 +1。
        # 我們這裡只關心 "合法的行程長度"。如果原本有 5 天 (date), Insert 1 天 -> 變成 6 天。
        # 不管 content max 是多少，end date 應該只反應合法的增加。
        
        final_total_days = date_calculated_days + 1
        
        new_end_date = start_date + timedelta(days=final_total_days - 1)
        
        updates = {
            "content": content,
            "end_date": new_end_date.strftime("%Y-%m-%d")
        }
        
        supabase.table("itineraries").update(updates).eq("id", trip_id).execute()
        
        return {"status": "success", "new_day": new_day, "total_days": final_total_days}

    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Add Day Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
