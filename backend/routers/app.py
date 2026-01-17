"""
App Router
----------
Handles global app-level settings and meta-information.
"""

from fastapi import APIRouter, HTTPException, Depends
from utils.deps import get_supabase
from datetime import datetime

router = APIRouter(prefix="/api/app", tags=["app"])

@router.get("/donation-progress")
async def get_donation_progress(supabase=Depends(get_supabase)):
    """
    💰 獲取捐贈進度
    
    從 Supabase `app_settings` 表讀取，避免前端直接連線 Supabase 可能造成的網路問題。
    """
    try:
        res = supabase.table("app_settings")\
            .select("value")\
            .eq("key", "donation_progress")\
            .single()\
            .execute()
        
        if not res.data:
            # 預設值，避免前端出錯
            return {
                "current": 0,
                "goal": 2000,
                "month": datetime.now().strftime("%Y-%m")
            }
            
        return res.data["value"]

    except Exception as e:
        print(f"🔥 Get Donation Progress Error: {e}")
        # 回傳預設值
        return {
            "current": 0,
            "goal": 2000,
            "month": datetime.now().strftime("%Y-%m")
        }
