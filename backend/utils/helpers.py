"""
Shared Helper Functions
-----------------------
Centralized utility functions for use across all routers.
"""

import random
import string


def generate_room_code() -> str:
    """
    產生 6 位數房間代碼 (系統兼容 4~6 位數)
    
    用於行程分享功能，讓用戶可以透過房間碼加入行程。
    
    Returns:
        str: 6 位數的隨機數字字串 (e.g., "123456", "098765")
    """
    return ''.join(random.choices(string.digits, k=6))

def generate_public_id() -> str:
    """
    產生隨機公開 ID (URL 使用)
    格式: pub_ 加上 8 位英數混合字串
    """
    chars = string.ascii_lowercase + string.digits
    suffix = ''.join(random.choices(chars, k=8))
    return f"pub_{suffix}"

async def ensure_user_exists(supabase, user_id: str, name: str = None):
    """🛡️ 帳號自動啟用 (Auto-Activation)
    
    確保使用者在 public.users 表中存在，以滿足外鍵約束。
    這是為了解決匿名使用者 (只有 UUID) 第一次登入後尚未更新 Profile 就執行寫入操作導致的失敗。
    """
    if not user_id or user_id.lower() in ["null", "undefined"]:
        return

    try:
        # 1. 檢查是否存在 (用 select 比直接 upsert 安全，可避免觸發 sync trigger)
        res = supabase.table("users").select("id, name").eq("id", user_id).execute()
        
        if not res.data:
            # 2. 不存在則建立基本檔案
            print(f"🪄 User Auto-Activation: Registering {user_id} as '{name or 'Traveler'}'")
            supabase.table("users").insert({
                "id": user_id,
                "name": name or "Traveler",
                "avatar_url": None
            }).execute()
        elif name and (not res.data[0].get("name") or res.data[0].get("name") == "Traveler"):
            # 3. 存在但名字是預設值，且現在有提供名字，則更新它
            supabase.table("users").update({"name": name}).eq("id", user_id).execute()
            
    except Exception as e:
        # 僅記錄錯誤而不拋出，以免主流程中斷 (容錯設計)
        print(f"⚠️ Auto-Activation failed for {user_id}: {e}")
