"""
Users Router
------------
Handles user-related API endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from utils.deps import get_supabase

router = APIRouter(prefix="/api", tags=["users"])

@router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str, supabase=Depends(get_supabase)):
    """
    🔍 獲取使用者個人資料 (暱稱、頭貼)
    
    用於 Account Recovery 時，恢復使用者的身份識別資訊。
    """
    try:
        # 1. 查詢 users table (或是 profiles table，視 Supabase setup 而定)
        # 假設使用者資訊儲存在 users table 或 auth.users 的 metadata
        # 由於 Supabase auth 使用者資料通常在 auth.users，但我們無法直接 access auth schema
        # 我們假設 app 有一個 public.users table 或是儲存在 local storage 同步的表
        # 
        # 根據現有程式碼，似乎沒有明確的 'users' table sync。
        # 我們檢查 trips table 的 creator_name? 不，那不準。
        #
        # 根據 `models/base.py`，我們沒有 User model。
        # 根據 `verify_api.py`，我們沒有 user endpoints。
        #
        # 假設：我們先查詢 `itineraries` table，找一筆該 user 建立的行程，取其 `creator_name`。
        # 這是一個 workaround，因為我們可能沒有獨立的 user profile table。
        
        print(f"🔍 正在尋找使用者 {user_id} 的資料...")
        
        # 嘗試從 itineraries table 找最近一筆由該 user 建立的行程
        res = supabase.table("itineraries")\
            .select("creator_name")\
            .eq("created_by", user_id)\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
            
        if res.data and len(res.data) > 0:
            nickname = res.data[0].get("creator_name", "Unknown Traveler")
            print(f"✅ 找到暱稱: {nickname}")
            return {
                "id": user_id,
                "nickname": nickname,
                "avatar_url": None # 暫時不支援 avatar
            }
            
        # 如果找不到行程，回傳預設值
        print("⚠️ 找不到任何行程記錄，回傳預設暱稱")
        return {
            "id": user_id,
            "nickname": "Returned Traveler", 
            "avatar_url": None
        }

    except Exception as e:
        print(f"🔥 Get Profile Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
