"""
Users Router
------------
Handles user-related API endpoints.
Now interacts with the dedicated `public.users` table (Phase 27).
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
import uuid
from datetime import datetime, timezone
from utils.deps import get_supabase
from models.base import UpdateProfileRequest

# 🆕 Standardized prefix for user endpoints
router = APIRouter(prefix="/api/users", tags=["users"])

def is_valid_uuid(val: str):
    """🩺 驗證是否為有效的 UUID 格式，防止字串如 'null' 觸發 DB 錯誤"""
    if not val or val.lower() == "null" or val.lower() == "undefined":
        return False
    try:
        uuid.UUID(str(val))
        return True
    except ValueError:
        return False

@router.get("/{user_id}/profile")
async def get_user_profile(user_id: str, supabase=Depends(get_supabase)):
    """
    🔍 獲取使用者個人資料 (暱稱、頭貼)
    
    從 `public.users` 表取資料 (Single Source of Truth)
    """
    # 🛡️ Defensive Check: UUID 格式預檢
    if not is_valid_uuid(user_id):
        print(f"🚫 無效的 User ID 格式: {user_id}")
        return {
            "id": user_id,
            "nickname": "Traveler",
            "avatar_url": None,
            "error": "Invalid ID format"
        }

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


@router.put("/me")
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
    
    # 🛡️ Defensive Check: UUID 格式預檢
    if not is_valid_uuid(user_id):
        print(f"🚫 無效的 User ID 格式: {user_id} (update attempt)")
        raise HTTPException(status_code=400, detail=f"Invalid User ID format: {user_id}")
        
    print(f"✏️ Updating user {user_id} data: {request}")
    
    try:
        # 🆕 Normalize User ID: Trim whitespace and ensure valid UUID
        user_id_clean = user_id.strip() if user_id else ""
        if not is_valid_uuid(user_id_clean):
            print(f"🚫 無效的 User ID 格式: '{user_id_clean}' (normalized from '{user_id}')")
            raise HTTPException(status_code=400, detail=f"Invalid User ID format: {user_id_clean}")
            
        user_uuid = str(uuid.UUID(user_id_clean))
        print(f"🔍 Normalized UUID: {user_uuid}")
        
        # 🛡️ Direct HTTP approach - Bypass SDK to avoid UUID type issues
        import os
        import requests as http_requests
        
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        
        if not supabase_url or not supabase_key:
            print("❌ Missing Supabase credentials in .env")
            raise HTTPException(status_code=500, detail="Server configuration error: Missing Supabase credentials")

        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
        # Step 1: Check if user exists
        check_url = f"{supabase_url}/rest/v1/users?id=eq.{user_uuid}&select=id"
        print(f"📡 Checking existence at: {check_url}")
        
        try:
            check_resp = http_requests.get(check_url, headers=headers, timeout=10)
        except Exception as conn_err:
            print(f"🔥 Supabase Connection Error: {conn_err}")
            raise HTTPException(status_code=503, detail="無法連線至資料庫服務，請稍後再試")
        
        if not check_resp.ok:
            print(f"❌ Check existence failed: {check_resp.status_code} - {check_resp.text}")
            
            # 🛡️ Cautious Fallback: 若資料表真的不存在 (404)，不應該直接噴 500 卡死前端
            # 相反地，我們回傳成功，讓前端能完成本地快取更新，維持使用者體驗。
            if check_resp.status_code == 404:
                print("⚠️ [Resilience] users 資料表不存在！執行降級處理 (Success with missing table)")
                return {
                    "status": "success", 
                    "message": "Profile updated (Session Only - Database Migration Pending)",
                    "data": {"id": user_uuid, "name": request.name}
                }
            
            raise HTTPException(status_code=check_resp.status_code, detail=f"Supabase check failed: {check_resp.text}")

        user_exists = len(check_resp.json()) > 0
        print(f"👤 User exists: {user_exists}")
        
        if user_exists:
            # Step 2a: User exists - PATCH to update
            print(f"📝 Updating existing user: {user_uuid}")
            update_data = {}
            if request.name is not None:
                update_data["name"] = request.name
            if request.avatar_url is not None:
                update_data["avatar_url"] = request.avatar_url
            
            update_url = f"{supabase_url}/rest/v1/users?id=eq.{user_uuid}"
            print(f"📡 PATCH URL: {update_url}")
            resp = http_requests.patch(update_url, headers=headers, json=update_data, timeout=10)
        else:
            # Step 2b: User doesn't exist - POST to insert
            print(f"🆕 Creating new user: {user_uuid}")
            insert_data = {
                "id": user_uuid,
                "name": request.name or "Traveler",
                "avatar_url": request.avatar_url
            }
            insert_url = f"{supabase_url}/rest/v1/users"
            print(f"📡 POST URL: {insert_url}")
            resp = http_requests.post(insert_url, headers=headers, json=insert_data, timeout=10)
        
        if resp.ok:
            result_data = resp.json()
            print(f"✅ User update/insert success: {result_data}")
            return {"status": "success", "data": result_data[0] if result_data else {"id": user_uuid}}
        else:
            print(f"🔥 HTTP Error during update: {resp.status_code} - {resp.text}")
            # Same guard for the update/insert response - Resilience fallback
            if resp.status_code == 404:
                print("⚠️ [Resilience] Update blocked by missing table. Returning 200 to UI.")
                return {"status": "success", "note": "Table missing, update skipped"}
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Update Profile Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
