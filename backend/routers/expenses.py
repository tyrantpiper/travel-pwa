from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Header, HTTPException, Depends
from models.base import (
    ExpenseRequest, 
    UpdateExpenseRequest, 
    ExpenseResponse, 
    ExpenseItem, 
    ReceiptDiagnostics
)
from utils.deps import get_supabase, get_verified_user
from utils.helpers import ensure_user_exists
import json

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


def normalize_items(details: Any, version: int) -> List[ExpenseItem]:
    """將 DB details 轉換為標準化的 ExpenseItem 列表 (v1 -> v2)"""
    if not details:
        return []
        
    if version == 1:
        # 考古模式: [{name, price}] -> [{original_name, amount}]
        return [
            ExpenseItem(original_name=item.get("name", "Unknown"), amount=item.get("price", 0.0))
            for item in details if isinstance(item, dict)
        ]
    
    # 現代模式 (v2): 直接讀取
    try:
        return [ExpenseItem(**item) for item in details if isinstance(item, dict)]
    except Exception:
        return []


def calculate_total_fallback(data_source: Any, provided_total: Optional[float] = None) -> Optional[float]:
    """計算細目總和，作為 total_amount 的真實來源 (真相機制 V2)"""
    def get_float(key, default=0.0):
        val = 0.0
        if hasattr(data_source, key):
            val = getattr(data_source, key)
        elif isinstance(data_source, dict):
            val = data_source.get(key)
        
        if val is None: return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    # 確保所有輸入均為 float，防止 Decimal vs Float 碰撞
    subtotal = get_float("subtotal_amount")
    tax = get_float("tax_amount")
    tip = get_float("tip_amount")
    service = get_float("service_charge_amount")
    discount = get_float("discount_amount")
    
    # 檢查是否帶有明細列表 (v23.1 標準)
    items_list = []
    if isinstance(data_source, dict):
        items_list = data_source.get("items") or data_source.get("details") or []
    elif hasattr(data_source, "items"):
        cand = getattr(data_source, "items")
        if not callable(cand):
            items_list = cand or []
    
    has_items = len(items_list) > 0

    # 🛡️ 累加明細金額 (強制轉型)
    items_sum = 0.0
    if has_items:
        for it in items_list:
            amt_val = 0.0
            if isinstance(it, dict): 
                amt_val = it.get("amount") or it.get("price") or 0.0
            elif hasattr(it, "amount"): 
                amt_val = getattr(it, "amount") or 0.0
            try:
                items_sum += float(amt_val)
            except (ValueError, TypeError):
                continue

    # 🕵️ Truth Source Priority: Actual Line Items > Summary Subtotal
    effective_subtotal = items_sum if has_items and items_sum != 0 else subtotal
    
    # 🛡️ 智慧加總判定 (Smart Heuristic):
    sum_net = round(effective_subtotal + tax + tip + service, 2)         # 小計已含折扣
    sum_gross = round(effective_subtotal - discount + tax + tip + service, 2) # 小計未含折扣
    
    if effective_subtotal == 0 and tax == 0 and tip == 0 and service == 0 and discount == 0:
        return None

    # 如果有提供總額做比對，則選取最吻合的版本
    if provided_total is not None:
        p_total = float(provided_total)
        if p_total > 0:
            if abs(sum_net - p_total) < 0.05:
                # print(f"[Forensic] Heuristic MATCH: Net version ({sum_net}) matches provided ({p_total})")
                return sum_net
            if abs(sum_gross - p_total) < 0.05:
                # print(f"[Forensic] Heuristic MATCH: Gross version ({sum_gross}) matches provided ({p_total})")
                return sum_gross
            
    # 預設採用減去折扣的版本
    return sum_gross


@router.post("")
async def add_expense(
    request: ExpenseRequest, 
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """建立新費用記錄 (v23.1)"""
    try:
        if user_id and request.itinerary_id:
            member_check = supabase.table("trip_members")\
                .select("user_id")\
                .eq("itinerary_id", request.itinerary_id)\
                .eq("user_id", user_id)\
                .execute()
            
            if not member_check.data:
                raise HTTPException(status_code=403, detail="您沒有權限為此行程新增費用")

        # 🛡️ 真相源校驗
        provided_total = request.total_amount if request.total_amount is not None else request.amount_jpy
        computed_total = calculate_total_fallback(request, provided_total=provided_total)
        
        validation_msg = request.diagnostics.message if request.diagnostics else ""
        
        # === Truth Source Determination Mechanism ===
        # We prioritize user/AI input (provided_total) over the calculated items sum (computed_total).
        # This prevents AI-recognized amounts (e.g., 2751) from being silently reverted 
        # to residual subtotal values (e.g., 1575) if they don't perfectly match line items.
        
        if computed_total is None:
            # Full Trust Mode: If no line items exist, we must trust the provided total.
            final_total = provided_total if provided_total is not None else 0.0
        elif provided_total is not None and provided_total > 0:
            # User Override: Non-zero user input or AI detection is considered the single source of truth.
            final_total = provided_total
            if abs(provided_total - computed_total) > 0.05:
                # 🕵️ Ultra-Detailed Trace to catch the mystery
                detailed_trace = f" [System Warning] Provided total ({provided_total}) differs from Computed total ({computed_total}). "
                detailed_trace += f"Breakdown used: Subtotal:{request.subtotal_amount} + Tax:{request.tax_amount} + Tip:{request.tip_amount} + Service:{request.service_charge_amount} - Discount:{request.discount_amount}"
                validation_msg = (validation_msg or "") + detailed_trace
            else:
                # MATCHED via heuristic! Clear any lingering warnings.
                validation_msg = "[BACKEND_VERIFIED] "
        else:
            # Fallback Mode: Only use computed total if no explicit total was provided.
            final_total = computed_total
            validation_msg = ""

        await ensure_user_exists(supabase, request.created_by, request.creator_name)
        
        # Mapping Layer
        items_json = [item.dict() for item in request.items] if request.items else []
        
        payload = {
            "itinerary_id": request.itinerary_id,
            "title": request.title,
            "amount": final_total,
            "currency": request.currency,
            "category": request.category,
            "is_public": request.is_public,
            "created_by": request.created_by,
            "creator_name": request.creator_name,
            "payment_method": request.payment_method,
            "exchange_rate": request.exchange_rate,
            "card_name": request.card_name,
            "cashback_rate": request.cashback_rate,
            "image_url": request.image_url,
            "incurred_at": request.expense_date,
            "details": items_json,
            "subtotal_amount": request.subtotal_amount,
            "tax_amount": request.tax_amount,
            "tip_amount": request.tip_amount,
            "service_charge_amount": request.service_charge_amount,
            "discount_amount": request.discount_amount,
            "details_schema_version": 2,
            # Persistence Logic: Mapping validation status for AI/User diagnostics
            "validation_status": "pass" if validation_msg == "" or "[BACKEND_VERIFIED]" in validation_msg else (request.diagnostics.status if request.diagnostics else "warning"),
            "validation_code": request.diagnostics.code if request.diagnostics else None,
            "validation_message": "[BACKEND_VERIFIED] " + validation_msg if validation_msg == "" else validation_msg,
            "mismatch_amount": request.diagnostics.mismatch_amount if request.diagnostics else 0.0,
            "notes": request.notes,
            "custom_icon": request.custom_icon,
            "payer_id": request.payer_id
        }
        
        supabase.table("expenses").insert(payload).execute()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Add Expense Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{trip_id}/expenses")
async def get_expenses(
    trip_id: str, 
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """獲取行程的費用列表 (v23.1 Normalization)"""
    try:
        res = supabase.table("expenses").select("*").eq("itinerary_id", trip_id).execute()
        
        filtered = []
        for exp in res.data:
            is_owner = str(exp.get('created_by')) == user_id
            if not (exp.get('is_public') or is_owner):
                continue

            raw_date = exp.get('incurred_at') or ''
            expense_date = str(raw_date).split('T')[0] if raw_date else None
            
            version = exp.get("details_schema_version", 1)
            items = normalize_items(exp.get("details", []), version)
            
            expense_resp = ExpenseResponse(
                id=str(exp["id"]),
                itinerary_id=str(exp["itinerary_id"]),
                title=exp.get("title", "Untitled"),
                total_amount=exp.get("amount", 0.0),
                amount=exp.get("amount", 0.0), # Sync for backward compatibility
                subtotal_amount=exp.get("subtotal_amount", 0.0),
                tax_amount=exp.get("tax_amount", 0.0),
                tip_amount=exp.get("tip_amount", 0.0),
                service_charge_amount=exp.get("service_charge_amount", 0.0),
                discount_amount=exp.get("discount_amount", 0.0),
                currency=exp.get("currency", "JPY"),
                category=exp.get("category", "其他"),
                is_public=exp.get("is_public", True),
                expense_date=expense_date,
                payment_method=exp.get("payment_method"),
                exchange_rate=exp.get("exchange_rate"),
                items=items,
                diagnostics=ReceiptDiagnostics(
                    status=exp.get("validation_status", "pass"),
                    source="ai" if exp.get("validation_status") == "warning" else "user",
                    code=exp.get("validation_code"),
                    message=exp.get("validation_message"),
                    mismatch_amount=exp.get("mismatch_amount", 0.0)
                ),
                details_schema_version=version,
                created_at=str(exp.get("created_at")),
                created_by=str(exp.get("created_by")),
                creator_name=exp.get("creator_name"),
                image_url=exp.get("image_url"),
                card_name=exp.get("card_name"),
                cashback_rate=exp.get("cashback_rate", 0.0),
                custom_icon=exp.get("custom_icon"),
                notes=exp.get("notes"),
                payer_id=exp.get("payer_id")
            )
            filtered.append(expense_resp.dict())
                
        return filtered
    except Exception as e:
        print(f"❌ Get Expenses Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{expense_id}")
async def update_expense(
    expense_id: str, 
    request: UpdateExpenseRequest,
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """更新費用記錄 (v23.1)"""
    try:
        exp_res = supabase.table("expenses").select("*").eq("id", expense_id).execute()
        if not exp_res.data:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        exp_data = exp_res.data[0]
        if user_id and str(exp_data['created_by']) != user_id:
             if not exp_data['is_public']:
                 raise HTTPException(status_code=403, detail="您沒有權限修改此私有費用")
             
             member_check = supabase.table("trip_members")\
                .select("user_id")\
                .eq("itinerary_id", exp_data['itinerary_id'])\
                .eq("user_id", user_id)\
                .execute()
             if not member_check.data:
                 raise HTTPException(status_code=403, detail="您沒有權限修改此行程的公帳")

        raw_data = request.dict(exclude_unset=True)
        data = {}
        
        # Standard Fields
        simple_fields = [
            'title', 'currency', 'is_public', 'payment_method', 'category', 
            'image_url', 'exchange_rate', 'card_name', 'cashback_rate',
            'custom_icon', 'notes', 'payer_id'
        ]
        for f in simple_fields:
            if f in raw_data: data[f] = raw_data[f]
            
        if 'expense_date' in raw_data:
            data['incurred_at'] = raw_data['expense_date']

        # Financial Fields
        fin_fields = ['subtotal_amount', 'tax_amount', 'tip_amount', 'service_charge_amount', 'discount_amount']
        for field in fin_fields:
            if field in raw_data: data[field] = raw_data[field]

        if request.items is not None:
            # 🛡️ 關鍵修復：確保所有 Pydantic 模型都被序列化為字典，解決 500 序列化錯誤
            data['details'] = [item.dict() for item in request.items]
            data['details_schema_version'] = 2
            
        # 1. First, merge diagnostics from the request (if any)
        if 'diagnostics' in raw_data:
            diag = raw_data['diagnostics']
            if isinstance(diag, dict):
                if 'status' in diag: data['validation_status'] = diag.get('status')
                if 'code' in diag: data['validation_code'] = diag.get('code')
                if 'mismatch_amount' in diag: data['mismatch_amount'] = diag.get('mismatch_amount')
                if 'message' in diag: data['validation_message'] = diag.get('message')
            elif diag is not None:
                if hasattr(diag, 'status'): data['validation_status'] = getattr(diag, 'status')
                if hasattr(diag, 'code'): data['validation_code'] = getattr(diag, 'code')
                if hasattr(diag, 'mismatch_amount'): data['mismatch_amount'] = getattr(diag, 'mismatch_amount')
                if hasattr(diag, 'message'): data['validation_message'] = getattr(diag, 'message')

        # 2. Then, run the Truth Source Verification (Heuristic) - This is the FINAL JUDGE
        has_fin_update = 'items' in raw_data or any(f in raw_data for f in fin_fields)
        if has_fin_update:
            merged_info = {**exp_data, **raw_data}
            if 'total_amount' not in merged_info:
                merged_info['total_amount'] = merged_info.get('amount')
            
            try:
                provided_total = float(merged_info.get('total_amount') or merged_info.get('amount_jpy') or 0.0)
            except (ValueError, TypeError):
                provided_total = 0.0
                
            computed_total = calculate_total_fallback(merged_info, provided_total=provided_total)
            
            if computed_total is None:
                data['amount'] = provided_total if provided_total > 0 else exp_data.get('amount', 0.0)
            elif provided_total > 0:
                data['amount'] = provided_total
                if abs(provided_total - computed_total) > 0.05:
                    trace = f" [System Warning] Provided total ({provided_total}) differs from Computed total ({computed_total}). "
                    trace += f"Breakdown used: Subtotal:{merged_info.get('subtotal_amount')} + Tax:{merged_info.get('tax_amount')} + Tip:{merged_info.get('tip_amount')} + Service:{merged_info.get('service_charge_amount')} - Discount:{merged_info.get('discount_amount')}"
                    
                    curr_msg = data.get('validation_message') or exp_data.get('validation_message') or ""
                    if trace not in curr_msg:
                        data['validation_message'] = curr_msg + trace
                else:
                    # HEURISTIC MATCH! Force clear ALL warnings.
                    data['validation_message'] = "[BACKEND_VERIFIED] Heuristic match found."
                    data['validation_status'] = "pass"
                
                if data.get('subtotal_amount') == 0:
                    data['subtotal_amount'] = data['amount']
            else:
                data['amount'] = computed_total
                data['validation_message'] = "[BACKEND_VERIFIED] Fallback to computed total."
                data['validation_status'] = "pass"

        supabase.table("expenses").update(data).eq("id", expense_id).execute()
        return {"status": "success"}
    except Exception as e:
        print(f"❌ Update Expense Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: str, 
    user_id: str = Depends(get_verified_user),
    supabase=Depends(get_supabase)
):
    """刪除費用記錄"""
    try:
        exp_res = supabase.table("expenses").select("created_by").eq("id", expense_id).execute()
        if exp_res.data and user_id and str(exp_res.data[0]['created_by']) != user_id:
             raise HTTPException(status_code=403, detail="您只能刪除自己建立的費用")

        supabase.table("expenses").delete().eq("id", expense_id).execute()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
