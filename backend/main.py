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
import base64
import json
import asyncio
import traceback
import orjson
import random
import string
import logging
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header, Depends, BackgroundTasks, Request
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from google import genai
from google.genai import types, errors
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from utils.limiter import limiter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, StreamingResponse
from dotenv import load_dotenv

# 1. 載入環境變數
load_dotenv()

# 🛡️ 診斷日誌配置
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ryan-travel-api")

from datetime import datetime

# Models
from models.base import (
    UserPreferences, MarkdownImportRequest, GenerateTripRequest, SimplePromptRequest,
    GeocodeSearchRequest, GeocodeReverseRequest, ItineraryItem, SaveItineraryRequest,
    JoinTripRequest, CreateManualTripRequest, UpdateItemRequest, CreateItemRequest,
    ImportToTripRequest, UpdateDayDataRequest, AddDayRequest, AppendItemsRequest,
    CloneTripRequest, UpdateCoverRequest, UpdateLocationRequest, UpdateInfoRequest,
    RouteStop, RouteRequest, ExpenseRequest, UpdateTripTitleRequest, UpdateExpenseRequest,
    ChatRequest, SummarizeRequest, POIAIEnrichRequest, POIEnrichRequest, POIRecommendRequest
)

from supabase import create_client
from services.geocode_service import HTTPX_CLIENT
from services.model_manager import (
    call_with_fallback, call_verifier, call_extraction, 
    detect_diagnosis_intent, sanitize_config_for_model
)
from services.poi_service import (
    detect_poi_query, search_poi_combined, format_pois_for_ai, 
    enrich_poi_complete, format_enriched_poi_for_ai, get_source_urls
)
from services.memory_service import MemoryService
from utils.deps import get_gemini_key, get_verified_user, get_supabase
from utils.ai_config import DAILY_ROUTING, WORKHORSE_MODEL
from google.genai import errors as genai_errors

# 🆕 Phase 2026: Lifespan Manager (取代舊的 startup/shutdown 裝飾器)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup Logic (Predictive Loading) ---
    print("🚀 [Lifespan] Initializing system resources...")
    
    # 1. 驗證環境變數
    required_env = ["SUPABASE_URL", "SUPABASE_KEY"]
    missing_env = [env for env in required_env if not os.getenv(env)]
    if missing_env:
        print(f"❌ [Lifespan] CRITICAL: Missing environment variables: {missing_env}")
        # In production (Cloud Run), we might want to fail hard here
    
    # 2. 初始化 Supabase
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    if supabase_url and supabase_key:
        try:
            app.state.supabase = create_client(supabase_url, supabase_key)
            # 🛡️ Predictive Check: Test connection with a lightweight query
            test_res = app.state.supabase.table("itineraries").select("id").limit(1).execute()
            print(f"[Supabase] ✅ Connected and verified (Query OK: {len(test_res.data) if test_res.data else 0} items)")
        except Exception as e:
            print(f"⚠️ [Supabase] Startup Verification Failed: {e}")
            app.state.supabase = None
    else:
        app.state.supabase = None

    # 3. 驗證 Geocode Service 狀態
    print(f"[HTTPX] ✅ Global connection pool ready")

    # 4. 註冊全局狀態標記
    app.state.start_time = datetime.utcnow()
    print("✨ [Lifespan] All systems operational")
    
    yield
    
    # --- Shutdown Logic ---
    print("🛑 [Lifespan] Releasing resources...")
    try:
        await HTTPX_CLIENT.aclose()
        print("[HTTPX] ✅ Connection pool closed")
    except Exception as e:
        print(f"⚠️ [Shutdown] Error closing HTTPX: {e}")

# 0. Initialize App
app = FastAPI(
    title="Ryan's AI Travel Tool (BYOK Edition)",
    default_response_class=ORJSONResponse,
    lifespan=lifespan
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# 🆕 Phase 4: 註冊 Routers (保持在頂層但延遲部分內部依賴)
from routers.geocode import router as geocode_router
from routers.expenses import router as expenses_router
from routers.ai import router as ai_router
from routers.trips import router as trips_router
from routers.gdpr import router as gdpr_router
from routers.route import router as route_router
from routers.poi import router as poi_router
from routers.users import router as users_router
from routers.app import router as app_router
from routers.sample_trip import router as sample_trip_router
from routers.ledger import router as ledger_router

app.include_router(geocode_router)
app.include_router(expenses_router)
app.include_router(ai_router)
app.include_router(trips_router)
app.include_router(gdpr_router)
app.include_router(route_router)
app.include_router(poi_router)
app.include_router(users_router)
app.include_router(app_router)
app.include_router(sample_trip_router)
app.include_router(ledger_router)
print("[Routers] ✅ All systems registered")

# 2. CORS 設定 (嚴格模式)
# 🚨 生產環境：只允許特定來源
ALLOWED_ORIGINS = [
    "https://travel-pwa-five.vercel.app",   # Production Frontend
    "http://localhost:3000",                # Local Next.js dev
    "http://localhost:5173",                # Local Vite dev
    "http://127.0.0.1:3000",                # Local dev (IP)
    "http://172.20.10.4:3000",              # Mobile Hotspot Network IP
    "https://antigravity-backend-589255638719.us-central1.run.app" # Self
]

# 允許 Vercel Preview Deployments (如果有的話)
if os.getenv("VERCEL_PREVIEW_DOMAINS"):
    ALLOWED_ORIGINS.extend(os.getenv("VERCEL_PREVIEW_DOMAINS").split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    allow_headers=["Content-Type", "Authorization", "X-Gemini-Key", "X-Gemini-API-Key", "X-Requested-With", "X-User-ID"],
    max_age=3600, # Cache preflight requests for 1 hour
)
print(f"[CORS] Configured strict origins: {ALLOWED_ORIGINS}")

# 3. 安全 Headers 中介軟體 (Security Headers)
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# 只允許來自 Cloud Run 或 Localhost 的 Host header
# 允許所有 Host (由 Cloud Run 的外部防火牆過濾，中間件層保持彈性)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# 3. 初始化已遷移至 Lifespan Manager


# 🆕 Health Check (for UptimeRobot - prevents Supabase 7-day pause)
@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check(request: Request):
    """🩺 強化版健康檢查 (2026 Resilience Edition)
    提供環境、資料庫與連線池的深度狀態
    """
    
    # 1. 計算 Uptime
    uptime_seconds = 0
    if hasattr(request.app.state, "start_time"):
        uptime_seconds = (datetime.utcnow() - request.app.state.start_time).total_seconds()
    
    # 2. 探測資料庫 (Supabase Resilience)
    db_status = "unknown"
    db_latency_ms = -1
    try:
        supabase_client = getattr(request.app.state, "supabase", None)
        if supabase_client:
            start_check = datetime.utcnow()
            # 輕量級查詢測試連線
            supabase_client.table("itineraries").select("id").limit(1).execute()
            db_latency_ms = (datetime.utcnow() - start_check).total_seconds() * 1000
            db_status = "connected"
        else:
            db_status = "not_initialized"
    except Exception as e:
        db_status = f"error: {str(e)[:50]}"
    
    # 3. 獲取連線池統計 (Predictive Stats)
    pool_stats = "N/A"
    try:
        # HTTPX AsyncClient stats - Use hasattr/getattr for robustness
        pool = HTTPX_CLIENT._transport._pool
        max_conn = getattr(HTTPX_CLIENT, "limits", None)
        max_conn_val = max_conn.max_connections if max_conn else "Unknown"
        
        pool_stats = {
            "active_connections": len(pool._connections),
            "max_connections": max_conn_val,
            "requests_in_flight": len(pool._requests)
        }
    except Exception as pool_err:
        print(f"⚠️ Health pool stats failed: {pool_err}")
        pass

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_seconds": round(uptime_seconds, 1),
        "database": {
            "status": db_status,
            "latency_ms": round(db_latency_ms, 2)
        },
        "resources": {
            "pool": pool_stats,
            "memory": "stable" # Placeholder for future OS metrics
        },
        "version": "1.2.5-hardened",
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

# --- 嚴謹的依賴注入 (Dependency Injection已移至頂層及 utils.deps) ---

# --- API 路由 ---
@app.api_route("/", methods=["GET", "HEAD"])
def root_status():
    return {"status": "Alive", "mode": "BYOK"}

# /api/plan and generate_itinerary have been superseded by 
# /api/ai/generate-trip in routers/ai.py.


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
    🧠 2026 Sliding Window Context Injection
    將精簡版行程轉為 AI 可理解的 Markdown 格式，並優化長行程 Token 消耗。
    核心邏輯：完整顯示 Focused Day 的細節，其餘天數僅保留標題與地點。
    """
    if not itinerary:
        return ""
    
    itinerary_title = itinerary.get("title", "未命名")
    start_date = itinerary.get("start_date", "?")
    end_date = itinerary.get("end_date", "?")
    total_days = itinerary.get("total_days", 0)
    # 優先使用傳入的 focused_day，否則使用 itinerary 內的（通常是前端當前視窗）
    actual_focused_day = focused_day or itinerary.get("focused_day") or 1
    weather_context = itinerary.get("weather_context")
    
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = [
        "\n--- SYSTEM CONTEXT: NEURAL ITINERARY CONNECTION (SLIDING WINDOW) ---",
        f"當前系統時間: {now_str}",
        "以下是使用者目前的行程摘要。為了保持效能，我將重點展示你「目前正在查看」的天數細節（以 👉 標記）。",
        f"行程標題: {itinerary_title}",
        f"起訖日期: {start_date} ~ {end_date} (共 {total_days} 天)",
        ""
    ]
    
    days = itinerary.get("days", [])
    for day in days:
        day_num = day.get("day_number", 0)
        date_str = day.get("date", "")
        is_focused = (day_num == actual_focused_day)
        
        # 🛡️ Sliding Window Logic
        # 如果是正在查看的天數，或是行程較短（< 4天），顯示完整細節
        # 否則只顯示簡略地點，大幅節省 Token
        show_full_detail = is_focused or total_days <= 3
        
        prefix = "👉 " if is_focused else "• "
        lines.append(f"{prefix}**Day {day_num}** ({date_str}):")
        
        items = day.get("items", [])
        if not items:
            lines.append("  (此日尚未規劃活動)")
            continue

        if show_full_detail:
            # 完整細節模式
            for item in items:
                time = item.get("time", "?")
                place = item.get("place", "?")
                category = item.get("category", "")
                icon = {
                    "transport": "🚃", "food": "🍽️", "hotel": "🏨", "shopping": "🛍️", "sightseeing": "📸"
                }.get(category, "📍")
                
                highlight = "⭐ " if item.get("is_highlight") else ""
                lines.append(f"  {time} {icon} {highlight}{place}")
                
                # Notes/Guide/Memo (僅限 Focused Day)
                notes = item.get("notes")
                if notes:
                    lines.append(f"    [Guide] {notes.replace('\n', ' ')}")
                
                memo = item.get("memo")
                if memo:
                    safe_memo_lines = [line_text for line_text in memo.split('\n') if "[PRIVATE]" not in line_text]
                    if safe_memo_lines:
                        lines.append(f"    [Memo] {' '.join(safe_memo_lines)}")
        else:
            # 精簡模式：只顯示地點名稱，幫助 AI 維持上下文
            places = [item.get("place", "?") for item in items]
            lines.append(f"  📍 亮點: {', '.join(places[:5])}{' ...' if len(places) > 5 else ''}")
        
    lines.append("")
    if weather_context:
        lines.append(f"🌡️ **實時天氣脈絡:**\n{weather_context}\n")
        
    lines.append("--- END OF SYSTEM CONTEXT ---\n")
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
7.  **🆕 行程神經連結 (Itinerary Awareness)**：你已接入系統的「神經連結」，能實時感知用戶在介面上看到的行程（透過標記為 `👉` 的 Focused Day）。
    *   **重要禁令**：當系統提供 `[用戶當前行程]` 資料時，**嚴禁**回答「我不知道你的行程」或「請給我你的計畫」。你必須從現有資料中尋找答案。
    *   **任務**：主動從備忘錄 (Memo)、清單 (Checklist) 和天氣資訊中提取答案，並根據當前日期與時間判斷用戶所處的天數。

### 回覆規範 (Response Guidelines)
1.  **排版精美**：使用 Markdown 語法，善用 **粗體** 強調重點，使用條列式清單讓資訊易於掃描（考量手機螢幕閱讀）。
2.  **行動導向**：在回覆的最後，盡量提供一個「下一步建議」（例如：「需要我幫你把這段日文存成圖片嗎？」）。
3.  **多模態處理**：如果使用者上傳照片（如菜單、藥盒、街景），請優先針對圖片內容進行深度解析。
"""

@app.post("/api/chat")
@limiter.limit("20/minute")
async def chat_with_ryan(
    request: Request, 
    body: ChatRequest, 
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_verified_user),
    api_key: str = Depends(get_gemini_key)
):
    try:
        # 🆕 使用 Model Manager (Gemini 3 優先 + 自動降級)
        
        # 🆕 v3.8: 獲取使用者記憶偏好
        memory_context = ""
        if user_id:
            memory_context = await MemoryService.get_preferences_context(user_id, app.state.supabase)
            if memory_context:
                print(f"🧠 [Memory] 注入使用者偏好脈絡 (User: {user_id})")
        
        # 🆕 偵測是否為 POI 相關查詢
        poi_detection = detect_poi_query(body.message)
        poi_context = ""
        
        if poi_detection and body.location:
            # 自動查詢 POI 資料
            try:
                lat = body.location.get("lat", 35.6895)  # 預設東京
                lng = body.location.get("lng", 139.6917)
                location_name = body.location.get("name", "當前位置")
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
        for msg in body.history:
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
        if body.current_itinerary:
            itinerary_context = format_itinerary_context(
                body.current_itinerary, 
                body.focused_day
            )
            print(f"📅 注入行程上下文: {body.current_itinerary.get('title', '?')}")
        
        # 處理當前訊息 (包含 POI 上下文 + 行程上下文 + 記憶上下文)
        enhanced_message = body.message + poi_context + itinerary_context + memory_context
        
        # 🧪 Step 3: 行程診斷 (Diagnosis) Intent Detection
        # v3.5: 只有當 message 看起來像在問行程好不好時才觸發
        is_diagnosis = detect_diagnosis_intent(body.message)
        intent_type = "CHAT"  # 預設 (恢復 Ryan 人格)
        if is_diagnosis:
            intent_type = "DIAGNOSIS"
            print("🩺 診斷意圖偵測：切換到 DIAGNOSIS 模式")
            # 注入診斷專用 System Prompt
            diagnosis_prompt = """
**[診斷模式啟用]**
你現在是一位嚴謹的「行程診斷專家」。請對用戶的行程進行深度分析：

1. **交通順暢度**：檢查交通工具、換乘是否合理
2. **營業時間衝突**：景點/餐廳是否在計畫時間營業、是否順路
3. **體力負荷評估**：評估當日步行量與疲勞程度
4. **時間緩衝檢測**：是否有足夠的用餐與休息時間
5. **雨天備案建議**：針對戶外活動提供雨天替代方案

請使用批判性思維指出風險，並提供具體的優化建議。
"""
            enhanced_message = diagnosis_prompt + enhanced_message
            
        final_message = enhanced_message
        
        # 📸 Step 4: 圖像處理 (Vision Overlay)
        if body.image:
            
            try:
                # 1. 提煉 MIME 格式 (如果前端有傳遞 "data:image/png;base64,")
                mime_type = "image/jpeg" # 預設 Fallback
                if "data:" in body.image and ";base64," in body.image:
                    mime_type = body.image.split(";")[0].split(":")[1]
                
                # 2. 擷取純 Base64 字串並解碼成二進位資料
                if "base64," in body.image:
                    image_data = base64.b64decode(body.image.split("base64,")[1])
                else:
                    image_data = base64.b64decode(body.image)
                    
                # 如果只有附圖沒有文字，加上預設的分析提示
                if not enhanced_message.strip():
                    enhanced_message = "請幫我分析這張圖片，並依據它提供旅遊建議"
                
                # 3. 鑄造無敵的 SDK 原生物件 (types.Part.from_bytes)
                image_part = types.Part.from_bytes(data=image_data, mime_type=mime_type)
                
                # Google GenAI SDK 支援直接傳入 [Part, Part]
                final_message = [image_part, types.Part.from_text(text=enhanced_message)]
                print(f"📸 成功載入圖片 ({mime_type})，切換為 Multi-modal 原生請求")
            except Exception as img_err:
                print(f"⚠️ Image processing error: {img_err}")
                final_message = f"[系統提示：使用者上傳了一張圖片，但系統解析失敗]\n{enhanced_message}"
        
        # 🆕 調用 Model Manager (含思想簽名 Round-Trip)
        result = await call_with_fallback(
            api_key=api_key,
            history=full_history,
            message=final_message,
            thought_signatures=body.thought_signatures,
            intent_type=intent_type  
        )
        
        # 🆕 v3.8: 非同步學習使用者偏好 (Adaptive Memory)
        if user_id and result.get("text"):
            background_tasks.add_task(
                MemoryService.extract_preferences,
                user_id,
                body.message,
                result["text"],
                api_key,
                app.state.supabase
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
                chat_history.append(genai.types.Content(
                    role=role,
                    parts=[genai.types.Part.from_text(text=text_content)]
                ))
        
        # 設定心跳任務
        last_heartbeat = asyncio.get_event_loop().time()
        heartbeat_interval = 15  # 15秒心跳
        
        # 1. 初始化模型與安全配置
        model_name = DAILY_ROUTING[0]
        last_chunk = None
        
        # 構建串流 config（含 Google Search Grounding）
        stream_config = genai.types.GenerateContentConfig(
            max_output_tokens=2048,
            temperature=1.0,
            tools=[{"google_search": {}}],
        )
        
        contents = chat_history + [genai.types.Content(
            role="user",
            parts=[genai.types.Part.from_text(text=message)]
        )]
        
        # 嘗試路由陣列中的每個模型
        stream_success = False
        full_text = ""  # 🛡️ 關鍵修復：初始化以避免 UnboundLocalError
        for i, candidate_model in enumerate(DAILY_ROUTING):
            try:
                safe_config = sanitize_config_for_model(stream_config, candidate_model, intent_type="CHAT")
                model_name = candidate_model
                label = "🧠 Primary" if i == 0 else f"🔄 Fallback #{i}"
                print(f"{label} Stream: {candidate_model}")
                
                async for chunk in await client.aio.models.generate_content_stream(
                    model=candidate_model,
                    contents=contents,
                    config=safe_config,
                ):
                    last_chunk = chunk  # 持續記錄最後 chunk（含 grounding_metadata）
                    
                    # 心跳檢查
                    current_time = asyncio.get_event_loop().time()
                    if current_time - last_heartbeat > heartbeat_interval:
                        yield ": heartbeat\n\n"
                        last_heartbeat = current_time
                    
                    # 🆕 v5.2: 處理思考過程 (Thought Streaming)
                    if hasattr(chunk, 'thought') and chunk.thought:
                        yield f'event: thinking\ndata: {json.dumps({"status": "thinking", "thought": chunk.thought})}\n\n'
                        await asyncio.sleep(0)
                        
                    # 發送文字 chunk
                    if hasattr(chunk, 'text') and chunk.text:
                        full_text += chunk.text
                        yield f'event: text\ndata: {json.dumps({"text": chunk.text})}\n\n'
                        await asyncio.sleep(0)
                
                stream_success = True
                break  # 成功，跳出降級迴圈
                
            except (genai_errors.APIError, Exception) as gen_error:
                print(f"⚠️ {candidate_model} 串流失敗: {gen_error}")
                yield f'event: thinking\ndata: {json.dumps({"status": "fallback", "model": candidate_model})}\n\n'
                full_text = ""  # 重置，避免拼接到殘片
                last_chunk = None
                continue
        
        if not stream_success:
            yield f'event: error\ndata: {json.dumps({"message": "所有模型均不可用", "code": 503})}\n\n'
            return
        
        raw_parts = [{"text": full_text}]
        
        # 🆕 v5.0: 從最後一個 chunk 提取 grounding_metadata（引文來源）
        citations = []
        if last_chunk and hasattr(last_chunk, 'candidates') and last_chunk.candidates:
            candidate = last_chunk.candidates[0]
            if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                gm = candidate.grounding_metadata
                if hasattr(gm, 'grounding_chunks') and gm.grounding_chunks:
                    for gc in gm.grounding_chunks:
                        if hasattr(gc, 'web') and gc.web:
                            citations.append({
                                "title": gc.web.title if hasattr(gc.web, 'title') else "Source",
                                "uri": gc.web.uri if hasattr(gc.web, 'uri') else ""
                            })
        
        # 發送完成事件（含引文來源）
        done_data = {
            "model_used": model_name,
            "raw_parts": raw_parts,
            "sources": citations or sources or [],
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
        
        """💡 AI 景點亮點豐富化"""
        # 使用 Flash Lite 最省 Token
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
@limiter.limit("20/minute")
async def chat_stream(request: Request, body: ChatRequest, api_key: str = Depends(get_gemini_key)):
    """
    SSE Streaming Chat Endpoint
    針對 Vercel 10 秒 Timeout 優化
    """
    # 建構對話歷史 (加入 System Prompt)
    system_history = [
        {"role": "user", "parts": [{"text": SYSTEM_PROMPT}]},
        {"role": "model", "parts": [{"text": "收到！我是 Ryan，你的 AI 旅遊達人。有什麼我可以幫你的嗎？😎"}]}
    ]
    
    # 處理對話歷史
    processed_history = []
    for msg in body.history:
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
    enriched_message = body.message
    poi_sources = []  # 🆕 v3.7.1: 收集來源 URLs
    try:
        # 偵測景點相關關鍵字 (簡單方法: 檢查是否包含景點名稱模式)
        poi_keywords = ["怎麼樣", "推薦", "介紹", "告訴我", "什麼", "好玩", "好吃", "值得"]
        place_indicators = ["寺", "神社", "城", "塔", "公園", "站", "車站", "廟", "宮", "殿", "館", "園"]
        
        has_poi_question = any(kw in body.message for kw in poi_keywords)
        has_place = any(ind in body.message for ind in place_indicators)
        
        if has_poi_question and has_place:
            # 嘗試提取景點名稱 (簡單方法: 找到包含指示詞的詞)
            # 尋找景點名稱: 2-10 個中文字符，後面跟著指示詞
            place_pattern = r'([\u4e00-\u9fa5]{2,10}(?:寺|神社|城|塔|公園|站|車站|廟|宮|殿|館|園))'
            matches = re.findall(place_pattern, body.message)
            
            if matches:
                place_name = matches[0]
                print(f"🔍 偵測到景點查詢: {place_name}")
                
                # 2. 調用 POI 服務進行豐富與格式化
                poi = {"name": place_name, "wikidata_id": ""}
                enriched_poi = await enrich_poi_complete(poi)
                formatted_info = format_enriched_poi_for_ai(enriched_poi)
                
                # 🆕 v3.7.1: 收集來源 URLs
                poi_sources = get_source_urls(enriched_poi, place_name)
                
                if formatted_info and len(formatted_info) > 20:
                    # 將三源資料注入到訊息前
                    enriched_message = f"""用戶詢問關於「{place_name}」資訊。

🔬 以下是來自維基百科/旅遊導覽的參考資料：
{formatted_info}

用戶原始問題：{body.message}

請根據以上資料回答用戶問題，並保持你 Ryan 專家擬人的溫暖、風趣風格。"""
                    print(f"✅ 三源資料已注入 ({len(formatted_info)} 字), 來源數: {len(poi_sources)}")
    except Exception as e:
        print(f"⚠️ 三源資料注入失敗 (不影響主流程): {e}")
    
    # 🆕 v3.8: 智慧神經夾擊 (Neural Sandwich)
    # 將上下文放在最前面，確保模型在看到問題前已具備背景知識
    itinerary_context = ""
    if body.current_itinerary:
        itinerary_context = format_itinerary_context(
            body.current_itinerary, 
            body.focused_day
        )
        print(f"📅 串流注入行程上下文: {body.current_itinerary.get('title', '?')}")
    
    # 處理最終訊息: 上下文 -> 原始消息
    # 🔧 FIX: enriched_message 已經包含了 POI 資料或原始訊息
    final_message = f"{itinerary_context}\n\n{enriched_message}"
    
    return StreamingResponse(
        stream_chat_generator(
            api_key=api_key,
            history=full_history,
            message=final_message,
            thought_signatures=body.thought_signatures,
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
