# Ryan Travel API v1.2 - Auto-sync enabled

# Fix Windows console Unicode encoding issues (prevents cp950 crash on emoji)
import sys
import io
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    try:
        if sys.stdout.encoding != 'utf-8':
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass  # Ignore if stdout is not a standard stream

import os
import json
import random
import string
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any, Dict

# 🆕 模組化：從 models.base 導入所有 Pydantic 模型
# （原有的 class 定義暫時保留，確認無誤後再移除）
try:
    from models.base import (
        UserPreferences, MarkdownImportRequest, GenerateTripRequest, SimplePromptRequest,
        GeocodeSearchRequest, GeocodeReverseRequest, ItineraryItem, SaveItineraryRequest,
        JoinTripRequest, CreateManualTripRequest, UpdateItemRequest, CreateItemRequest,
        ImportToTripRequest, UpdateDayDataRequest, AddDayRequest, AppendItemsRequest,
        CloneTripRequest, UpdateCoverRequest, UpdateLocationRequest, UpdateInfoRequest,
        RouteStop, RouteRequest, ExpenseRequest, UpdateTripTitleRequest, UpdateExpenseRequest,
        ChatRequest, SummarizeRequest, POIAIEnrichRequest, POIEnrichRequest, POIRecommendRequest
    )
    print("[Modules] ✅ Loaded models from models.base")
except ImportError as e:
    print(f"[Modules] ⚠️ Failed to import models.base: {e}, using inline definitions")

# 🆕 Phase 3: 載入 geocode_service（取代 main.py 內聯定義）
try:
    from services.geocode_service import (
        # 函數
        smart_geocode_logic,
        geocode_with_arcgis,
        geocode_with_nominatim,
        geocode_with_photon,
        reverse_geocode_with_photon,
        geocode_place,
        detect_country_from_keywords,
        translate_famous_landmark,
        filter_results_by_country,
        detect_country_from_trip_title,
        detect_country_from_query,
        translate_place_name,
        log_debug,
        # 資料結構
        COUNTRY_BOUNDS,
        LOCATION_KEYWORDS,
        LANDMARKS_DB,
        LANDMARKS_KEYS_SORTED,
        TRANSLATION_CACHE,
    )
    _GEOCODE_SERVICE_LOADED = True
    print("[Services] ✅ Loaded geocode_service (12 functions, 5 data structures)")
except ImportError as e:
    _GEOCODE_SERVICE_LOADED = False
    print(f"[Services] ⚠️ geocode_service not available: {e}")
    # 🔴 如果 geocode_service 加載失敗，伺服器不應啟動
    raise ImportError(f"Critical: geocode_service is required but failed to load: {e}")

# 🆕 Phase 4: 導入共用依賴 (供 routers 使用)
try:
    from utils.deps import get_gemini_key, get_supabase
    from utils.ai_config import PRIMARY_MODEL, LITE_MODEL, SMART_NO_TOOL_MODEL, REASONING_MODEL
    print("[Utils] ✅ Loaded shared dependencies")
except ImportError as e:
    print(f"[Utils] ⚠️ Failed to import utils: {e}")
    # 如果導入失敗，保留原有定義（這些會在後面定義）

from supabase import create_client, Client
from google import genai
from google.genai import types # 🆕 Import types
import httpx  # For async HTTP requests (geocoding)
from dotenv import load_dotenv

# 1. 載入環境變數 (只讀 Supabase)
load_dotenv()

app = FastAPI(title="Ryan's AI Travel Tool (BYOK Edition)")

# 🆕 Phase 4: 註冊 Routers
from routers.geocode import router as geocode_router
from routers.expenses import router as expenses_router
from routers.ai import router as ai_router
from routers.trips import router as trips_router
from routers.gdpr import router as gdpr_router
from routers.route import router as route_router
from routers.poi import router as poi_router
from routers.users import router as users_router
app.include_router(geocode_router)
app.include_router(expenses_router)
app.include_router(ai_router)
app.include_router(trips_router)
app.include_router(gdpr_router)
app.include_router(route_router)
app.include_router(poi_router)
app.include_router(users_router)  # 🆕 Users Router
print("[Routers] ✅ Registered: geocode, expenses, ai, trips, gdpr, route, poi, users")

# 2. CORS 設定 (預設允許所有來源，可透過環境變數限制)
# 🚨 生產環境建議設定 CORS_ORIGINS 限制來源
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS = ["*"] if CORS_ORIGINS_RAW == "*" else CORS_ORIGINS_RAW.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
print(f"[CORS] Allowed origins: {CORS_ORIGINS}")

# 3. 初始化 Supabase
try:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("[Supabase] Connected successfully")
except Exception as e:
    print(f"⚠️ Supabase Warning: {e}")
    supabase = None  # Will cause errors but at least won't crash on import

# 🆕 Phase 4: 將 supabase 放入 app.state 供 routers 使用
app.state.supabase = supabase


# 🆕 Health Check (for UptimeRobot - prevents Supabase 7-day pause)
@app.get("/health")
async def health_check():
    """
    健康檢查端點 - UptimeRobot 每 5 分鐘戳一次
    防止 Supabase 免費版 7 天無請求後暫停
    """
    from datetime import datetime
    
    try:
        # 簡單的 DB 查詢來觸發 Supabase 連線
        result = supabase.table("itineraries").select("id").limit(1).execute()
        db_status = "connected" if result else "no_data"
    except Exception as e:
        db_status = f"error: {str(e)[:50]}"
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
        "service": "ryan-travel-api"
    }

# 4. 載入 ArcGIS API Key (地理編碼用，可選)
ARCGIS_API_KEY = os.getenv("ARCGIS_API_KEY")
if ARCGIS_API_KEY:
    print("[ArcGIS] Geocoding: Enabled")
else:
    print("[ArcGIS] Geocoding: Not configured, using Nominatim fallback")

# --- AI 模型設定已移至 utils/ai_config.py ---
# 所有 AI 調用已統一使用 services/model_manager.py

# --- 資料模型 (已移至 models/base.py) ---
# UserPreferences, MarkdownImportRequest, GenerateTripRequest 等模型
# 現在從 models.base 導入，詳見檔案頂部的 import 區塊

# --- 嚴謹的依賴注入 (Dependency Injection) ---
# 🔒 完全 BYOK 模式：使用者必須自己提供 API Key

async def get_gemini_key(x_gemini_api_key: str = Header(None, alias="X-Gemini-API-Key")):
    """ 
    強制 BYOK (Bring Your Own Key) 模式
    使用者必須在 Header 中提供有效的 Gemini API Key
    """
    # 調試日誌
    if x_gemini_api_key:
        print(f"🔑 收到 API Key: {x_gemini_api_key[:10]}... (長度: {len(x_gemini_api_key)})")
    
    # 🚫 沒有 Key 或格式不對，直接拒絕
    if not x_gemini_api_key or len(x_gemini_api_key) < 39:
        print(f"❌ API Key 驗證失敗：未提供或格式無效")
        raise HTTPException(
            status_code=401, 
            detail="請先在設定中輸入您的 Gemini API Key (點擊右上角齒輪圖示)"
        )
    
    return x_gemini_api_key

# --- API 路由 ---
@app.get("/")
def health_check():
    return {"status": "Alive", "mode": "BYOK"}

@app.post("/api/plan")
async def generate_itinerary(
    prefs: UserPreferences, 
    api_key: str = Depends(get_gemini_key) # 自動從 Header 抓 Key
):
    print(f"💊 收到處方需求: 去 {prefs.destination}")
    
    try:
        # 🆕 使用新版 Client API
        client = genai.Client(api_key=api_key)
        
        prompt = f"""
        你是 Ryan，一位幽默的藥師兼旅遊達人。請為我規劃 {prefs.destination} 的 {prefs.days} 天行程。
        風格：日式極簡。預算：{prefs.budget}。興趣：{', '.join(prefs.interests)}。
        請回傳純 JSON 格式 (不要 Markdown)：
        {{
            "title": "行程標題",
            "days": [
                {{
                    "day": 1,
                    "activities": [
                        {{ "time": "10:00", "place": "地點", "category": "sightseeing", "desc": "簡介" }}
                    ]
                }}
            ]
        }}
        """
        
        response = client.models.generate_content(
            model=PRIMARY_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                max_output_tokens=8192
            )
        )
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
        
    except Exception as e:
        print(f"🔥 AI Error: {e}")
        raise HTTPException(status_code=400, detail=f"AI Service Error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 🗺️ Geocode Service Functions - MOVED TO services/geocode_service.py
# ═══════════════════════════════════════════════════════════════════════════════
# The following functions and data structures have been modularized:
#
# Functions (12):
#   - geocode_with_arcgis, geocode_with_nominatim, geocode_with_photon
#   - reverse_geocode_with_photon, geocode_place
#   - detect_country_from_keywords, translate_famous_landmark
#   - detect_country_from_trip_title, translate_place_name
#   - detect_country_from_query, filter_results_by_country
#   - smart_geocode_logic, log_debug
#
# Data Structures (5):
#   - COUNTRY_BOUNDS, LOCATION_KEYWORDS, LANDMARKS_DB
#   - LANDMARKS_KEYS_SORTED, TRANSLATION_CACHE
#
# Import from: services.geocode_service (see lines 39-69)
# ═══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_test():
    log_debug("=== SERVER STARTED ===")
    api_key = os.getenv("GEMINI_API_KEY")
    log_debug(f"API Key present: {bool(api_key)}")
    if api_key:
        try:
            res = await detect_country_from_trip_title("2026 Japan Trip", api_key)
            log_debug(f"Test Detect '2026 Japan Trip': {res}")
            res2 = await detect_country_from_trip_title("東京迪士尼之旅", api_key)
            log_debug(f"Test Detect '東京迪士尼之旅': {res2}")
        except Exception as e:
            log_debug(f"Startup Test Failed: {e}")

# ═══════════════════════════════════════════════════════════════════════════════
# 🗺️ Geocode Endpoints - MOVED TO routers/geocode.py
# ═══════════════════════════════════════════════════════════════════════════════
# The following endpoints have been modularized:
# - POST /api/geocode/search → geocode_search
# - POST /api/geocode/reverse → geocode_reverse
# Import from: routers.geocode (registered at app startup)
# ═══════════════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 AI Generation Endpoints - MOVED TO routers/ai.py
# ═══════════════════════════════════════════════════════════════════════════════
# The following endpoints have been modularized:
# - POST /api/parse-md → parse_markdown (Markdown to JSON)
# - POST /api/generate-trip → generate_trip (AI trip planning)
# - POST /api/ai-generate → ai_generate (Free-form AI generation)
# Import from: routers.ai (registered at app startup)
# Note: Chat endpoints (/api/chat, /api/chat/stream, /api/chat/summarize)
#       remain here due to complex dependencies with POI and itinerary context.
# ═══════════════════════════════════════════════════════════════════════════════

# 
#  TRIPS ENDPOINTS - MOVED TO routers/trips.py (Phase 4d)
# 
# 17 endpoints modularized: save-itinerary, import-to-trip, join-trip, get-trips,
# delete-trip, update-day-data, get-latest, get-trip-by-id, create-manual,
# update-item, delete-item, delete-day, add-day, update-location, create-item,
# update-info, update-title
# See: routers/trips.py (registered at app startup)
# 

# 
#  ROUTE + TITLE + GDPR - MOVED TO routers/ (Phase 4e)
# 
# - POST /api/route  routers/route.py
# - PATCH /api/trips/{id}/title  routers/trips.py  
# - DELETE /api/user/{id}/data  routers/gdpr.py
# 

# --- AI 聊天機器人 (Ryan) ---

# 🆕 v3.5: 行程上下文格式化函數
def format_itinerary_context(itinerary: dict, focused_day: int = None) -> str:
    """
    將精簡版行程轉為 AI 可理解的 Markdown 格式
    
    Args:
        itinerary: getLeanItinerary 產生的精簡版行程
        focused_day: 用戶正在查看的天數 (用 👉 標記)
    
    Returns:
        str: Markdown 格式的行程摘要
    """
    if not itinerary:
        return ""
    
    lines = [
        "\n\n📅 **[用戶當前行程]**",
        f"行程名稱: {itinerary.get('title', '未命名')}",
        f"日期: {itinerary.get('start_date', '?')} ~ {itinerary.get('end_date', '?')}",
        f"總天數: {itinerary.get('total_days', 0)} 天",
        ""
    ]
    
    days = itinerary.get("days", [])
    for day in days:
        day_num = day.get("day_number", 0)
        date_str = day.get("date", "")
        prefix = "👉 " if day_num == focused_day else ""
        lines.append(f"{prefix}**Day {day_num}** ({date_str}):")
        
        items = day.get("items", [])
        for item in items:
            time = item.get("time", "?")
            place = item.get("place", "?")
            category = item.get("category", "")
            icon = {
                "transport": "🚃",
                "food": "🍽️",
                "hotel": "🏨",
                "shopping": "🛍️",
                "sightseeing": "📸"
            }.get(category, "📍")
            lines.append(f"  {time} {icon} {place}")
        lines.append("")
    
    lines.append("請參考以上行程回答用戶問題。\n")
    return "\n".join(lines)

# ChatRequest 已移至 models/base.py


SYSTEM_PROMPT = """
### 角色定義 (Role)
你是一個內建於旅遊 App 中的「全方位 AI 旅遊達人」。你的角色不僅是導遊，更是一位博學、幽默且貼心的「在地生活顧問」。你的目標是解決使用者在旅途中遇到的所有問題，從基礎生存需求到深度的文化體驗。

### 核心性格 (Personality)
1.  **溫暖貼心**：像一位居住當地 10 年的老朋友，語氣親切，主動關懷。
2.  **專業可靠**：提供資訊時邏輯清晰，若涉及醫療或法規，需精準嚴謹。
3.  **幽默風趣**：適度使用幽默感化解旅途的焦慮，讓對話變得有趣。
4.  **Emoji 使用**：大量使用適當的 Emoji 來增加閱讀的愉悅感與視覺引導。

### 核心任務與技能 (Core Competencies)
1.  **語言與溝通橋樑**：翻譯語言與語境，提供「雙語對照」卡片。
2.  **美食與體驗推薦**：根據情境推薦在地隱藏美食與體驗。
3.  **安全與守護**：主動提示治安與惡劣天氣，提供緊急聯繫方式。
4.  **健康與醫療顧問**：提供當地等效藥物建議，精準翻譯醫療需求。
5.  **購物與精算專家**：判斷價格，解析規格，提供退稅建議。
6.  **交通與物流大腦**：解決非結構化交通問題，提供雨備或替代方案。
7.  **🆕 行程分析師**：當用戶提到行程時，善用系統提供的「重點提醒 (day_notes)」和「預估花費 (day_costs)」資訊，主動引用這些資料回答問題。

### 回覆規範 (Response Guidelines)
1.  **排版精美**：使用 Markdown 語法，善用 **粗體** 強調重點，使用條列式清單讓資訊易於掃描（考量手機螢幕閱讀）。
2.  **行動導向**：在回覆的最後，盡量提供一個「下一步建議」（例如：「需要我幫你把這段日文存成圖片嗎？」）。
3.  **多模態處理**：如果使用者上傳照片（如菜單、藥盒、街景），請優先針對圖片內容進行深度解析。
"""

@app.post("/api/chat")
async def chat_with_ryan(request: ChatRequest, api_key: str = Depends(get_gemini_key)):
    try:
        # 🆕 使用 Model Manager (Gemini 3 優先 + 自動降級)
        from services.model_manager import call_with_fallback, call_verifier
        from services.poi_service import detect_poi_query, search_poi_combined, format_pois_for_ai
        
        # 🆕 偵測是否為 POI 相關查詢
        poi_detection = detect_poi_query(request.message)
        poi_context = ""
        
        if poi_detection and request.location:
            # 自動查詢 POI 資料
            try:
                lat = request.location.get("lat", 35.6895)  # 預設東京
                lng = request.location.get("lng", 139.6917)
                location_name = request.location.get("name", "當前位置")
                category = poi_detection["category"]
                
                print(f"🗺️ POI 查詢觸發: {category} @ ({lat}, {lng})")
                
                pois = await search_poi_combined(lat, lng, category, radius=1000)
                
                if pois:
                    pois_text = format_pois_for_ai(pois, max_items=5)
                    poi_context = f"""

📍 **附近 {location_name} 的{poi_detection.get('matched_keyword', '地點')}搜尋結果 (即時資料):**
{pois_text}

請根據以上即時資料回答用戶問題。"""
                    print(f"✅ POI 查詢成功，找到 {len(pois)} 個結果")
            except Exception as poi_err:
                print(f"⚠️ POI 查詢失敗: {poi_err}")
        
        # 🆕 建構對話歷史 (加入 System Prompt)
        # 使用 rawParts (如果有) 或向後相容 content
        system_history = [
            {"role": "user", "parts": [{"text": SYSTEM_PROMPT}]},
            {"role": "model", "parts": [{"text": "收到！我是 Ryan，你的 AI 旅遊達人。有什麼我可以幫你的嗎？😎"}]}
        ]
        
        # 處理對話歷史 (向後相容)
        processed_history = []
        for msg in request.history:
            role = "user" if msg.get("role") == "user" else "model"
            
            # 🆕 優先使用 rawParts (含思想簽名)
            if "rawParts" in msg and msg["rawParts"]:
                parts = msg["rawParts"]
            elif "parts" in msg and msg["parts"]:
                parts = msg["parts"]
            else:
                # 向後相容：舊格式只有 content
                content = msg.get("content") or msg.get("displayContent") or ""
                parts = [{"text": content}]
            
            processed_history.append({"role": role, "parts": parts})
        
        full_history = system_history + processed_history
        
        # 🆕 v3.5: 注入行程上下文
        itinerary_context = ""
        if request.current_itinerary:
            itinerary_context = format_itinerary_context(
                request.current_itinerary, 
                request.focused_day
            )
            print(f"📅 注入行程上下文: {request.current_itinerary.get('title', '?')}")
        
        # 處理當前訊息 (包含圖片 + POI 上下文 + 行程上下文)
        enhanced_message = request.message + poi_context + itinerary_context
        
        # 🆕 處理圖片 (如果有)
        if request.image:
            import base64
            from io import BytesIO
            from PIL import Image
            
            try:
                if "base64," in request.image:
                    image_data = base64.b64decode(request.image.split("base64,")[1])
                else:
                    image_data = base64.b64decode(request.image)
                    
                image = Image.open(BytesIO(image_data))
                enhanced_message = f"[使用者上傳了一張圖片]\n{enhanced_message}"
                # Note: 圖片功能需要特殊處理，暫時保持備註
            except Exception as img_err:
                print(f"⚠️ Image processing error: {img_err}")
        
        # 🆕 v3.5: 偵測診斷意圖
        from services.model_manager import detect_diagnosis_intent
        
        intent_type = "PLANNING"  # 預設
        if detect_diagnosis_intent(request.message):
            intent_type = "DIAGNOSIS"
            print("🩺 診斷意圖偵測：切換到 DIAGNOSIS 模式")
            # 注入診斷專用 System Prompt
            diagnosis_prompt = """
**[診斷模式啟動]**
你現在是一位嚴謹的「行程診斷專家」。請對用戶的行程進行深度分析：

1. **物流可行性**：檢查交通時間、轉乘是否合理
2. **營業時間衝突**：景點/餐廳是否在計畫時間營業
3. **體力負荷**：評估當日步行距離和疲勞程度
4. **時間緩衝**：是否有足夠的用餐和休息時間
5. **雨備方案**：如有戶外活動，是否有替代方案

請使用批判性思維指出問題，並提供具體改善建議。
"""
            enhanced_message = diagnosis_prompt + enhanced_message
        
        # 🆕 調用 Model Manager (含思想簽名 Round-Trip)
        result = await call_with_fallback(
            api_key=api_key,
            history=full_history,
            message=enhanced_message,
            thought_signatures=request.thought_signatures,
            intent_type=intent_type  # 🆕 動態意圖
        )
        
        return {
            "response": result["text"],
            "raw_parts": result["raw_parts"],  # 🔒 前端需要儲存並 Round-Trip
            "model_used": result["model_used"],
            "grounding_metadata": result["grounding_metadata"],
            "poi_query_detected": poi_detection is not None,
            "poi_category": poi_detection["category"] if poi_detection else None
        }
        
    except Exception as e:
        print(f"🔥 Chat Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 🆕 SSE Streaming Chat API ====================
from fastapi.responses import StreamingResponse
import asyncio

async def stream_chat_generator(
    api_key: str,
    history: List[dict],
    message: str,
    thought_signatures: Optional[List[dict]] = None,
    sources: Optional[List[dict]] = None  # 🆕 v3.7.1: 來源 URLs
):
    """
    SSE Generator for streaming AI responses
    實作 Vercel 10s Bypass 策略
    """
    import json
    
    # 🔥 Step 1: TTFB Bypass - 立即發送 start 事件
    yield "event: start\ndata: {}\n\n"
    await asyncio.sleep(0)  # Force flush
    
    try:
        # 初始化 Client
        client = genai.Client(api_key=api_key)
        
        # 發送 thinking 事件
        yield 'event: thinking\ndata: {"status": "processing"}\n\n'
        await asyncio.sleep(0)
        
        # 建構 history
        from google.genai import types
        chat_history = []
        for msg in history:
            role = "user" if msg.get("role") == "user" else "model"
            text_content = ""
            if "rawParts" in msg and msg["rawParts"]:
                for part in msg["rawParts"]:
                    if isinstance(part, dict) and "text" in part:
                        text_content += part["text"]
            elif "parts" in msg and msg["parts"]:
                for part in msg["parts"]:
                    if isinstance(part, dict) and "text" in part:
                        text_content += part["text"]
                    elif isinstance(part, str):
                        text_content += part
            else:
                text_content = msg.get("content") or msg.get("displayContent") or ""
            
            if text_content:
                chat_history.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=text_content)]
                ))
        
        # 設定心跳任務
        last_heartbeat = asyncio.get_event_loop().time()
        heartbeat_interval = 15  # 15秒心跳
        
        # 串流生成
        model_name = "gemini-3-flash-preview"
        full_text = ""
        raw_parts = []
        
        try:
            # 使用 async streaming API
            async for chunk in await client.aio.models.generate_content_stream(
                model=model_name,
                contents=chat_history + [types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=message)]
                )]
            ):
                # 心跳檢查
                current_time = asyncio.get_event_loop().time()
                if current_time - last_heartbeat > heartbeat_interval:
                    yield ": heartbeat\n\n"
                    last_heartbeat = current_time
                
                # 發送文字 chunk
                if hasattr(chunk, 'text') and chunk.text:
                    full_text += chunk.text
                    yield f'event: text\ndata: {json.dumps({"text": chunk.text})}\n\n'
                    await asyncio.sleep(0)
            
            raw_parts = [{"text": full_text}]
            
        except Exception as gen_error:
            # 模型可能不支援 Streaming，嘗試降級
            print(f"⚠️ Streaming 失敗，嘗試降級: {gen_error}")
            model_name = "gemini-2.5-pro"
            yield f'event: thinking\ndata: {json.dumps({"status": "fallback"})}\n\n'
            
            # 非串流 fallback
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=chat_history + [types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=message)]
                )]
            )
            full_text = response.text if hasattr(response, 'text') else ""
            yield f'event: text\ndata: {json.dumps({"text": full_text})}\n\n'
            raw_parts = [{"text": full_text}]
        
        # 發送完成事件 (🆕 v3.7.1: 包含來源 URLs)
        done_data = {
            "model_used": model_name,
            "raw_parts": raw_parts,
            "sources": sources or []  # 🆕 v3.7.1: 來源 URLs
        }
        yield f'event: done\ndata: {json.dumps(done_data)}\n\n'
        
    except Exception as e:
        print(f"🔥 Stream Error: {e}")
        yield f'event: error\ndata: {json.dumps({"message": str(e), "code": 500})}\n\n'



# 🆕 v3.6: 記憶摘要 API (SummarizeRequest 已移至 models/base.py)

@app.post("/api/chat/summarize")
async def summarize_history(request: SummarizeRequest, api_key: str = Depends(get_gemini_key)):
    """
    記憶摘要端點 - 將長對話壓縮成短摘要
    使用 Gemini 2.5 Flash Lite (最省 Token)
    """
    print(f"🧠 記憶摘要請求：{len(request.history)} 條訊息")
    
    try:
        # 將歷史轉為文字
        history_text = ""
        for msg in request.history:
            role = "用戶" if msg.get("role") == "user" else "AI"
            content = msg.get("displayContent") or msg.get("content") or ""
            if content:
                history_text += f"{role}: {content[:200]}...\n" if len(content) > 200 else f"{role}: {content}\n"
        
        prompt = f"""請將以下對話歷史摘要成 200 字以內的關鍵重點，保留：
1. 使用者提到的重要地點、餐廳、景點名稱
2. 使用者的偏好和需求
3. AI 給過的重要建議

對話歷史：
{history_text}

請直接輸出摘要，不要加標題或格式："""
        
        # 使用 Flash Lite 最省 Token
        from services.model_manager import call_extraction
        summary = await call_extraction(api_key, prompt, intent_type="SUMMARIZE")
        
        print(f"✅ 摘要完成：{len(summary)} 字")
        return {"summary": summary.strip(), "original_count": len(request.history)}
        
    except Exception as e:
        print(f"🔥 摘要失敗：{e}")
        raise HTTPException(status_code=500, detail=f"摘要失敗: {str(e)}")



# 
#  POI ENDPOINTS - MOVED TO routers/poi.py (Phase 4e)
# 
# - POST /api/poi/ai-enrich
# - POST /api/poi/enrich
# 

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest, api_key: str = Depends(get_gemini_key)):
    """
    SSE Streaming Chat Endpoint
    用於繞過 Vercel 10 秒 Timeout 限制
    """
    # 建構對話歷史 (加入 System Prompt)
    system_history = [
        {"role": "user", "parts": [{"text": SYSTEM_PROMPT}]},
        {"role": "model", "parts": [{"text": "收到！我是 Ryan，你的 AI 旅遊達人。有什麼我可以幫你的嗎？😎"}]}
    ]
    
    # 處理對話歷史
    processed_history = []
    for msg in request.history:
        role = "user" if msg.get("role") == "user" else "model"
        if "rawParts" in msg and msg["rawParts"]:
            parts = msg["rawParts"]
        elif "parts" in msg and msg["parts"]:
            parts = msg["parts"]
        else:
            content = msg.get("content") or msg.get("displayContent") or ""
            parts = [{"text": content}]
        processed_history.append({"role": role, "parts": parts})
    
    full_history = system_history + processed_history
    
    # 🆕 v3.7: 景點偵測 + 三源資料注入
    enriched_message = request.message
    poi_sources = []  # 🆕 v3.7.1: 收集來源 URLs
    try:
        # 偵測景點相關關鍵字 (簡單方法: 檢查是否包含景點名稱模式)
        poi_keywords = ["怎麼樣", "推薦", "介紹", "告訴我", "什麼", "好玩", "好吃", "值得"]
        place_indicators = ["寺", "神社", "城", "塔", "公園", "站", "車站", "廟", "宮", "殿", "館", "園"]
        
        message_lower = request.message.lower()
        has_poi_question = any(kw in request.message for kw in poi_keywords)
        has_place = any(ind in request.message for ind in place_indicators)
        
        if has_poi_question and has_place:
            # 嘗試提取景點名稱 (簡單方法: 找到包含指示詞的詞)
            import re
            # 尋找景點名稱: 2-10 個中文字符，後面跟著指示詞
            place_pattern = r'([\u4e00-\u9fa5]{2,10}(?:寺|神社|城|塔|公園|站|車站|廟|宮|殿|館|園))'
            matches = re.findall(place_pattern, request.message)
            
            if matches:
                place_name = matches[0]
                print(f"🔍 偵測到景點查詢: {place_name}")
                
                # 調用三源整合
                from services.poi_service import enrich_poi_complete, format_enriched_poi_for_ai, get_source_urls
                poi = {"name": place_name, "wikidata_id": ""}
                enriched_poi = await enrich_poi_complete(poi)
                formatted_info = format_enriched_poi_for_ai(enriched_poi)
                
                # 🆕 v3.7.1: 收集來源 URLs
                poi_sources = get_source_urls(enriched_poi, place_name)
                
                if formatted_info and len(formatted_info) > 20:
                    # 將三源資料注入到訊息前
                    enriched_message = f"""用戶詢問關於「{place_name}」的問題。

📚 以下是來自維基百科/維基導遊的參考資料：
{formatted_info}

用戶原始問題：{request.message}

請根據以上資料回答用戶問題，使用你的 Ryan 旅遊達人風格！"""
                    print(f"✅ 三源資料已注入 ({len(formatted_info)} 字), 來源數: {len(poi_sources)}")
    except Exception as e:
        print(f"⚠️ 三源資料注入失敗 (不影響主流程): {e}")
    
    return StreamingResponse(
        stream_chat_generator(
            api_key=api_key,
            history=full_history,
            message=enriched_message,
            thought_signatures=request.thought_signatures,
            sources=poi_sources  # 🆕 v3.7.1: 傳遞來源
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )



# 
#  POI SEARCH & WIKI - MOVED TO routers/poi.py (Phase 4e)
# 
# - GET /api/poi/nearby
# - POST /api/poi/recommend
# - GET /api/poi/categories
# - GET /api/wikivoyage/search
# Import from: routers.poi (registered at app startup)
# 
