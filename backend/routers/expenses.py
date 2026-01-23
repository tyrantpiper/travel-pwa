"""
Expenses Router
---------------
Handles all expense-related API endpoints.
"""

from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Depends
from models.base import ExpenseRequest, UpdateExpenseRequest
from utils.deps import get_supabase, get_verified_user
from utils.helpers import ensure_user_exists

router = APIRouter(prefix="/api", tags=["expenses"])


@router.post("/expenses")
async def add_expense(
    request: ExpenseRequest, 
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """創建新費用記錄"""
    try:
        # 🛡️ 權限檢查 (Cautious Authorization Check)
        if user_id and request.itinerary_id:
            member_check = supabase.table("trip_members")\
                .select("user_id")\
                .eq("itinerary_id", request.itinerary_id)\
                .eq("user_id", user_id)\
                .execute()
            
            if not member_check.data:
                raise HTTPException(status_code=403, detail="您沒有權限為此行程新增費用")

        print(f"📝 [Expense] Creating expense: {request.title}, amount: {request.amount_jpy}, user: {request.created_by}")
        
        # 🆕 Phase 7: Ensure user exists before adding expense (FK defense)
        await ensure_user_exists(supabase, request.created_by, request.creator_name)
        
        payload = {
            "itinerary_id": request.itinerary_id,
            "title": request.title,
            "amount": request.amount_jpy,
            "currency": request.currency or "JPY",  # 🆕 Use dynamic currency
            "category": request.category,
            "is_public": request.is_public,
            "created_by": request.created_by,
            "creator_name": request.creator_name,  # 🆕 Cache creator name for sync
            "payment_method": request.payment_method,
            "exchange_rate": request.exchange_rate,
            "card_name": request.card_name,
            "cashback_rate": request.cashback_rate,
            "image_url": request.image_url,
            "incurred_at": request.expense_date  # 🔧 FIX: DB column is 'incurred_at' not 'expense_date'
        }
        result = supabase.table("expenses").insert(payload).execute()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"   ❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trips/{trip_id}/expenses")
async def get_expenses(
    trip_id: str, 
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """獲獲取行程的費用列表
    
    邏輯：抓出 (該行程的所有公帳) OR (該行程中 我建立的私帳)
    """
    try:
        res = supabase.table("expenses").select("*").eq("itinerary_id", trip_id).execute()
        all_expenses = res.data
        
        filtered = []
        for exp in all_expenses:
            # 🆕 Phase 10.5: Map DB column to frontend field name
            exp['expense_date'] = exp.get('incurred_at')
            
            # 如果是公帳 -> 顯示
            if exp['is_public']:
                filtered.append(exp)
            # 如果是私帳 -> 檢查是否為本人
            elif exp['created_by'] == user_id:
                filtered.append(exp)
                
        return filtered
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/expenses/{expense_id}")
async def update_expense(
    expense_id: str, 
    request: UpdateExpenseRequest,
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """更新費用記錄"""
    try:
        # 🛡️ 權限檢查 (本人才能修改自己的私帳，或成員修改公帳)
        exp_res = supabase.table("expenses").select("*").eq("id", expense_id).execute()
        if not exp_res.data:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        exp_data = exp_res.data[0]
        if user_id and exp_data['created_by'] != user_id:
             # 如果不是本人，必須是行程成員才能修改公帳 (或乾脆禁止非本人修改)
             if not exp_data['is_public']:
                 raise HTTPException(status_code=403, detail="您沒有權限修改此費用")
             
             # 公帳修改權限檢查
             member_check = supabase.table("trip_members")\
                .select("user_id")\
                .eq("itinerary_id", exp_data['itinerary_id'])\
                .eq("user_id", user_id)\
                .execute()
             if not member_check.data:
                 raise HTTPException(status_code=403, detail="您沒有權限修改此行程的公帳費用")

        data = request.dict(exclude_unset=True)
        if 'amount_jpy' in data:
            data['amount'] = data.pop('amount_jpy')  # 對應 DB 欄位
            
        # 🔧 FIX Phase 13: Map frontend 'expense_date' to DB 'incurred_at'
        if 'expense_date' in data:
            data['incurred_at'] = data.pop('expense_date')

        supabase.table("expenses").update(data).eq("id", expense_id).execute()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: str, 
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """刪除費用記錄"""
    try:
        # 🛡️ 權限檢查
        exp_res = supabase.table("expenses").select("created_by").eq("id", expense_id).execute()
        if exp_res.data and user_id and exp_res.data[0]['created_by'] != user_id:
             raise HTTPException(status_code=403, detail="您只能刪除自己建立的費用")

        supabase.table("expenses").delete().eq("id", expense_id).execute()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
