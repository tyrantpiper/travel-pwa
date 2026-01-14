"""
Users Router
------------
Handles user-related API endpoints.
Now interacts with the dedicated `public.users` table (Phase 27).
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from utils.deps import get_supabase
from models.base import UpdateProfileRequest

router = APIRouter(prefix="/api", tags=["users"])

@router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str, supabase=Depends(get_supabase)):
    """
    🔍 獲取使用者個人資料 (暱稱、頭貼)
    
    從 `public.users` 表取資料 (Single Source of Truth)
    """
    try:
        print(f"🔍 正在尋找使用者 {user_id} 的資料...")
        
        # 1. 直接查詢 public.users
        res = supabase.table("users").select("id, name, avatar_url, email").eq("id", user_id).single().execute()
        
        if res.data:
            user = res.data
            nickname = user.get("name") or "Unknown Traveler"
            avatar_url = user.get("avatar_url")
            print(f"✅ 找到使用者: {nickname}")
            
            return {
                "id": user_id,
                "nickname": nickname,
                "avatar_url": avatar_url
            }
            
        # 2. 如果找不到 (可能是 Legacy users 或 Trigger 尚未同步)
        # Fallback: 嘗試從 itineraries table 找 (舊邏輯，作為安全網)
        print("⚠️ users 表找不到資料，嘗試使用 Legacy Fallback...")
        res_legacy = supabase.table("itineraries")\
            .select("creator_name")\
            .eq("created_by", user_id)\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
            
        if res_legacy.data and len(res_legacy.data) > 0:
            nickname = res_legacy.data[0].get("creator_name", "Legacy Traveler")
            print(f"✅ (Fallback) 找到暱稱: {nickname}")
            return {
                "id": user_id,
                "nickname": nickname,
                "avatar_url": None
            }

        # 3. 真的找不到
        print("⚠️ 找不到任何記錄，回傳預設值")
        return {
            "id": user_id,
            "nickname": "New Traveler", 
            "avatar_url": None
        }

    except Exception as e:
        print(f"🔥 Get Profile Error: {e}")
        # 不回傳 500，以免卡死前端，回傳預設值即可
        return {
            "id": user_id,
            "nickname": "Traveler",
            "avatar_url": None
        }


@router.put("/users/me")
async def update_user_profile(
    request: UpdateProfileRequest,
    user_id: str = Header(None, alias="X-User-ID"),
    supabase=Depends(get_supabase)
):
    """
    ✏️ 更新使用者資料
    
    更新 `public.users` 表。
    Database Trigger (`on_profile_updated`) 會自動同步更新所有的 `trip_members`。
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-ID")
        
    print(f"✏️ 更新使用者 {user_id} 資料: {request}")
    
    try:
        updates = {}
        if request.name is not None:
            updates["name"] = request.name
        if request.avatar_url is not None:
            updates["avatar_url"] = request.avatar_url
            
        if not updates:
            return {"status": "no_change"}
            
        updates["updated_at"] = "now()"
        
        # 更新 public.users
        # 1. 嘗試 Update
        res = supabase.table("users").update(updates).eq("id", user_id).execute()
        
        # 2. 如果沒更新到 (可能是舊用戶，public.users 沒資料)，則嘗試 Insert (Upsert)
        if not res.data:
            print("⚠️ Update 失敗 (無資料)，嘗試 Upsert...")
            # 必須包含 ID 才能 Insert
            updates["id"] = user_id
            res = supabase.table("users").upsert(updates).execute()
        
        if not res.data:
             raise HTTPException(status_code=500, detail="Update failed")
             
        print(f"✅ 使用者資料更新成功: {res.data}")
        return {"status": "success", "data": res.data[0]}

    except Exception as e:
        print(f"🔥 Update Profile Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
