"""
AI Router (V23.1 Standard)
---------------------------
Handles AI-driven workflows for receipt parsing, financial actuary, and trip generation.
Optimized for toolchain stability and financial nomenclature.
"""

import json
import asyncio
import base64
import uuid
import httpx
import io
from PIL import Image
try:
    from backend.utils.url_safety import is_safe_url
except ImportError:
    from utils.url_safety import is_safe_url
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

from google import genai
from google.genai import types
from fastapi import APIRouter, Depends, HTTPException, Request
from utils.limiter import limiter

from models.base import (
    MarkdownImportRequest, 
    GenerateTripRequest, 
    SimplePromptRequest,
    ReceiptRequest,
    ActuaryRequest
)
from utils.deps import get_gemini_key, get_verified_user, get_supabase
from services.model_manager import call_extraction, call_with_fallback

router = APIRouter(prefix="/api/ai", tags=["ai"])

# --- Security & Defensive Constants ---
ALLOWED_IMAGE_DOMAINS = ["*"] # Effectively allow all, but safe_download_image still checks IP
MAX_IMAGE_SIZE = 20 * 1024 * 1024  # 20MB
ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/tiff", "application/pdf"] # Added TIFF/PDF support

async def safe_download_image(url: str) -> tuple[bytes, str]:
    """
    Safely download image with SSRF protection and granular timeouts.
    Returns (bytes, mime_type).
    """
    # 1. SSRF Check (Robust centralized validation)
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    
    # Exceptions for local dev (if URL is explicitly localhost)
    if domain in ["localhost", "127.0.0.1"]:
        # Allow internal fetches only in dev mode if explicitly requested
        pass 
    elif not is_safe_url(url):
        print(f"⚠️ [SSRF Block] Blocked attempt to fetch from unsafe URL: {url}")
        raise HTTPException(status_code=400, detail="Forbidden image source domain (internal network or unsafe)")

    # 2. Granular Timeouts
    timeout = httpx.Timeout(5.0, connect=5.0, read=20.0, write=10.0, pool=5.0)
    
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            # First check size with HEAD if possible
            # head = await client.head(url)
            # if int(head.headers.get("Content-Length", 0)) > MAX_IMAGE_SIZE:
            #     raise HTTPException(status_code=400, detail="Image too large (>5MB)")
            
            response = await client.get(url)
            response.raise_for_status()
            
            # 3. Post-download Validation
            content_type = response.headers.get("Content-Type", "").lower()
            if not any(m in content_type for m in ALLOWED_MIME_TYPES) and not url.lower().endswith(('.heic', '.heif')):
                # Some servers might not return correct HEIC mime
                if not content_type: content_type = "image/jpeg" # Fallback guess
                else: raise HTTPException(status_code=400, detail=f"Unsupported format: {content_type}")
            
            data = response.content
            if len(data) > MAX_IMAGE_SIZE:
                 raise HTTPException(status_code=400, detail="Image too large (>5MB)")
            
            return data, content_type
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Image download timeout")
    except Exception as e:
        print(f"❌ [SafeDownload] Failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch image: {str(e)}")

def convert_heic_to_jpeg(data: bytes) -> bytes:
    """Fallback: Convert HEIC/HEIF to JPEG using Pillow."""
    try:
        img = Image.open(io.BytesIO(data))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=90)
        return out.getvalue()
    except Exception as e:
        print(f"⚠️ [HEIC Fallback] Conversion failed: {e}")
        return data # Return original if conversion fails


def fix_sub_items_structure(data: dict) -> dict:
    """🛡️ v7.1 結構補償器：確保 sub_items 具備完整欄位，杜絕前端渲染崩潰"""
    items = data.get("items")
    if not isinstance(items, list):
        return data
        
    for item in items:
        # 1. 處理 sub_items
        sub_items = item.get("sub_items")
        if not isinstance(sub_items, list):
            item["sub_items"] = []
        else:
            for sub in sub_items:
                if isinstance(sub, dict):
                    if "checked" not in sub:
                         sub["checked"] = False
                    if not sub.get("name"):
                         sub["name"] = "Untitled Action"
        
        # 2. 核心欄位補強
        if "is_highlight" not in item:
            item["is_highlight"] = False
        item["place_name"] = item.get("place_name") or "Unknown Place"
        item["category"] = item.get("category") or "sightseeing"
        
    return data
    
def reconstruct_metadata(data: dict) -> dict:
    """
    🔄 Pivot Gemini-Safe array structure back into flat Dictionary format.
    
    Structure Transformation:
    FROM: "day_metadata": [{"day_number": 1, "notes": [...], "costs": [...], "tickets": [...]}]
    TO:   "day_notes": {"1": [...]}, "day_costs": {"1": [...]}, "day_tickets": {"1": [...]}
    """
    metadata = data.get("day_metadata", [])
    if not isinstance(metadata, list):
        return data
        
    day_notes = {}
    day_costs = {}
    day_tickets = {}
    
    for entry in metadata:
        if not isinstance(entry, dict):
            continue
        day_key = str(entry.get("day_number", 1))
        
        if entry.get("notes") and isinstance(entry["notes"], list):
            day_notes[day_key] = entry["notes"]
        if entry.get("costs") and isinstance(entry["costs"], list):
            day_costs[day_key] = entry["costs"]
        if entry.get("tickets") and isinstance(entry["tickets"], list):
            day_tickets[day_key] = entry["tickets"]
            
    data["day_notes"] = day_notes
    data["day_costs"] = day_costs
    data["day_tickets"] = day_tickets
    
    # Cleanup to save bandwidth/storage
    if "day_metadata" in data:
        del data["day_metadata"]
        
    return data


# --- World-Class Itinerary Engine (V26.1) ---

@router.post("/parse-md")
@limiter.limit("10/minute")
async def parse_markdown(
    request: Request,
    body: MarkdownImportRequest,
    api_key: str = Depends(get_gemini_key)
):
    """[Itinerary] World-Class Markdown-to-JSON Parser with CoT Reasoning"""
    try:
        from services.model_manager import call_extraction
        
        prompt = f"""你是 Ryan，一位專業且極其細心的旅遊數據分析師。今日日期為 2026-03-15。
        任務：將提供的 Markdown 內容【完整、逐項】地解析為結構化 JSON 行程。
        
        ### 高保真提取指令 (v28.2 Zero-Loss):
        1. **字面提取 (Literal Extraction)**：嚴格根據待解析文本中的行程表進行提取。每一行時間、地點都必須對應一個 JSON item。嚴禁合併或省略景點。
        2. **表格優先 (Tabular Priority)**：優先從 Markdown 的表格 (`| 時間 | 📍 地點 | ... |`) 中提取資料。表格中的每一列都必須轉化為一個項目。
        3. **特殊列處理 (Transit/Flight Recovery)**：
           - 若「地點」欄位為空、"-" 或包含 "出發/抵達"，請從「Google Maps」欄位的連結文字或「筆記」欄位中提取地點名稱。
           - 若有多個地點（如：桃園機場 -> 成田機場），請建立為兩個連續的項目或在 `place_name` 中完整保留。
        4. **中繼資料全量擷取**：
           - **注意事項 (day_notes)**：從 `### Day X 注意事項` 或類似表格中提取。格式為 `{{"item": "...", "content": "..."}}`。
           - **預估花費 (day_costs)**：從 `💰 Day X 預估花費` 表格中提取。格式為 `{{"item": "...", "amount": "..."}}`。
           - **交通票券 (day_tickets)**：從 `🎫 Day X 交通票券` 列表或表格中提取。格式為 `{{"name": "...", "price": "..."}}`。
        5. **日期感應 (Date Awareness)**：從各天的標題（如 `Day 1 (2/2)`）中提取日期。
           - 基準年份暫定為 2026 年（除非內容有明確提到其他年份）。
           - 輸出的 `start_date` 應為 Day 1 的日期，`end_date` 為最後一天的日期。格式：`YYYY-MM-DD`。
        6. **網址提取 (URL Extraction)**：若表格中有「Google Maps」或類似連結欄位，請優先提取網址並存入 `link_url`（主地點連結）。
        7. **多重連結處理 (Multi-Link Recovery)**：
           - 若段落中出現針對某行程項目的「補充列表」或「推薦清單」（如：多間超市推薦、訂位連結清單），請將其轉換為該項目的 `sub_items`。
           - 每個 `sub_item` 必須包含 `name`, `desc`, `link` (URL)。
        8. **自動檢偏 (Self-Correction)**：若檢測到 10 個以上的時間標點，但輸出的 items 少於 10 個，則視為失敗，請重新生成。

        ### JSON 結構要求:
        {{
            "title": "行程標題",
            "start_date": "YYYY-MM-DD",
            "end_date": "YYYY-MM-DD",
            "items": [
                {{
                    "day_number": 1,
                    "time_slot": "HH:MM",
                    "place_name": "搜尋優化後的地點全名",
                    "original_name": "原文名稱",
                    "category": "food",
                    "desc": "以專業導遊角度提供的在地洞察，嚴禁醫療建議",
                    "tags": ["必吃", "米其林"],
                    "sub_items": [
                        {{ "name": "🥇 まいばすけっと", "checked": false, "desc": "07:00-23:00 | 出站直達", "link": "https://www.google.com/maps/..." }},
                        {{ "name": "🥈 スーパーイズミ", "checked": false, "desc": "09:00-21:00 | 昭和激安", "link": "https://www.google.com/maps/..." }}
                    ],
                    "link_url": "https://www.google.com/maps/...",
                    "is_highlight": false
                }}
            ],
            "day_metadata": [
                {{
                    "day_number": 1,
                    "notes": [{{ "item": "標題", "content": "內容" }}],
                    "costs": [{{ "item": "項目", "amount": "金額" }}],
                    "tickets": [{{ "name": "票券名", "price": "價格" }}]
                }}
            ],
            "ai_review": "以專業旅遊數據分析師身分提供的行程優化分析，嚴禁任何藥師、醫療或健康叮嚀用語。"
        }}
        
        CRITICAL: 輸出必須是純 JSON，不得包含 Markdown 標記，嚴禁 items 為空。
        
        待解析文本:
        {body.markdown_text}
        """
        
        raw_text = await call_extraction(api_key, prompt, intent_type="PLANNING")
        cleaned_text = raw_text.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned_text)
        data = reconstruct_metadata(data)
        data = fix_sub_items_structure(data)
        
        # 🛡️ NaN/Null Guard: 確保 items 絕對不為空
        if not data.get("items"):
            print("⚠️ [AI Parser] Empty items detected, attempting emergency recovery...")
            # 如果 AI 回傳的天數結構不對，嘗試修復 (前端及後端存檔期望扁平的 items 陣列)
            if "days" in data:
                flat_items = []
                for d in data["days"]:
                    dn = d.get("day_number") or d.get("day") or 1
                    for act in d.get("activities", []):
                        act["day_number"] = dn
                        # 型別校正
                        act["place_name"] = act.get("place_name") or act.get("place") or "Unknown"
                        act["time_slot"] = act.get("time_slot") or act.get("time") or "00:00"
                        flat_items.append(act)
                data["items"] = flat_items

        return data

    except Exception as e:
        print(f"🔥 [Parser Error] {e}")
        raise HTTPException(status_code=500, detail=f"Itinerary Parser Error: {str(e)}")

@router.post("/generate-trip")
@limiter.limit("5/minute")
async def generate_trip(
    request: Request,
    body: SimplePromptRequest,
    api_key: str = Depends(get_gemini_key)
):
    """[Itinerary] World-Class Itinerary Generator with Ryan's Soul"""
    try:
        from services.model_manager import call_extraction
        
        # 🆕 v28.8 Ultra-Precision (Nested Enforcement)
        prompt = f"""你是 Ryan，一位專業、有效率且對當地極其熟悉的在地嚮導。
        
        ### 思考指令 (Thinking Instruction):
        目前已開啟 [Thinking: High] 模式。在輸出 JSON 之前，請先在思考區塊內進行「時光脊椎模擬」。
        務必確認每一天的行程從 08:00 開始到 22:00 結束。
        
        任務：為使用者規劃方案。需求：{body.prompt}

        ### 世界級規劃核心指令 (v28.8 - Physical Density):
        1. **強制高密度 (Mandatory 6-10 Items per day)**: 
           - 每一天必須產出 6-10 個行程點。
           - 嚴禁跳過任何時段。若景點間行程較長，請務必排入具體的交通說明或中繼休息點。
        2. **時間流對齊**: 從早餐 (08:30) 開始，直到夜間活動 (21:00+) 結束。
        3. **專業標題與描述**: 
           - 標題應簡潔有力。排除藥師(💊)人設噪聲。
           - `desc` 應像專業嚮導般提供歷史背景、排隊攻略、點餐建議或最佳拍照角度。
        4. **禁止裝飾**: 嚴禁在輸出內容中使用藥品圖示 (💊) 或非旅遊相關符號。

        ### 輸出格式範例 (Strict JSON - Nested Day Structure):
        {{
            "title": "行程名稱",
            "days": [
                {{
                    "day_number": 1,
                    "activities": [
                        {{ "time": "08:30", "place_name": "築地市場 (早餐)", "category": "food", "desc": "建議 08:00 前抵達避免排隊。", "tags": ["在地美食"], "is_highlight": true }},
                        {{ "time": "10:30", "place_name": "淺草寺", "category": "sightseeing", "desc": "東京最古老寺廟，歷史悠久。", "tags": ["地標"], "is_highlight": false }},
                        {{ "time": "12:30", "place_name": "淺草今半 (午餐)", "category": "food", "desc": "百年壽喜燒老店，性價比極高。", "tags": ["必吃"], "is_highlight": false }},
                        {{ "time": "14:30", "place_name": "上野公園", "category": "sightseeing", "desc": "散步享受寧靜氛圍與藝術館。", "tags": ["風景"], "is_highlight": false }},
                        {{ "time": "17:00", "place_name": "秋葉原萬世橋", "category": "shopping", "desc": "古老紅磚建築改裝的特色文創區。", "tags": ["逛街"], "is_highlight": false }},
                        {{ "time": "19:30", "place_name": "六本木之丘", "category": "nightlife", "desc": "俯瞰東京鐵塔的最佳位置。", "tags": ["夜景", "浪漫"], "is_highlight": true }}
                    ]
                }}
            ],
            "day_metadata": [
                {{ "day_number": 1, "notes": [], "costs": [], "tickets": [] }}
            ],
            "ai_review": "給旅行者的專業行前建議..."
        }}

        語言：全繁體中文。
        """

        
        raw_text = await call_extraction(api_key, prompt, intent_type="PLANNING")
        cleaned_text = raw_text.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned_text)
        
        # 🛡️ v28.9 Flattening Bridge (Unpack Nested Activities to Flat Items)
        if "days" in data and isinstance(data["days"], list):
            flat_items = []
            for day_entry in data["days"]:
                d_num = day_entry.get("day_number", 1)
                acts = day_entry.get("activities", [])
                for a in acts:
                    a["day_number"] = d_num
                    if "time" in a:
                        a["time_slot"] = a["time"] # Front-end compatibility
                    if "desc" in a and len(a["desc"]) > 60:
                        a["desc"] = a["desc"][:57] + "..."
                    flat_items.append(a)
            data["items"] = flat_items
        
        data = reconstruct_metadata(data)
        data = fix_sub_items_structure(data)
        
        # 🆕 v26.1: Wrap with status for Frontend Zod Schema
        return {
            "status": "success",
            "data": data
        }

    except Exception as e:
        print(f"🔥 [Generator Error] {e}")
        raise HTTPException(status_code=500, detail=f"Itinerary Generator Error: {str(e)}")

@router.post("/parse-receipt")
@limiter.limit("5/minute")
async def parse_receipt(
    request: Request,
    body: ReceiptRequest,
    api_key: str = Depends(get_gemini_key)
):
    """[Receipt] AI Receipt Extraction with SSRF Protection & HEIC Fallback"""
    try:
        # 🆕 Enhanced Prompt (V23.1)
        prompt = """Extract receipt data as JSON. 
        CRITICAL: Translate all 'translated_name' fields into Traditional Chinese (繁體中文). 
        Maintain the 'original_name' exactly as printed on the receipt.

        Do NOT hallucinate data. If the image is unclear or not a receipt, 
        return status="warning" in the diagnostics field and set all amounts to 0.0.
        
        CRITICAL: Numbers like credit card last 4 digits (e.g., '1106'), phone numbers, or transaction IDs must NEVER be used as financial amounts.
        Only extract numbers that represent actual prices, taxes, totals, or explicitly labeled discounts/coupons.
        
        Nomenclature/Structure: 
        {
          "title": "Store Name",
          "expense_date": "YYYY-MM-DD",
          "currency": "JPY/TWD/etc",
          "subtotal_amount": 0.0,  # Sum of individual item amounts EXCLUDING the tax/discount items.
          "tax_amount": 0.0,       # ALWAYS set to 0.0 if including Tax as a line item.
          "tip_amount": 0.0,
          "service_charge_amount": 0.0,
          "discount_amount": 0.0,  # ALWAYS set to 0.0 if including Discount as a line item.
          "total_amount": 0.0,     # Final amount paid. Should equal sum of all amounts in "items".
          "items": [
            {"original_name": "...", "translated_name": "...", "amount": 0.0}
            # SPECIAL: Include Tax and Discount as items here. 
            # Examples: {"original_name": "TAX", "translated_name": "[稅額]", "amount": 203.0}
            # Examples: {"original_name": "DISCOUNT", "translated_name": "[折扣]", "amount": -1296.0} (use negative for discounts)
          ],
          "notes": "...",
          "diagnostics": {"status": "pass/warning", "message": "..."}
        }
        IMPORTANT: No 'details' field allowed. Use only 'items'.
        CRITICAL: If you include Tax or Discount in 'items', do NOT include them in 'tax_amount' or 'discount_amount' root fields.
        CRITICAL: Output numbers as digits ONLY. NO commas or currency symbols in any 'amount' fields.
        """
        
        parts = [prompt]
        mime_type = body.mime_type or "image/jpeg"
        image_bytes = None

        # 1. Source Determination
        if body.image:
            # Base64 path
            img_data = body.image.split(",")[1] if "," in body.image else body.image
            image_bytes = base64.b64decode(img_data)
        elif body.imageUrl:
            # Remote URL path (Safe Download)
            image_bytes, mime_type = await safe_download_image(body.imageUrl)
        else:
            raise HTTPException(status_code=400, detail="Missing source")

        # 2. HEIC Handling & Extraction Attempt
        is_heic = "heic" in mime_type or "heif" in mime_type
        
        try:
            current_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            raw_text = await call_extraction(api_key, parts + [current_part], intent_type="EXTRACTION")
        except Exception as e:
            # Fallback for HEIC if first attempt fails
            if is_heic:
                print("🔄 [HEIC Fallback] Retrying with JPEG conversion...")
                jpeg_bytes = convert_heic_to_jpeg(image_bytes)
                current_part = types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg")
                raw_text = await call_extraction(api_key, parts + [current_part], intent_type="EXTRACTION")
            else:
                raise e

        # 3. Processing & Normalization
        data = json.loads(raw_text)
        
        # Breakdown normalization
        breakdowns = ["subtotal_amount", "tax_amount", "tip_amount", "service_charge_amount", "discount_amount"]
        for b in breakdowns:
            if b not in data or data[b] is None:
                data[b] = 0.0
        
        if "details" in data:
            if not data.get("items"):
                data["items"] = data["details"]
            del data["details"]
            
        # Items normalization
        for item in data.get("items", []):
            if "original_name" not in item: item["original_name"] = "Unknown"
            if "translated_name" not in item: item["translated_name"] = item.get("original_name", "")
            if "amount" not in item: item["amount"] = 0.0

        # V23.2 Defensive: If Tax/Discount is in items, root fields MUST be 0
        has_tax_item = any("[稅額]" in str(i.get("translated_name", "")) or "[Tax]" in str(i.get("translated_name", "")) for i in data.get("items", []))
        has_discount_item = any("[折扣]" in str(i.get("translated_name", "")) or "[Discount]" in str(i.get("translated_name", "")) for i in data.get("items", []))
        
        if has_tax_item: data["tax_amount"] = 0.0
        if has_discount_item: data["discount_amount"] = 0.0

        # V23.1 Diagnostic Logic (Threshold: >= 50 JPY OR > 3%)
        items_sum = sum(float(i.get("amount", 0.0)) for i in data.get("items", []))
        total = data.get("total_amount", 0.0)
        mismatch = abs(items_sum - total)
        ratio = mismatch / total if total > 0 else 0
        
        status = data.get("diagnostics", {}).get("status", "pass") # Respect AI's warning
        code = ""
        message = ""
        
        if total > 0 and (mismatch >= 49.99 or ratio > 0.03):
            status = "warning"
            code = "amount_mismatch"
            message = f"Mismatch: Items sum ({items_sum:.1f}) != Total ({total:.1f})"
            print(f"[Diagnostics] {message}")
            
        data["diagnostics"] = {
            "status": status,
            "source": "ai",
            "code": code,
            "message": message or data.get("diagnostics", {}).get("message", ""),
            "mismatch_amount": round(mismatch, 2)
        }
        
        return data

    except Exception as e:
        # NOTE: Using English-only error messages as a temporary workaround for
        # Pyre2/Ruff Unicode boundary crashes on Windows during static analysis.
        print(f"[Error] parse_receipt: {e}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trips/{trip_id}/days/{day}/ai-review")
@limiter.limit("5/minute")
async def generate_day_review(
    request: Request,
    trip_id: str,
    day: int,
    api_key: str = Depends(get_gemini_key),
    supabase=Depends(get_supabase)
):
    """🕵️ AI 深度審核：讀取當天所有細節並提供分析"""
    try:
        # 1. 抓取當天所有行程細項 (High-Fidelity Context)
        items_res = supabase.table("itinerary_items")\
            .select("time_slot, place_name, notes, category")\
            .eq("itinerary_id", trip_id)\
            .eq("day_number", day)\
            .order("time_slot")\
            .execute()
        
        activities = items_res.data or []
        if not activities:
            return {"status": "success", "review": "💡 當天尚未安排任何景點藍圖，建議先添加一些行程點，我才能為您進行深度審核。"}

        # 2. 構建高密度上下文 (Context Engineering)
        ctx_lines = [f"- {a['time_slot']} | {a['place_name']} ({a['category']}) | 備註: {a['notes'] or '無'}" for a in activities]
        activity_summary = "\n".join(ctx_lines)

        # 3. 呼叫 AI 進行分析 (Persona: Ryan)
        prompt = f"""你是 Ryan，一位資深旅遊數據分析師與行程架構師。
        任務：對以下 Day {day} 的行程進行『全景式深度審核』。
        
        待審核行程細節：
        {activity_summary}

        ### 審核規範:
        1. **實體流暢度**：景點間的時間分配是否合理？是否會太趕？
        2. **邏輯優化**：有沒有更順路的排法？
        3. **在地洞察**：針對這些類型的地點，給予 1-2 個專業小撇步。
        4. **禁止事項**：嚴禁任何醫療、健康或藥師人設相關用語。
        
        請以繁體中文回答，並使用標頭 [🎯 總評]、[✅ 優點]、[⚠️ 修正建議]、[💡 在地小撇步] 進行格式化。
        """
        
        review_text = await call_extraction(api_key, prompt, intent_type="DIAGNOSIS")

        # 4. 原子化更新資料庫 (Prevent Overwrite)
        # 先讀取最新的 content
        trip_res = supabase.table("itineraries").select("content").eq("id", trip_id).single().execute()
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="找不到行程資料")
            
        content = trip_res.data.get("content") or {}
        if "day_ai_reviews" not in content:
            content["day_ai_reviews"] = {}
            
        content["day_ai_reviews"][str(day)] = review_text
        
        # 寫回更新
        supabase.table("itineraries").update({"content": content}).eq("id", trip_id).execute()
        
        return {
            "status": "success", 
            "day": day,
            "review": review_text
        }

    except Exception as e:
        print(f"🔥 [AI Review Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/trips/{trip_id}/days/{day}/ai-review")
async def clear_day_review(
    request: Request,
    trip_id: str,
    day: int,
    supabase=Depends(get_supabase)
):
    """🗑️ 清除特定天數的 AI 審核報告"""
    try:
        trip_res = supabase.table("itineraries").select("content").eq("id", trip_id).single().execute()
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="找不到行程資料")
            
        content = trip_res.data.get("content") or {}
        reviews = content.get("day_ai_reviews", {})
        
        if str(day) in reviews:
            del reviews[str(day)]
            content["day_ai_reviews"] = reviews
            supabase.table("itineraries").update({"content": content}).eq("id", trip_id).execute()
            
        return {"status": "success", "message": "Review cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/actuary")
@limiter.limit("10/minute")
async def actuary_chat(
    request: Request,
    body: ActuaryRequest,
    api_key: str = Depends(get_gemini_key)
):
    """🤖 AI 精算師對話 (V23.1 Protocol)"""
    try:
        persona = "你是 Ryan，一位專業、理性的旅遊財務顧問（AI Actuary）。你擅長處理複雜的拆帳問題、匯率計算與花費分析。請以精簡、專業且具備幽默感（但不涉及藥師身分）的語氣回答。"
        prompt = f"{persona}\n\nAnalyze travel expenses for {json.dumps(body.members)}. Context: {json.dumps(body.expenses)}. Query: {body.message}"
        
        # Use simple response key to match ActuaryDialogCard schema update
        result = await call_with_fallback(api_key=api_key, history=body.history, message=prompt, intent_type="CHAT")
        return {"status": "success", "response": result["text"]}
    except Exception as e:
        print(f"🔥 [Actuary Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))
