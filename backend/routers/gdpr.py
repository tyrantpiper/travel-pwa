"""
GDPR Router
-----------
Handles GDPR compliance endpoints for user data deletion.
"""

from fastapi import APIRouter, Depends, HTTPException

from utils.deps import get_supabase

router = APIRouter(prefix="/api", tags=["gdpr"])


@router.delete("/user/{user_id}/data")
async def delete_user_data(user_id: str, supabase=Depends(get_supabase)):
    """
    🗑️ 刪除用戶的所有資料 (GDPR 合規)
    
    刪除順序（避免外鍵約束）：
    1. expenses (消費記錄)
    2. itinerary_items (行程細項)
    3. trip_members (成員關係)
    4. itineraries (主行程)
    """
    try:
        print(f"🗑️ GDPR 刪除請求: user_id = {user_id}")
        deleted_counts = {}
        
        # 1. 先取得該用戶創建的所有行程 ID
        trips_res = supabase.table("itineraries").select("id").eq("created_by", user_id).execute()
        trip_ids = [t["id"] for t in trips_res.data] if trips_res.data else []
        print(f"   📋 找到 {len(trip_ids)} 個行程")
        
        # 2. 刪除消費記錄 (by created_by)
        exp_res = supabase.table("expenses").delete().eq("created_by", user_id).execute()
        deleted_counts["expenses"] = len(exp_res.data) if exp_res.data else 0
        print(f"   ✅ 消費記錄: {deleted_counts['expenses']} 筆")
        
        # 3. 刪除行程細項 (by itinerary_id)
        items_deleted = 0
        for trip_id in trip_ids:
            items_res = supabase.table("itinerary_items").delete().eq("itinerary_id", trip_id).execute()
            items_deleted += len(items_res.data) if items_res.data else 0
        deleted_counts["items"] = items_deleted
        print(f"   ✅ 行程細項: {items_deleted} 筆")
        
        # 4. 刪除成員關係 (by user_id)
        mem_res = supabase.table("trip_members").delete().eq("user_id", user_id).execute()
        deleted_counts["members"] = len(mem_res.data) if mem_res.data else 0
        print(f"   ✅ 成員關係: {deleted_counts['members']} 筆")
        
        # 5. 刪除主行程 (by creator_id)
        trip_res = supabase.table("itineraries").delete().eq("created_by", user_id).execute()
        deleted_counts["trips"] = len(trip_res.data) if trip_res.data else 0
        print(f"   ✅ 主行程: {deleted_counts['trips']} 筆")
        
        print(f"🎉 GDPR 刪除完成: {deleted_counts}")
        return {
            "status": "success",
            "message": "所有資料已刪除",
            "deleted": deleted_counts
        }
        
    except Exception as e:
        print(f"🔥 GDPR Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
