from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from .expenses import normalize_items
from utils.deps import get_supabase
from models.base import ExpenseItem

router = APIRouter(prefix="/api/ledger", tags=["ledger"])

@router.get("/{code}")
async def get_public_ledger(
    code: str,
    supabase=Depends(get_supabase)
):
    """
    🌐 公開帳目查詢 (無需認證)
    
    用於分享給非 App 用戶查看的公開對帳頁面。
    """
    try:
        # 1. 透過分享碼尋找行程
        trip_res = supabase.table("itineraries")\
            .select("id, title, start_date, end_date")\
            .eq("ledger_share_code", code)\
            .execute()
            
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="對帳連結已失效或不存在")
            
        trip = trip_res.data[0]
        itinerary_id = trip["id"]
        
        # 2. 抓取成員清單 (用於匿名化顯示名字)
        members_res = supabase.table("trip_members")\
            .select("user_id, user_name")\
            .eq("itinerary_id", itinerary_id)\
            .execute()
        
        member_map = {m["user_id"]: m["user_name"] for m in members_res.data} if members_res.data else {}
        
        # 3. 抓取公開帳目
        expenses_res = supabase.table("expenses")\
            .select("*")\
            .eq("itinerary_id", itinerary_id)\
            .eq("is_public", True)\
            .order("incurred_at", desc=False)\
            .execute()
            
        all_expenses = expenses_res.data or []
        
        # 4. 轉換數據格式並計算台幣金額
        formatted_expenses = []
        total_twd = 0.0
        
        for exp in all_expenses:
            # 🧮 匯率換算邏輯 (TWD 核心)
            rate = exp.get("exchange_rate") or 1.0
            amount = exp.get("amount") or 0.0
            amount_twd = round(amount * rate)
            total_twd += amount_twd
            
            # 👤 Payer 名稱解析
            payer_id = exp.get("payer_id")
            payer_name = member_map.get(payer_id, "訪客") if payer_id else "訪客"
            
            # 如果 payer_id 沒名字，嘗試從 creator_name 拿
            if payer_name == "訪客" and exp.get("creator_name"):
                payer_name = exp.get("creator_name")

            # 📅 日期格式化
            raw_date = exp.get('incurred_at') or ''
            date_str = str(raw_date).split('T')[0] if raw_date else "未定"

            formatted_expenses.append({
                "title": exp.get("title", "無標題"),
                "amount_twd": amount_twd,
                "original_amount": amount,
                "currency": exp.get("currency", "JPY"),
                "payer_name": payer_name,
                "notes": exp.get("notes"),
                "date": date_str
            })
            
        # 5. 回傳封裝
        return {
            "trip_name": trip["title"],
            "date_range": {
                "start": trip["start_date"],
                "end": trip["end_date"]
            },
            "total_twd": total_twd,
            "expenses": formatted_expenses,
            "members": [{"name": name} for name in member_map.values()]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Public Ledger Error: {e}")
        raise HTTPException(status_code=500, detail="系統讀取帳目失敗")
