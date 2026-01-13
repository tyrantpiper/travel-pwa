"""
Expenses Router
---------------
Handles all expense-related API endpoints.
"""

from fastapi import APIRouter, Header, HTTPException, Depends
from models.base import ExpenseRequest, UpdateExpenseRequest
from utils.deps import get_supabase

router = APIRouter(prefix="/api", tags=["expenses"])


@router.post("/expenses")
async def add_expense(request: ExpenseRequest, supabase=Depends(get_supabase)):
    """創建新費用記錄"""
    try:
        print(f"📝 [Expense] Creating expense: {request.title}, amount: {request.amount_jpy}, user: {request.created_by}")
        payload = {
            "itinerary_id": request.itinerary_id,
            "title": request.title,
            "amount": request.amount_jpy,
            "currency": request.currency or "JPY",  # 🆕 Use dynamic currency
            "category": request.category,
            "is_public": request.is_public,
            "created_by": request.created_by,
            "payment_method": request.payment_method,
            "exchange_rate": request.exchange_rate,
            "card_name": request.card_name,
            "cashback_rate": request.cashback_rate,
            "image_url": request.image_url,
            "incurred_at": request.expense_date  # 🔧 FIX: DB column is 'incurred_at' not 'expense_date'
        }
        print(f"   Payload: {payload}")
        result = supabase.table("expenses").insert(payload).execute()
        print(f"   ✅ Success: {result}")
        return {"status": "success"}
    except Exception as e:
        print(f"   ❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trips/{trip_id}/expenses")
async def get_expenses(
    trip_id: str, 
    user_id: str = Header(None, alias="X-User-ID"),
    supabase=Depends(get_supabase)
):
    """獲取行程的費用列表
    
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
    supabase=Depends(get_supabase)
):
    """更新費用記錄"""
    try:
        data = request.dict(exclude_unset=True)
        if 'amount_jpy' in data:
            data['amount'] = data.pop('amount_jpy')  # 對應 DB 欄位
        
        # 🆕 Currency update is handled automatically if present in request due to Pydantic model
        
        supabase.table("expenses").update(data).eq("id", expense_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, supabase=Depends(get_supabase)):
    """刪除費用記錄"""
    try:
        supabase.table("expenses").delete().eq("id", expense_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
