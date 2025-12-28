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

import traceback
from datetime import datetime, timedelta
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
    AddDayRequest
)
from utils.deps import get_supabase
from utils.helpers import generate_room_code
from utils.constants import DAY_MAP_FIELDS, CLONEABLE_FIELDS

router = APIRouter(prefix="/api", tags=["trips"])


# ═══════════════════════════════════════════════════════════════════════════════
# Trip CRUD Operations
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/trips")
async def get_trips(
    user_id: str = Header(None, alias="X-User-ID"),
    supabase=Depends(get_supabase)
):
    """📋 取得我參與的所有行程
    
    透過 Header 傳入 user_id，返回該使用者參與的所有行程
    """
    print(f"📋 查詢使用者 {user_id} 的所有行程")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="需要提供 X-User-ID Header")
    
    try:
        # 這是 SQL 的 Join 概念：找出 trip_members 裡有我 user_id 的所有 itinerary
        res = supabase.table("trip_members")\
            .select("itinerary_id, itineraries(*)")\
            .eq("user_id", user_id)\
            .execute()
            
        # 整理資料結構 - 🔧 FIX: 解析 content 欄位，將 daily_locations 提升到頂層
        trips = []
        for item in res.data:
            if item.get('itineraries'):  # 確保關聯存在
                trip = item['itineraries']
                content = trip.get('content') or {}
                # 🆕 將 content 內的欄位提升到頂層，與 get_trip_by_id 格式一致
                trip['daily_locations'] = content.get('daily_locations', {})
                trip['day_notes'] = content.get('day_notes', {})
                trip['day_costs'] = content.get('day_costs', {})
                trip['day_tickets'] = content.get('day_tickets', {})
                trip['day_checklists'] = content.get('day_checklists', {})
                trip['credit_cards'] = content.get('credit_cards', [])
                trips.append(trip)
        
        print(f"✅ 找到 {len(trips)} 個行程")
        return trips
        
    except Exception as e:
        print(f"🔥 Get Trips Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trips/{trip_id}")
async def get_trip_by_id(trip_id: str, supabase=Depends(get_supabase)):
    """🆕 獲取特定行程 (by ID)"""
    try:
        # 1. 查詢指定的行程
        trip_res = supabase.table("itineraries").select("*").eq("id", trip_id).execute()
        
        if not trip_res.data or len(trip_res.data) == 0:
            raise HTTPException(status_code=404, detail="Trip not found")
            
        trip = trip_res.data[0]
        
        # 2. 抓該行程的所有細項
        items_res = supabase.table("itinerary_items").select("*").eq("itinerary_id", trip["id"]).order("day_number").order("time_slot").execute()
        
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
                    "image_url": item.get("image_url")
                })
            
        return {
            "id": trip["id"],
            "title": trip["title"],
            "creator": trip.get("creator_name", "Guest"),
            "start_date": trip["start_date"],
            "end_date": trip.get("end_date"),  # 🐛 FIX: 補上缺失的 end_date
            "share_code": trip.get("share_code", ""),
            "cover_image": trip.get("cover_image"),
            # 🚑 修復：先判斷 content 是否為 None，再取值
            "daily_locations": (trip.get("content") or {}).get("daily_locations", {}),
            # 🆕 每日提示
            "day_notes": (trip.get("content") or {}).get("day_notes", {}),
            "day_costs": (trip.get("content") or {}).get("day_costs", {}),
            "day_tickets": (trip.get("content") or {}).get("day_tickets", {}),
            "day_checklists": (trip.get("content") or {}).get("day_checklists", {}),

            "flight_info": trip.get("flight_info") or {},
            "hotel_info": trip.get("hotel_info") or {},
            "credit_cards": (trip.get("content") or {}).get("credit_cards", []), # 🆕 信用卡資訊
            "days": [{"day": d, "activities": days_map[d]} for d in sorted(days_map.keys())] if days_map else []
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Fetch Error: {e}")
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
        room_code = generate_room_code()
        
        trip_data = {
            "title": request.title,
            "creator_name": request.creator_name,
            "created_by": request.user_id,
            "share_code": room_code,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "status": "active",
            "content": {},  # 👈 新增：給個空物件，不要讓它是 NULL
            "flight_info": {},
            "hotel_info": {},
            "cover_image": request.cover_image
        }
        
        trip_res = supabase.table("itineraries").insert(trip_data).execute()
        trip_id = trip_res.data[0]['id']

        # 加入成員
        supabase.table("trip_members").insert({
            "itinerary_id": trip_id,
            "user_id": request.user_id,
            "user_name": request.creator_name
        }).execute()

        return {"status": "success", "trip_id": trip_id, "share_code": room_code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/trips/{trip_id}/title")
async def update_trip_title(
    trip_id: str, 
    request: UpdateTripTitleRequest,
    supabase=Depends(get_supabase)
):
    """🔥 修改行程標題"""
    try:
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
        
        # 2. 抓該行程的所有細項
        items_res = supabase.table("itinerary_items").select("*").eq("itinerary_id", trip["id"]).order("day_number").order("time_slot").execute()
        
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
                    "sub_items": item.get("sub_items") or []
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
async def save_itinerary(request: SaveItineraryRequest, supabase=Depends(get_supabase)):
    """💾 儲存行程到資料庫
    
    產生房間碼，創建主行程，並批量插入細項。
    """
    print(f"💾 正在儲存行程: {request.title}...")
    print(f"   創建者: {request.creator_name}")
    print(f"   User ID: {request.user_id}")
    print(f"   項目數量: {len(request.items)}")
    
    try:
        # 1. 產生房間號
        room_code = generate_room_code()
        
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
            "start_date": start_date,
            "end_date": end_date,
            "status": "active",
            # 👇 存入 JSONB 欄位: 包含 daily_locations 及新的 daily tips
            "content": {
                "daily_locations": request.daily_locations,
                "day_notes": request.day_notes,
                "day_costs": request.day_costs,
                "day_tickets": request.day_tickets
            }
        }
        
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
                "reservation_code": item.reservation_code,  # 新增
                "tags": item.tags,  # 新增：需要 DB 有 tags (text[]) 欄位
                # 👇 新增：儲存附屬表格
                "sub_items": item.sub_items,
                # 👇 新增：儲存使用者連結
                "link_url": item.link_url
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
            
        return {"status": "success", "trip_id": trip_id, "share_code": room_code}

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
        
        # 2. 合併 content 資料 (深度合併)
        # 用戶匯入的新資料優先於舊資料（或者保留舊資料？通常匯入是為了充實，所以合併）
        def merge_dicts(old_d, new_d):
            if not new_d: return old_d or {}
            if not old_d: return new_d
            result = old_d.copy()
            result.update(new_d) # 簡單的 key-level update
            return result
            
        updated_content = {
            "daily_locations": merge_dicts(existing_content.get("daily_locations"), request.daily_locations),
            "day_notes": merge_dicts(existing_content.get("day_notes"), request.day_notes),
            "day_costs": merge_dicts(existing_content.get("day_costs"), request.day_costs),
            "day_tickets": merge_dicts(existing_content.get("day_tickets"), request.day_tickets)
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
                "link_url": item.link_url
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
async def update_day_data(trip_id: str, request: UpdateDayDataRequest, supabase=Depends(get_supabase)):
    """📝 更新特定天的注意事項、預估花費、交通票券"""
    try:
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


@router.patch("/trips/{trip_id}/info")
async def update_trip_info(trip_id: str, request: UpdateInfoRequest, supabase=Depends(get_supabase)):
    """✈️ 更新行程資訊 (航班、住宿、信用卡)"""
    try:
        # 1. 如果有更新信用卡，執行 Safe Merge
        if request.credit_cards is not None:
            # A. 抓取現有資料
            res = supabase.table("itineraries").select("content").eq("id", trip_id).single().execute()
            content = res.data['content'] or {}
            existing_cards = content.get("credit_cards", [])
            
            # B. 建立 ID 對照表 (以新傳入的為主)
            # 邏輯：前端傳來的 list 是「該使用者希望的最新狀態」
            # 但為了避免覆蓋其他人剛加的卡片，我們應該採取「Union」策略嗎？
            # 不，這裡的 Safe Merge 定義是：
            # "保留不在 request 但存在於 DB 的卡片 (可能是別人加的)" -> 不對，這樣刪除會失效
            # "更新存在於 request 的卡片，保留 request 沒有但 DB 有的卡片" -> 這樣無法刪除
            # 
            # 修正 Safe Merge 策略：
            # 前端應當先 fetch 最新資料，然後再送出完整清單。
            # 但為了防止 race condition，我們這裡做簡單的 ID based merge:
            # 1. 讀取 DB 現有卡片
            # 2. 將 Request 裡的卡片覆寫/新增進去
            # 3. 只有當 Request 顯式包含的 ID 才會被更新，沒包含的 ID 保持原樣 (這樣也導致無法刪除)
            # 
            # 為了支援刪除，前端必須送出「完整清單」。
            # 若要防止覆蓋別人新增的卡片 (Race Condition)，我們假設前端在編輯前有 polling。
            # 這裡我們採取：直接更新 content.credit_cards = request.credit_cards
            # 因為這不是 append only，而是管理 list。
            # 為了符合 User 的 "Safe Merge" 期待 (防止覆蓋別人同時新增的卡片):
            # 我們可以做: DB = (DB - RequestIDs) + Request
            # 這樣如果別人新增了 ID_99，而我更新 ID_01，ID_99 不會被我洗掉。
            
            incoming_ids = {c["id"] for c in request.credit_cards}
            merged_cards = [c for c in existing_cards if c["id"] not in incoming_ids] # 保留沒動到的
            merged_cards.extend(request.credit_cards) # 加上新的/更新的
            
            content["credit_cards"] = merged_cards
            
            # 更新 content
            supabase.table("itineraries").update({"content": content}).eq("id", trip_id).execute()

        # 2. 更新 Flight/Hotel (Legacy columns)
        # 注意：這兩個欄位在 DB 是獨立 column，不是在 content 裡 (根據 models 定義)
        # 不需要 Safe Merge，直接覆蓋即可 (因為通常是一個人在編輯)
        data = {
            "flight_info": request.flight_info,
            "hotel_info": request.hotel_info
        }
        supabase.table("itineraries").update(data).eq("id", trip_id).execute()
        
        return {"status": "success"}
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
            "location_lng": request.lng
        }
        
        res = supabase.table("itinerary_items").insert(data).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="插入失敗")
        
        print(f"✅ 單筆行程新增成功：{request.place_name}")
        return {"status": "success", "data": res.data}
    except Exception as e:
        print(f"🔥 Create Item Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        # 👇 新增：處理 sub_items (連結列表)
        if request.sub_items is not None: data["sub_items"] = request.sub_items
        # 👇 新增：處理分類與標籤
        if request.category is not None: data["category"] = request.category
        if request.tags is not None: data["tags"] = request.tags
        
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
