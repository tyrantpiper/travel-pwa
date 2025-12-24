# Ryan Travel API v1.2 - Auto-sync enabled
import os
import json
import random
import string
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from supabase import create_client, Client
from google import genai  # 🆕 新版 SDK
import httpx  # For async HTTP requests (geocoding)
from dotenv import load_dotenv

# 1. 載入環境變數 (只讀 Supabase)
load_dotenv()

app = FastAPI(title="Ryan's AI Travel Tool (BYOK Edition)")

# 2. CORS 設定 (開發環境允許所有來源)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開發環境允許所有來源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 初始化 Supabase
try:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"⚠️ Supabase Warning: {e}")

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
    print("🗺️ ArcGIS Geocoding: 已啟用")
else:
    print("🗺️ ArcGIS Geocoding: 未設定，使用 Nominatim 備援")

# --- AI 模型設定區 (2.5 版混合動力引擎) ---
# 1. 主力模型 (支援 Maps, 500 RPD)
PRIMARY_MODEL = "gemini-2.5-flash"

# 2. 輕量模型 (支援 Maps, 500 RPD)
LITE_MODEL = "gemini-2.5-flash-lite"

# 3. 智力模型 (無工具, 無 RPD 限制, 速度快)
SMART_NO_TOOL_MODEL = "gemini-3-flash-preview"

# 4. 🆕 推理模型 (免費無限, 複雜推理, 行程診斷)
REASONING_MODEL = "gemini-2.5-pro"

# --- AI 服務函式 (包含降級機制) ---
async def call_ai_parser(api_key: str, prompt: str, use_tools: bool = True):
    """
    智能 AI 調用函數，支持自動降級
    使用新版 google-genai SDK
    
    Args:
        api_key: Gemini API Key
        prompt: 提示詞
        use_tools: 是否嘗試使用 Google Maps 工具 (目前未實作)
    
    Returns:
        str: AI 生成的文本
    """
    # 🆕 使用新版 Client API
    client = genai.Client(api_key=api_key)
    
    # 策略 A: 優先使用主力模型
    try:
        print(f"🤖 嘗試使用 {PRIMARY_MODEL}...")
        response = client.models.generate_content(
            model=PRIMARY_MODEL,
            contents=prompt
        )
        print(f"✅ {PRIMARY_MODEL} 成功回應")
        return response.text
        
    except Exception as e:
        print(f"⚠️ {PRIMARY_MODEL} 失敗: {e}")
        
        # 策略 B: 降級到 Lite 模型
        try:
            print(f"🤖 切換至備用模型 {LITE_MODEL}...")
            response = client.models.generate_content(
                model=LITE_MODEL,
                contents=prompt
            )
            print(f"✅ {LITE_MODEL} 成功回應")
            return response.text
        except Exception as e2:
            print(f"⚠️ {LITE_MODEL} 也失敗: {e2}")
            
            # 策略 C: 使用最聰明的模型
            print(f"🤖 切換至 {SMART_NO_TOOL_MODEL}...")
            response = client.models.generate_content(
                model=SMART_NO_TOOL_MODEL,
                contents=prompt
            )
            print(f"✅ {SMART_NO_TOOL_MODEL} 成功回應")
            return response.text

# --- 資料模型 ---
class UserPreferences(BaseModel):
    destination: str
    days: int
    budget: str
    interests: List[str]

# 接收 Markdown 的模型
class MarkdownImportRequest(BaseModel):
    markdown_text: str
    itinerary_id: Optional[str] = None # 如果是要匯入到現有行程

# 新增：生成請求模型
class GenerateTripRequest(BaseModel):
    origin: str
    destination: str
    days: int
    interests: str

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
            contents=prompt
        )
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
        
    except Exception as e:
        print(f"🔥 AI Error: {e}")
        raise HTTPException(status_code=400, detail=f"AI Service Error: {str(e)}")

# 🌍 地理編碼雙引擎系統 (ArcGIS + Nominatim)

async def geocode_with_arcgis(place_name: str):
    """ArcGIS World Geocoding Service (精確度高，支援日本POI)"""
    if not ARCGIS_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(
                "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
                params={
                    "SingleLine": place_name,
                    "f": "json",
                    "outFields": "PlaceName,Place_addr",
                    "maxLocations": 1,
                    "token": ARCGIS_API_KEY
                }
            )
            data = res.json()
            if data.get("candidates"):
                loc = data["candidates"][0]["location"]
                print(f"🗺️ ArcGIS: {place_name} → ({loc['y']:.4f}, {loc['x']:.4f})")
                return {"lat": loc["y"], "lng": loc["x"]}
    except Exception as e:
        print(f"⚠️ ArcGIS error for '{place_name}': {e}")
    return None


async def geocode_with_nominatim(place_name: str):
    """
    🔒 Nominatim 備援 (OpenStreetMap) - 目前已停用
    
    保留原因：未來如需結構化地址批次處理可啟用
    停用原因：對中文/日文地名搜尋效果差，改用 Photon
    
    如需重新啟用，將 geocode_place 中的 Photon 改回 Nominatim 即可
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": place_name, 
                    "format": "json", 
                    "limit": 1,
                    "accept-language": "zh-TW,zh,en"
                },
                headers={"User-Agent": "RyanTravelApp/1.0"}
            )
            data = res.json()
            if data and len(data) > 0:
                result = data[0]
                print(f"🌍 Nominatim: {place_name} → ({result['lat']}, {result['lon']})")
                return {
                    "lat": float(result["lat"]), 
                    "lng": float(result["lon"]),
                    "name": result.get("display_name", place_name).split(",")[0],
                    "address": result.get("display_name", "")
                }
    except Exception as e:
        print(f"🌍 Nominatim error for '{place_name}': {e}")
    return None


async def geocode_with_photon(place_name: str, limit: int = 5):
    """Photon 地理編碼 (基於 OpenStreetMap + Elasticsearch，模糊搜尋強)
    
    優點：
    - 免費無限制
    - 支援模糊搜尋（打錯字也能找到）
    - 多語言支援佳
    - 支援正向和反向地理編碼
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(
                "https://photon.komoot.io/api/",
                params={
                    "q": place_name,
                    "limit": limit,
                    "lang": "zh"  # 中文優先
                }
            )
            data = res.json()
            if data.get("features") and len(data["features"]) > 0:
                results = []
                for feature in data["features"]:
                    props = feature.get("properties", {})
                    coords = feature.get("geometry", {}).get("coordinates", [0, 0])
                    
                    # 組合地址
                    address_parts = []
                    for key in ["country", "state", "city", "district", "street", "housenumber"]:
                        if props.get(key):
                            address_parts.append(props[key])
                    
                    results.append({
                        "lat": coords[1],
                        "lng": coords[0],
                        "name": props.get("name", place_name),
                        "address": ", ".join(address_parts) if address_parts else props.get("name", ""),
                        "type": props.get("osm_value", "place")
                    })
                
                if results:
                    print(f"🔍 Photon: {place_name} → {len(results)} 結果")
                    return results
    except Exception as e:
        print(f"🔍 Photon error for '{place_name}': {e}")
    return None


async def reverse_geocode_with_photon(lat: float, lng: float):
    """Photon 反向地理編碼（座標 → 地名）"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(
                "https://photon.komoot.io/reverse",
                params={"lat": lat, "lon": lng, "lang": "zh"}
            )
            data = res.json()
            if data.get("features") and len(data["features"]) > 0:
                props = data["features"][0].get("properties", {})
                address_parts = []
                for key in ["country", "state", "city", "district", "street", "housenumber"]:
                    if props.get(key):
                        address_parts.append(props[key])
                
                return {
                    "name": props.get("name", "Unknown"),
                    "address": ", ".join(address_parts) if address_parts else "Unknown"
                }
    except Exception as e:
        print(f"🔍 Photon reverse error: {e}")
    return None


async def geocode_place(place_name: str):
    """智能地理編碼：ArcGIS 優先，Photon 備援
    
    ⚠️ 函數簽名與回傳格式完全不變，確保向後相容
    回傳: {"lat": float, "lng": float} 或 None
    """
    # 1. 優先嘗試 ArcGIS (精確度高)
    if ARCGIS_API_KEY:
        result = await geocode_with_arcgis(place_name)
        if result:
            return result
        print(f"⚠️ ArcGIS 查無結果，降級到 Photon...")
    
    # 2. 降級到 Photon（取代 Nominatim）
    photon_results = await geocode_with_photon(place_name, limit=1)
    if photon_results:
        first = photon_results[0]
        return {"lat": first["lat"], "lng": first["lng"]}
    
    return None


# 🌍 地理編碼 API 端點（供前端使用）

class GeocodeSearchRequest(BaseModel):
    query: str
    limit: int = 5

class GeocodeReverseRequest(BaseModel):
    lat: float
    lng: float

@app.post("/api/geocode/search")
async def geocode_search(request: GeocodeSearchRequest):
    """🔍 混合地理編碼搜尋（三層架構）
    
    優先使用免費服務，確保最高成功率：
    1️⃣ Photon（快速、免費、模糊搜尋）
    2️⃣ Nominatim（結構化確認）
    3️⃣ ArcGIS（最終保障，最精確）
    """
    print(f"🔍 Geocode search: {request.query}")
    
    # ========== 第一層：Photon（快速且免費）==========
    print("   [1️⃣ Photon] 嘗試中...")
    photon_results = await geocode_with_photon(request.query, request.limit)
    if photon_results and len(photon_results) > 0:
        for r in photon_results:
            r["source"] = "photon"
        print(f"   ✅ Photon 找到 {len(photon_results)} 個結果")
        return {"results": photon_results, "source": "photon"}
    
    # ========== 第二層：Nominatim（結構化搜尋）==========
    print("   [2️⃣ Nominatim] Photon 無結果，嘗試 Nominatim...")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": request.query,
                    "format": "json",
                    "limit": request.limit,
                    "addressdetails": 1,
                    "accept-language": "zh-TW,ja,en"
                },
                headers={"User-Agent": "RyanTravelApp/2.0"}
            )
            data = res.json()
            if data and len(data) > 0:
                results = []
                for item in data:
                    results.append({
                        "lat": float(item["lat"]),
                        "lng": float(item["lon"]),
                        "name": item.get("name") or item.get("display_name", "").split(",")[0],
                        "address": item.get("display_name", ""),
                        "type": item.get("type", "place"),
                        "source": "nominatim"
                    })
                print(f"   ✅ Nominatim 找到 {len(results)} 個結果")
                return {"results": results, "source": "nominatim"}
    except Exception as e:
        print(f"   ⚠️ Nominatim error: {e}")
    
    # ========== 第三層：ArcGIS（最終保障）==========
    if ARCGIS_API_KEY:
        print("   [3️⃣ ArcGIS] 前兩層無結果，使用最終保障...")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(
                    "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
                    params={
                        "SingleLine": request.query,
                        "f": "json",
                        "outFields": "PlaceName,Place_addr,Type",
                        "maxLocations": request.limit,
                        "token": ARCGIS_API_KEY
                    }
                )
                data = res.json()
                if data.get("candidates") and len(data["candidates"]) > 0:
                    results = []
                    for c in data["candidates"]:
                        results.append({
                            "lat": c["location"]["y"],
                            "lng": c["location"]["x"],
                            "name": c.get("attributes", {}).get("PlaceName", request.query),
                            "address": c.get("attributes", {}).get("Place_addr", ""),
                            "type": c.get("attributes", {}).get("Type", "place"),
                            "source": "arcgis"
                        })
                    print(f"   ✅ ArcGIS 找到 {len(results)} 個結果")
                    return {"results": results, "source": "arcgis"}
        except Exception as e:
            print(f"   ⚠️ ArcGIS error: {e}")
    
    # ========== 全部失敗 ==========
    print("   ❌ 三層搜尋均無結果")
    return {"results": [], "source": "none"}


@app.post("/api/geocode/reverse")
async def geocode_reverse(request: GeocodeReverseRequest):
    """反向地理編碼：座標 → 地名
    
    使用 Photon（免費無限制）
    """
    print(f"🔍 Reverse geocode: ({request.lat}, {request.lng})")
    
    # 使用 Photon 反向地理編碼
    result = await reverse_geocode_with_photon(request.lat, request.lng)
    if result:
        return {"success": True, **result}
    
    return {"success": False, "name": "Unknown", "address": ""}


@app.post("/api/parse-md")
async def parse_markdown(
    request: MarkdownImportRequest,
    api_key: str = Depends(get_gemini_key)
):
    print("📝 收到 Markdown 匯入請求...")
    
    try:
        # 修改 Prompt，明確告知 AI 如果有工具就用，沒工具就估算
        prompt = f"""
        你是一個專業的旅遊資料分析師。請「完整」分析 Markdown 行程表，轉換為結構化 JSON。
        ⚠️ 重要：請勿遺漏任何表格、注意事項、花費、票券資訊！
        
        Markdown 內容：
        {request.markdown_text}

        任務：
        1. **解析詳細行程 (items)**
           - 每個時間點的活動都要抓取
        
        2. **關鍵：連結優先 (Link Priority)**
           - 如果 Markdown 中的地點有超連結 (例如 `[地點名](https://maps...)`)，請務必將該網址提取到 `link_url` 欄位
           - 這是最高優先級的導航依據
        
        3. **關鍵：地理資訊 (Location)**
           - 即使有連結，還是請提供 `lat`, `lng` 作為地圖標記備用
           - 如果是「飛機上」、「家中」，lat/lng 請給 null
           - `place_name` 請使用「Google Maps 上的正式店名」
        
        4. **關鍵：附屬表格 (Sub Items)**
           - 請精準抓取行程下方的表格 (如超市排名)，解析為 `sub_items`
           - `sub_items` 格式: {{ "name": "店名", "desc": "特色/說明", "link": "連結" }}
        
        5. **🆕 關鍵：每日注意事項 (Day Notes)**
           - 抓取「注意事項」表格，包含重點提醒如入境時間、交通轉乘、出站指引等
           - 格式: `day_notes`: {{ "day_number": [ {{ "icon": "⚠️", "title": "標題", "content": "內容" }} ] }}
        
        6. **🆕 關鍵：每日預估花費 (Day Costs)**
           - 抓取「預估花費」表格的每個項目和金額
           - 格式: `day_costs`: {{ "day_number": [ {{ "item": "交通", "amount": "¥1,200", "note": "備註" }} ] }}
        
        7. **🆕 關鍵：交通票券 (Day Tickets)**
           - 抓取「交通票券」區塊的票券資訊
           - 格式: `day_tickets`: {{ "day_number": [ {{ "name": "京成 ACCESS特急", "price": "¥1,200", "note": "單程，刷 IC" }} ] }}
        
        8. 每日主要城市 (daily_locations): 判斷每一天的主要城市中心點
        
        9. 分類 category 請用小寫英文:
           - 'transport': 機場、車站、租車、搭車移動
           - 'food': 餐廳、咖啡廳、超商、小吃
           - 'hotel': 住宿、飯店、民宿
           - 'shopping': 購物中心、商店街、藥妝店
           - 'sightseeing': 景點、神社、公園
        
        10. 如果有 "必吃"、"預約"、"推薦" 等關鍵字，放入 tags 陣列
        
        11. **日期解析**
            - 從 Markdown 中找出開始日期和結束日期
            - 「Day 1 (2/2)」→ start_date: "2026-02-02"
            - 沒有年份則預設 2026 年
        
        12. **行程標題**
            - 從 Markdown 標題推斷行程名稱

        回傳 JSON 格式範例:
        {{
            "title": "2026 東京×橫濱 15日遊",
            "start_date": "2026-02-02",
            "end_date": "2026-02-16",
            "items": [
                {{ 
                    "day_number": 1, 
                    "time_slot": "10:00", 
                    "place_name": "三谷ビル", 
                    "category": "hotel",
                    "desc": "民宿 Check-in...",
                    "lat": 35.123, 
                    "lng": 139.123,
                    "original_name": "", 
                    "tags": ["預約"], 
                    "cost_amount": 0, 
                    "reservation_code": "",
                    "link_url": "https://maps.google.com/...",
                    "sub_items": []
                }}
            ],
            "daily_locations": {{
                "1": {{ "name": "東京", "lat": 35.6895, "lng": 139.6917 }}
            }},
            "day_notes": {{
                "1": [
                    {{ "icon": "✈️", "title": "機場入境", "content": "成田機場入境約需 1.5-2 小時" }},
                    {{ "icon": "🚇", "title": "ACCESS特急", "content": "搭 ACCESS特急直達押上，車程 58 分" }}
                ]
            }},
            "day_costs": {{
                "1": [
                    {{ "item": "交通", "amount": "¥1,200", "note": "" }},
                    {{ "item": "宵夜", "amount": "¥1,000-2,000", "note": "" }}
                ]
            }},
            "day_tickets": {{
                "1": [
                    {{ "name": "京成 ACCESS特急", "price": "¥1,200", "note": "單程，刷 IC" }}
                ]
            }}
        }}
        
        只回傳 JSON，不要 Markdown 標記。請確保所有表格資訊都被解析到！
        """
        
        # 🆕 v3.5: 使用統一的 Model Manager
        from services.model_manager import call_extraction
        raw_text = await call_extraction(api_key, prompt, intent_type="EXTRACTION")
        
        # 清理回傳的文字 (去除 ```json 等標記)
        cleaned_text = raw_text.replace("```json", "").replace("```", "").strip()
        parsed_data = json.loads(cleaned_text)
        
        # parsed_data 現在是 { "items": [...], "daily_locations": {...} }
        items = parsed_data.get("items", [])
        
        # 🌍 自動為沒有座標的地點做地理編碼
        if items:
            print(f"🌍 開始地理編碼 {len(items)} 個地點...")
            geocoded_count = 0
            for item in items:
                place = item.get("place_name", "")
                if place and not item.get("lat"):
                    coords = await geocode_place(place)
                    if coords:
                        item["lat"] = coords["lat"]
                        item["lng"] = coords["lng"]
                        geocoded_count += 1
            print(f"✅ 成功地理編碼 {geocoded_count} 個地點")
        
        return {
            "status": "success",
            "title": parsed_data.get("title", "New Trip"),
            "start_date": parsed_data.get("start_date"),
            "end_date": parsed_data.get("end_date"),
            "items": items,
            "daily_locations": parsed_data.get("daily_locations", {}),
            # 🆕 新增：每日注意事項、預估花費、交通票券
            "day_notes": parsed_data.get("day_notes", {}),
            "day_costs": parsed_data.get("day_costs", {}),
            "day_tickets": parsed_data.get("day_tickets", {})
        }
        
    except Exception as e:
        print(f"🔥 Parsing Error: {e}")
        raise HTTPException(status_code=400, detail=f"AI Parse Error: {str(e)}")


# 🔥 AI 生成行程 API
@app.post("/api/generate-trip")
async def generate_trip(
    request: GenerateTripRequest,
    api_key: str = Depends(get_gemini_key)
):
    print(f"🤖 AI 生成請求: {request.destination} ({request.days}天)")
    
    try:
        prompt = f"""
        你是專業導遊。請為我規劃一個從 {request.origin} 出發，前往 {request.destination} 的 {request.days} 天行程。
        
        我的興趣重點：{request.interests}
        
        任務：
        1. 規劃每日行程 (09:00 - 21:00)，路線要順暢。
        2. **關鍵：地理資訊**
           - 請使用 Google Maps 工具查詢每個地點的精準經緯度 (lat, lng)。
           - 請提供地點的日文原名 (original_name)。
        3. 詳細說明 (desc)：包含推薦理由、必吃必買。
        4. 每日主要城市 (daily_locations)：判斷每天的住宿城市中心點。
        5. 分類 (category)：務必使用 transport, food, sightseeing, shopping, hotel。

        回傳 JSON 格式 (與 parse-md 格式一致):
        {{
            "items": [
                {{ "day_number": 1, "time_slot": "10:00", "place_name": "...", "original_name": "...", "lat": ..., "lng": ..., "category": "sightseeing", "desc": "..." }}
            ],
            "daily_locations": {{
                "1": {{ "name": "東京", "lat": 35.6895, "lng": 139.6917 }}
            }}
        }}
        """
        
        # 🆕 v3.5: 使用統一的 Model Manager
        from services.model_manager import call_extraction
        raw_text = await call_extraction(api_key, prompt, intent_type="PLANNING")
        
        cleaned_text = raw_text.replace("```json", "").replace("```", "").strip()
        parsed_data = json.loads(cleaned_text)
        
        return {"status": "success", "data": parsed_data}
        
    except Exception as e:
        print(f"🔥 Gen Error: {e}")
        raise HTTPException(status_code=400, detail=f"生成失敗: {str(e)}")


# 簡化的 AI 生成請求 (只接受 prompt)
class SimplePromptRequest(BaseModel):
    prompt: str

# 🔥 簡化版 AI 生成 API (接受自由 prompt)
@app.post("/api/ai-generate")
async def ai_generate(
    request: SimplePromptRequest,
    api_key: str = Depends(get_gemini_key)
):
    print(f"🤖 AI 簡易生成請求: {request.prompt[:50]}...")
    
    try:
        prompt = f"""
        你是「Ryan 旅遊達人」👋 一位熱愛探索當地美食和秘境的資深玩家！
        
        用戶跟你說：{request.prompt}
        
        請發揮你的專業，規劃一個讓用戶驚艷的行程！
        每個地點的 desc 請寫得有溫度，像跟朋友分享私房景點一樣 ❤️
        
        【必須遵守的技術規則】
        1. 如果使用者指定了天數（如"5天"、"五日"），你必須**嚴格遵守**，不可多也不可少
        2. day_number 從 1 開始，最大值等於使用者指定的天數
        3. 如果使用者沒有指定天數，預設規劃 3 天
        4. 每日行程時間 (09:00 - 21:00)，路線要順暢
        5. 分類 (category)：務必使用 transport, food, sightseeing, shopping, hotel
        
        回傳 JSON 格式：
        {{
            "title": "行程標題",
            "start_date": "2025-01-01",
            "end_date": "2025-01-05",
            "items": [
                {{ "day_number": 1, "time_slot": "10:00", "place_name": "...", "category": "sightseeing", "desc": "..." }}
            ]
        }}
        
        ⚠️ 再次提醒：day_number 不可超過使用者指定的天數！
        """
        
        # 🆕 v3.5: 使用統一的 Model Manager
        from services.model_manager import call_extraction
        raw_text = await call_extraction(api_key, prompt, intent_type="PLANNING")
        
        cleaned_text = raw_text.replace("```json", "").replace("```", "").strip()
        parsed_data = json.loads(cleaned_text)
        
        # 🌍 自動為每個地點查詢經緯度
        if "items" in parsed_data:
            print(f"🌍 開始地理編碼 {len(parsed_data['items'])} 個地點...")
            geocoded_count = 0
            for item in parsed_data["items"]:
                place = item.get("place_name", "")
                if place and not item.get("lat"):
                    coords = await geocode_place(place)
                    if coords:
                        item["lat"] = coords["lat"]
                        item["lng"] = coords["lng"]
                        geocoded_count += 1
            print(f"✅ 成功地理編碼 {geocoded_count} 個地點")
        
        return parsed_data
        
    except Exception as e:
        print(f"🔥 AI Gen Error: {e}")
        raise HTTPException(status_code=400, detail=f"生成失敗: {str(e)}")


# --- 新增：存檔 API 需要的資料模型 ---
class ItineraryItem(BaseModel):
    day_number: int
    time_slot: str
    place_name: str
    original_name: Optional[str] = None
    category: str
    desc: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    cost_amount: Optional[float] = 0
    tags: Optional[List[str]] = []  # 新增：標籤
    reservation_code: Optional[str] = ""  # 新增：預約代碼
    # 👇 新增：用來存表格資料 (例如超市列表)
    sub_items: List[dict] = []
    # 👇 新增：使用者提供的連結
    link_url: Optional[str] = None

class SaveItineraryRequest(BaseModel):
    title: str
    creator_name: str
    user_id: str
    items: List[ItineraryItem]
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    daily_locations: Optional[dict] = {}
    # 👇 新增：每日貼士資訊
    day_notes: Optional[dict] = {}
    day_costs: Optional[dict] = {}
    day_tickets: Optional[dict] = {}

class JoinTripRequest(BaseModel):
    share_code: str
    user_id: str
    user_name: str

# 新增：手動建立行程的模型
class CreateManualTripRequest(BaseModel):
    title: str
    start_date: str
    end_date: str
    creator_name: str
    user_id: str
    cover_image: Optional[str] = None

# 新增：更新項目模型
class UpdateItemRequest(BaseModel):
    time_slot: Optional[str] = None
    place_name: Optional[str] = None
    notes: Optional[str] = None
    cost_amount: Optional[float] = 0
    # 👇 座標欄位
    lat: Optional[float] = None
    lng: Optional[float] = None
    # 👇 備忘錄欄位
    memo: Optional[str] = None
    # 👇 新增：連結列表 (sub_items)
    sub_items: Optional[List[dict]] = None
    # 👇 新增：圖片網址
    image_url: Optional[str] = None
    # 👇 新增：分類與標籤
    category: Optional[str] = None
    tags: Optional[List[str]] = None

# 新增：單筆行程新增模型
class CreateItemRequest(BaseModel):
    itinerary_id: str
    day_number: int
    time_slot: str
    place_name: str
    category: str
    notes: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

# 產生 4 位數房間代碼
def generate_room_code():
    return ''.join(random.choices(string.digits, k=4))

# 🔥 功能 3: 儲存行程到資料庫
@app.post("/api/save-itinerary")
async def save_itinerary(request: SaveItineraryRequest):
    print(f"💾 正在儲存行程: {request.title}...")
    print(f"   創建者: {request.creator_name}")
    print(f"   User ID: {request.user_id}")
    print(f"   項目數量: {len(request.items)}")
    
    try:
        # 1. 產生房間號
        room_code = generate_room_code()
        
        # 🆕 自動計算 end_date (如果未提供)
        start_date = request.start_date or "2026-01-01"
        if request.end_date:
            end_date = request.end_date
        elif request.items:
            # 從 items 中找最大的 day_number，計算 end_date
            max_day = max(item.day_number for item in request.items)
            from datetime import datetime, timedelta
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = start + timedelta(days=max_day - 1)
            end_date = end.strftime("%Y-%m-%d")
            print(f"   🆕 自動計算 end_date: {end_date} (Day {max_day})")
        else:
            end_date = start_date
        
        # 2. 建立主行程 (Parent) - 將每日資訊存入 content
        trip_data = {
            "title": request.title,
            "creator_name": request.creator_name,
            "created_by": request.user_id,
            "share_code": room_code,
            "start_date": start_date,
            "end_date": end_date,
            "status": "active",
            # 👇 存入 JSONB 欄位: 包含 daily_locations 及新的 daily tips
            "content": {
                "daily_locations": request.daily_locations,
                "day_notes": request.day_notes,
                "day_costs": request.day_costs,
                "day_tickets": request.day_tickets
            }
        }
        
        trip_res = supabase.table("itineraries").insert(trip_data).execute()
        
        if not trip_res.data:
            raise HTTPException(status_code=500, detail="無法建立主行程")
            
        trip_id = trip_res.data[0]["id"]
        print(f"✅ 主行程建立成功 ID: {trip_id}, 房間號: {room_code}")

        # 3. 自動把創建者加入成員列表
        member_data = {
            "itinerary_id": trip_id,
            "user_id": request.user_id,
            "user_name": request.creator_name
        }
        supabase.table("trip_members").insert(member_data).execute()

        # 4. 建立細項 (Children)
        items_data = []
        for item in request.items:
            items_data.append({
                "itinerary_id": trip_id,
                "day_number": item.day_number,
                "time_slot": item.time_slot,
                "place_name": item.place_name,
                "original_name": item.original_name,
                "category": item.category,
                "notes": item.desc,
                "location_lat": item.lat,
                "location_lng": item.lng,
                "cost_amount": item.cost_amount,
                "reservation_code": item.reservation_code,  # 新增
                "tags": item.tags,  # 新增：需要 DB 有 tags (text[]) 欄位
                # 👇 新增：儲存附屬表格
                "sub_items": item.sub_items,
                # 👇 新增：儲存使用者連結
                "link_url": item.link_url
            })
            
        # 批次寫入
        if items_data:
            print(f"   📦 準備插入 {len(items_data)} 個細項...")
            try:
                supabase.table("itinerary_items").insert(items_data).execute()
                print(f"   ✅ 細項插入成功!")
            except Exception as item_err:
                print(f"   ❌ 細項插入失敗: {item_err}")
                # 嘗試逐個插入以找出問題項目
                for i, item in enumerate(items_data):
                    try:
                        supabase.table("itinerary_items").insert(item).execute()
                        print(f"      ✅ Item {i+1} OK")
                    except Exception as single_err:
                        print(f"      ❌ Item {i+1} FAILED: {single_err}")
                        print(f"         Data: {item}")
                raise item_err
            
        return {"status": "success", "trip_id": trip_id, "share_code": room_code}

    except Exception as e:
        import traceback
        print(f"🔥 Save Error: {e}")
        print(f"   Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 3.1: 加入行程
@app.post("/api/join-trip")
async def join_trip(request: JoinTripRequest):
    print(f"🚪 使用者 {request.user_name} 嘗試加入房間: {request.share_code}")
    
    try:
        # 1. 找行程
        trip_res = supabase.table("itineraries").select("id, title").eq("share_code", request.share_code).execute()
        
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="找不到此行程代碼")
            
        trip = trip_res.data[0]
        print(f"✅ 找到行程: {trip['title']}")
        
        # 2. 加入成員 (如果已加入會報錯，我們用 try 接住忽略)
        try:
            supabase.table("trip_members").insert({
                "itinerary_id": trip['id'],
                "user_id": request.user_id,
                "user_name": request.user_name
            }).execute()
            print(f"✅ 成功加入成員")
        except Exception as member_err:
            print(f"ℹ️ 使用者可能已經是成員: {member_err}")
            pass  # 已經加入過就算了

        return {"status": "success", "trip": trip}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Join Trip Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 3.2: 取得我參與的所有行程
@app.get("/api/trips")
async def get_trips(user_id: str = Header(None, alias="X-User-ID")):
    """透過 Header 傳入 user_id，返回該使用者參與的所有行程"""
    print(f"📋 查詢使用者 {user_id} 的所有行程")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="需要提供 X-User-ID Header")
    
    try:
        # 這是 SQL 的 Join 概念：找出 trip_members 裡有我 user_id 的所有 itinerary
        res = supabase.table("trip_members")\
            .select("itinerary_id, itineraries(*)")\
            .eq("user_id", user_id)\
            .execute()
            
        # 整理資料結構
        trips = []
        for item in res.data:
            if item.get('itineraries'):  # 確保關聯存在
                trips.append(item['itineraries'])
        
        print(f"✅ 找到 {len(trips)} 個行程")
        return trips
        
    except Exception as e:
        print(f"🔥 Get Trips Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 3.3: 刪除整趟行程 (誠實版)
@app.delete("/api/trips/{trip_id}")
async def delete_trip(trip_id: str):
    try:
        print(f"🗑️ 嘗試刪除行程 ID: {trip_id}")
        
        # 1. 先刪除所有細項
        supabase.table("itinerary_items").delete().eq("itinerary_id", trip_id).execute()
        print("   ✅ 細項已刪除")
        
        # 2. 刪除所有成員關係
        supabase.table("trip_members").delete().eq("itinerary_id", trip_id).execute()
        print("   ✅ 成員關係已刪除")
        
        # 3. 最後刪除主行程
        res = supabase.table("itineraries").delete().eq("id", trip_id).execute()
        
        # 關鍵檢查：如果 data 是空的，代表根本沒刪到東西
        if not res.data:
            print(f"❌ 刪除失敗：資料庫回傳空值 (ID: {trip_id})")
            # 可能原因：ID 不存在，或是 RLS 權限擋住了
            raise HTTPException(status_code=404, detail="刪除失敗：找不到該行程或無權限")
        
        print(f"   ✅ 主行程已刪除: {res.data}")
        return {"status": "success", "message": "Trip deleted", "deleted_data": res.data}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 3.4: 追加細項到現有行程
class AppendItemsRequest(BaseModel):
    items: List[ItineraryItem]

@app.post("/api/trips/{trip_id}/items")
async def append_items_to_trip(trip_id: str, request: AppendItemsRequest):
    """將新的細項追加到現有行程"""
    print(f"➕ 追加 {len(request.items)} 個細項到行程 {trip_id}")
    
    try:
        # 1. 確認行程存在
        trip_res = supabase.table("itineraries").select("id, title").eq("id", trip_id).execute()
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="找不到此行程")
        
        print(f"   ✅ 找到行程: {trip_res.data[0]['title']}")
        
        # 2. 準備細項資料
        items_data = []
        for item in request.items:
            items_data.append({
                "itinerary_id": trip_id,
                "day_number": item.day_number,
                "time_slot": item.time_slot,
                "place_name": item.place_name,
                "original_name": item.original_name,
                "category": item.category,
                "notes": item.desc,
                "location_lat": item.lat,
                "location_lng": item.lng,
                "cost_amount": item.cost_amount,
                "reservation_code": item.reservation_code,
                "tags": item.tags
            })
        
        # 3. 批次寫入
        if items_data:
            supabase.table("itinerary_items").insert(items_data).execute()
            print(f"   ✅ 已追加 {len(items_data)} 個細項")
        
        return {"status": "success", "added_count": len(items_data)}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Append Items Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 4: 讀取最新行程 (給主畫面用)
@app.get("/api/itinerary/latest")
async def get_latest_itinerary():
    try:
        # 1. 抓最新的一個行程
        trip_res = supabase.table("itineraries").select("*").order("created_at", desc=True).limit(1).execute()
        
        if not trip_res.data:
            return None
            
        trip = trip_res.data[0]
        
        # 2. 抓該行程的所有細項
        items_res = supabase.table("itinerary_items").select("*").eq("itinerary_id", trip["id"]).order("day_number").order("time_slot").execute()
        
        # 3. 整理成前端要的格式
        days_map = {}
        # ⚠️ 修正：如果 items_res.data 是空的 (手動建立時)，這裡迴圈不會跑，days_map 是空的
        if items_res.data:
            for item in items_res.data:
                d = item["day_number"]
                if d not in days_map:
                    days_map[d] = []
                
                days_map[d].append({
                    "id": item["id"],  # 👈 關鍵！補上這行，前端才知道要改哪一筆
                    "time": item["time_slot"][:5] if item["time_slot"] else "00:00",
                    "place": item["place_name"],
                    "original_name": item["original_name"],
                    "category": item["category"] or "sightseeing",
                    "desc": item["notes"],
                    "memo": item.get("memo") or "",  # 👈 新增這行，讀取備忘錄
                    "lat": item["location_lat"],
                    "lng": item["location_lng"],
                    "cost": item["cost_amount"],
                    "reservation_code": item.get("reservation_code"),
                    "tags": item.get("tags", []),
                    # 👇👇👇 補上這兩行！沒有這兩行，前端就是瞎子！
                    "link_url": item.get("link_url"), 
                    "sub_items": item.get("sub_items") or []
                })
            
        # 轉成陣列
        days_array = []
        for d in sorted(days_map.keys()):
            days_array.append({
                "day": d,
                "activities": days_map[d]
            })
            
        return {
            "id": trip["id"],
            "title": trip["title"],
            "creator": trip.get("creator_name", "Guest"),
            "start_date": trip["start_date"],  # 👈 關鍵！補上這行
            "end_date": trip.get("end_date"),  # 🐛 FIX: 補上缺失的 end_date
            "share_code": trip.get("share_code", ""),  # 順便補上分享碼
            # 👇 讀取並回傳
            "daily_locations": (trip.get("content") or {}).get("daily_locations", {}),
            # 🆕 每日提示
            "day_notes": (trip.get("content") or {}).get("day_notes", {}),
            "day_costs": (trip.get("content") or {}).get("day_costs", {}),
            "day_tickets": (trip.get("content") or {}).get("day_tickets", {}),
            
            "flight_info": trip.get("flight_info") or {},  # 👈 新增航班資訊
            "hotel_info": trip.get("hotel_info") or {},    # 👈 新增住宿資訊
            # 即使 days_map 是空的，也要回傳空陣列，不然前端 map 會爆
            "days": [{"day": d, "activities": days_map[d]} for d in sorted(days_map.keys())] if days_map else []
        }

    except Exception as e:
        print(f"Fetch Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 🆕 獲取特定行程 (by ID)
@app.get("/api/trips/{trip_id}")
async def get_trip_by_id(trip_id: str):
    try:
        # 1. 查詢指定的行程
        trip_res = supabase.table("itineraries").select("*").eq("id", trip_id).execute()
        
        if not trip_res.data or len(trip_res.data) == 0:
            raise HTTPException(status_code=404, detail="Trip not found")
            
        trip = trip_res.data[0]
        
        # 2. 抓該行程的所有細項
        items_res = supabase.table("itinerary_items").select("*").eq("itinerary_id", trip["id"]).order("day_number").order("time_slot").execute()
        
        # 3. 整理成前端要的格式
        days_map = {}
        if items_res.data:
            for item in items_res.data:
                d = item["day_number"]
                if d not in days_map:
                    days_map[d] = []
                
                days_map[d].append({
                    "id": item["id"],
                    "time": item["time_slot"][:5] if item["time_slot"] else "00:00",
                    "place": item["place_name"],
                    "original_name": item["original_name"],
                    "category": item["category"] or "sightseeing",
                    "desc": item["notes"],
                    "memo": item.get("memo") or "",
                    "lat": item["location_lat"],
                    "lng": item["location_lng"],
                    "cost": item["cost_amount"],
                    "reservation_code": item.get("reservation_code"),
                    "tags": item.get("tags", []),
                    "link_url": item.get("link_url"), 
                    "sub_items": item.get("sub_items") or [],
                    "image_url": item.get("image_url")
                })
            
        return {
            "id": trip["id"],
            "title": trip["title"],
            "creator": trip.get("creator_name", "Guest"),
            "start_date": trip["start_date"],
            "end_date": trip.get("end_date"),  # 🐛 FIX: 補上缺失的 end_date
            "share_code": trip.get("share_code", ""),
            "cover_image": trip.get("cover_image"),
            # 🚑 修復：先判斷 content 是否為 None，再取值
            "daily_locations": (trip.get("content") or {}).get("daily_locations", {}),
            # 🆕 每日提示
            "day_notes": (trip.get("content") or {}).get("day_notes", {}),
            "day_costs": (trip.get("content") or {}).get("day_costs", {}),
            "day_tickets": (trip.get("content") or {}).get("day_tickets", {}),

            "flight_info": trip.get("flight_info") or {},
            "hotel_info": trip.get("hotel_info") or {},
            "days": [{"day": d, "activities": days_map[d]} for d in sorted(days_map.keys())] if days_map else []
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Fetch Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 🔥 功能 6: 手動建立空白行程
@app.post("/api/trip/create-manual")
async def create_manual_trip(request: CreateManualTripRequest):
    try:
        room_code = generate_room_code()
        
        trip_data = {
            "title": request.title,
            "creator_name": request.creator_name,
            "created_by": request.user_id,
            "share_code": room_code,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "status": "active",
            "content": {},  # 👈 新增：給個空物件，不要讓它是 NULL
            "flight_info": {},
            "hotel_info": {},
            "cover_image": request.cover_image
        }
        
        trip_res = supabase.table("itineraries").insert(trip_data).execute()
        trip_id = trip_res.data[0]['id']

        # 加入成員
        supabase.table("trip_members").insert({
            "itinerary_id": trip_id,
            "user_id": request.user_id,
            "user_name": request.creator_name
        }).execute()

        return {"status": "success", "trip_id": trip_id, "share_code": room_code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 7: 修改單一細項
@app.patch("/api/items/{item_id}")
async def update_item(item_id: str, request: UpdateItemRequest):
    print(f"📝 嘗試更新細項 {item_id}: {request}")
    try:
        # 只更新有值的欄位
        data = {}
        if request.time_slot is not None: data["time_slot"] = request.time_slot
        if request.place_name is not None: data["place_name"] = request.place_name
        if request.notes is not None: data["notes"] = request.notes
        if request.cost_amount is not None: data["cost_amount"] = request.cost_amount
        # 👇 寫入資料庫
        if request.lat is not None: data["location_lat"] = request.lat
        if request.lng is not None: data["location_lng"] = request.lng
        # 👇 新增：處理備忘錄
        if request.memo is not None: data["memo"] = request.memo
        # 👇 新增：處理 sub_items (連結列表)
        if request.sub_items is not None: data["sub_items"] = request.sub_items
        # 👇 新增：處理分類與標籤
        if request.category is not None: data["category"] = request.category
        if request.tags is not None: data["tags"] = request.tags
        
        if not data:
            print("⚠️ 沒有資料需要更新")
            return {"status": "no_change"}

        res = supabase.table("itinerary_items").update(data).eq("id", item_id).execute()
        
        if not res.data:
            print(f"❌ 更新失敗：找不到 ID {item_id}")
            raise HTTPException(status_code=404, detail="Item not found")

        print("✅ 更新成功")
        return {"status": "success", "data": res.data}
    except Exception as e:
        print(f"🔥 Update Item Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 8: 刪除單一細項
@app.delete("/api/items/{item_id}")
async def delete_item(item_id: str):
    print(f"🗑️ 嘗試刪除細項 {item_id}")
    try:
        res = supabase.table("itinerary_items").delete().eq("id", item_id).execute()
        
        if not res.data:
             print(f"❌ 刪除失敗：找不到 ID {item_id}")
             # 這裡不噴錯，因為可能已經被刪掉了
             return {"status": "success", "message": "Item might already be deleted"}
             
        print("✅ 刪除成功")
        return {"status": "success"}
    except Exception as e:
        print(f"🔥 Delete Item Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 8.1: 刪除整天行程
@app.delete("/api/trips/{trip_id}/days/{day_number}")
async def delete_day(trip_id: str, day_number: int):
    print(f"🗑️ 嘗試刪除行程 {trip_id} 的第 {day_number} 天")
    try:
        # 1. 刪除該天的所有細項
        res = supabase.table("itinerary_items")\
            .delete()\
            .eq("itinerary_id", trip_id)\
            .eq("day_number", day_number)\
            .execute()
        
        deleted_count = len(res.data) if res.data else 0
        print(f"   🗑️ 已刪除 {deleted_count} 個細項")
        
        # 2. 調整後面天數的 day_number (把 day_number > 刪除天數的都往前移)
        remaining = supabase.table("itinerary_items")\
            .select("id, day_number")\
            .eq("itinerary_id", trip_id)\
            .gt("day_number", day_number)\
            .execute()
        
        for item in remaining.data:
            new_day = item["day_number"] - 1
            supabase.table("itinerary_items")\
                .update({"day_number": new_day})\
                .eq("id", item["id"])\
                .execute()
        
        print(f"   📅 已調整 {len(remaining.data)} 個細項的天數")
        
        # 3. 更新行程的 end_date (減少一天)
        trip = supabase.table("itineraries").select("start_date, end_date").eq("id", trip_id).single().execute()
        if trip.data and trip.data.get("end_date"):
            from datetime import datetime, timedelta
            end_date = datetime.strptime(trip.data["end_date"], "%Y-%m-%d")
            new_end = end_date - timedelta(days=1)
            supabase.table("itineraries")\
                .update({"end_date": new_end.strftime("%Y-%m-%d")})\
                .eq("id", trip_id)\
                .execute()
            print(f"   📆 已更新 end_date: {trip.data['end_date']} → {new_end.strftime('%Y-%m-%d')}")
        
        return {"status": "success", "deleted_items": deleted_count, "adjusted_items": len(remaining.data)}
    except Exception as e:
        print(f"🔥 Delete Day Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 🆕 功能 8.2: 新增天數
class AddDayRequest(BaseModel):
    position: str = "end"  # "end" 或 "before:N" (例如 "before:3")

@app.post("/api/trips/{trip_id}/days")
async def add_day(trip_id: str, request: AddDayRequest):
    print(f"➕ 嘗試新增天數到行程 {trip_id}, 位置: {request.position}")
    try:
        from datetime import datetime, timedelta
        
        # 1. 取得現有行程資訊
        trip = supabase.table("itineraries").select("start_date, end_date").eq("id", trip_id).single().execute()
        if not trip.data:
            raise HTTPException(status_code=404, detail="行程不存在")
        
        # 2. 計算目前的天數
        items = supabase.table("itinerary_items").select("day_number").eq("itinerary_id", trip_id).execute()
        current_max_day = max([item["day_number"] for item in items.data]) if items.data else 1
        
        # 3. 根據 position 處理
        if request.position == "end":
            # 新增到最後一天之後 - 不需要移動現有項目
            new_day = current_max_day + 1
            print(f"   ➕ 新增 Day {new_day} 到結尾")
        elif request.position.startswith("before:"):
            # 插入到指定天之前 - 需要移動現有項目
            insert_before = int(request.position.split(":")[1])
            if insert_before < 1:
                insert_before = 1
            
            # 將 day_number >= insert_before 的全部 +1
            items_to_shift = supabase.table("itinerary_items")\
                .select("id, day_number")\
                .eq("itinerary_id", trip_id)\
                .gte("day_number", insert_before)\
                .order("day_number", desc=True)\
                .execute()
            
            for item in items_to_shift.data:
                supabase.table("itinerary_items")\
                    .update({"day_number": item["day_number"] + 1})\
                    .eq("id", item["id"])\
                    .execute()
            
            new_day = insert_before
            print(f"   ➕ 插入 Day {new_day}, 移動了 {len(items_to_shift.data)} 個項目")
        else:
            raise HTTPException(status_code=400, detail="無效的 position 格式")
        
        # 4. 更新 end_date (增加一天)
        if trip.data.get("end_date"):
            end_date = datetime.strptime(trip.data["end_date"], "%Y-%m-%d")
            new_end = end_date + timedelta(days=1)
            supabase.table("itineraries")\
                .update({"end_date": new_end.strftime("%Y-%m-%d")})\
                .eq("id", trip_id)\
                .execute()
            print(f"   📆 已更新 end_date: {trip.data['end_date']} → {new_end.strftime('%Y-%m-%d')}")
        elif trip.data.get("start_date"):
            # 如果沒有 end_date，根據 start_date 和新的天數計算
            start_date = datetime.strptime(trip.data["start_date"], "%Y-%m-%d")
            new_end = start_date + timedelta(days=current_max_day)  # current_max_day + 1 - 1
            supabase.table("itineraries")\
                .update({"end_date": new_end.strftime("%Y-%m-%d")})\
                .eq("id", trip_id)\
                .execute()
            print(f"   📆 新設定 end_date: {new_end.strftime('%Y-%m-%d')}")
        
        return {"status": "success", "new_day": new_day, "total_days": current_max_day + 1}
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Add Day Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 9: 更新行程的每日地點
class UpdateLocationRequest(BaseModel):
    day: int
    name: str
    lat: float
    lng: float

@app.patch("/api/trips/{trip_id}/location")
async def update_trip_location(trip_id: str, request: UpdateLocationRequest):
    try:
        # 1. 先讀取現有的 content
        res = supabase.table("itineraries").select("content").eq("id", trip_id).single().execute()
        content = res.data['content'] or {}
        
        # 2. 更新該日期的地點
        if 'daily_locations' not in content:
            content['daily_locations'] = {}
        
        content['daily_locations'][str(request.day)] = {
            "name": request.name,
            "lat": request.lat,
            "lng": request.lng
        }
        
        # 3. 寫回資料庫
        supabase.table("itineraries").update({"content": content}).eq("id", trip_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 10: 單筆行程新增
@app.post("/api/items")
async def create_item(request: CreateItemRequest):
    """新增單筆行程項目"""
    try:
        data = {
            "itinerary_id": request.itinerary_id,
            "day_number": request.day_number,
            "time_slot": request.time_slot,
            "place_name": request.place_name,
            "category": request.category,
            "notes": request.notes,
            "location_lat": request.lat,
            "location_lng": request.lng
        }
        
        res = supabase.table("itinerary_items").insert(data).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="插入失敗")
        
        print(f"✅ 單筆行程新增成功：{request.place_name}")
        return {"status": "success", "data": res.data}
    except Exception as e:
        print(f"🔥 Create Item Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 11: 更新行程資訊 (航班/住宿)
class UpdateInfoRequest(BaseModel):
    flight_info: dict
    hotel_info: dict

@app.patch("/api/trips/{trip_id}/info")
async def update_trip_info(trip_id: str, request: UpdateInfoRequest):
    try:
        data = {
            "flight_info": request.flight_info,
            "hotel_info": request.hotel_info
        }
        supabase.table("itineraries").update(data).eq("id", trip_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 11.1: 路線規劃 API (ArcGIS + OSRM 雙引擎)
class RouteStop(BaseModel):
    lat: float
    lng: float
    name: Optional[str] = None

class RouteRequest(BaseModel):
    stops: List[RouteStop]
    mode: str = "walk"  # walk, drive, transit
    optimize: bool = False  # 是否最佳化路線順序

async def route_with_arcgis(stops: List[RouteStop], mode: str, optimize: bool) -> dict:
    """使用 ArcGIS Routing API 計算路線"""
    if not ARCGIS_API_KEY:
        raise Exception("ArcGIS API Key 未設定")
    
    # ArcGIS stops 格式: lng,lat;lng,lat
    stops_str = ";".join([f"{s.lng},{s.lat}" for s in stops])
    
    # 交通模式對應
    travel_mode = "Walking" if mode == "walk" else "Driving"
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            "https://route.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve",
            params={
                "f": "json",
                "stops": stops_str,
                "returnDirections": "true",
                "directionsLengthUnits": "esriNAUKilometers",
                "findBestSequence": "true" if optimize else "false",
                "travelMode": travel_mode,
                "token": ARCGIS_API_KEY
            }
        )
        data = res.json()
        
        if "error" in data:
            raise Exception(f"ArcGIS Error: {data['error'].get('message', 'Unknown error')}")
        
        if not data.get("routes") or not data["routes"].get("features"):
            raise Exception("No route found")
        
        route_feature = data["routes"]["features"][0]
        geometry = route_feature.get("geometry", {})
        attributes = route_feature.get("attributes", {})
        
        # 轉換成 GeoJSON 格式
        geojson = {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": [[p[0], p[1]] for p in geometry.get("paths", [[]])[0]]
            }
        }
        
        distance_km = round(attributes.get("Total_Kilometers", 0), 1)
        duration_min = round(attributes.get("Total_TravelTime", 0))
        
        return {
            "source": "arcgis",
            "route": geojson,
            "distance": f"{distance_km} km",
            "duration": f"{duration_min} 分鐘" if duration_min < 60 else f"{duration_min // 60}h {duration_min % 60}m"
        }

async def route_with_osrm(stops: List[RouteStop], mode: str) -> dict:
    """備援：使用 OSRM 計算路線"""
    coords = ";".join([f"{s.lng},{s.lat}" for s in stops])
    profile = "foot" if mode == "walk" else "car" if mode == "drive" else "foot"
    
    url = f"https://router.project-osrm.org/route/v1/{profile}/{coords}"
    print(f"   🔍 OSRM Request URL (前100字元): {url[:100]}...")
    print(f"   🔍 OSRM Stops count: {len(stops)}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:  # 增加 timeout 到 30 秒
        try:
            res = await client.get(
                url,
                params={"overview": "full", "geometries": "geojson"}
            )
            print(f"   🔍 OSRM Response status: {res.status_code}")
            
            if res.status_code != 200:
                print(f"   ❌ OSRM HTTP Error: {res.text[:200]}")
                raise Exception(f"OSRM HTTP {res.status_code}")
            
            data = res.json()
            
            if data.get("code") != "Ok":
                print(f"   ❌ OSRM API Error: {data.get('code')}, {data.get('message', 'no message')}")
                raise Exception(f"OSRM error: {data.get('code')}")
            
            if not data.get("routes"):
                print(f"   ❌ OSRM No routes in response")
                raise Exception("OSRM no routes")
            
            route = data["routes"][0]
            distance_km = round(route["distance"] / 1000, 1)
            duration_min = round(route["duration"] / 60)
            
            return {
                "source": "osrm",
                "route": {
                    "type": "Feature",
                    "properties": {},
                    "geometry": route["geometry"]
                },
                "distance": f"{distance_km} km",
                "duration": f"{duration_min} 分鐘" if duration_min < 60 else f"{duration_min // 60}h {duration_min % 60}m"
            }
        except httpx.TimeoutException:
            print(f"   ❌ OSRM Timeout after 30s")
            raise Exception("OSRM timeout")
        except Exception as e:
            print(f"   ❌ OSRM Exception: {type(e).__name__}: {e}")
            raise

@app.post("/api/route")
async def calculate_route(request: RouteRequest):
    """計算路線 (ArcGIS 優先，OSRM 備援)"""
    if len(request.stops) < 2:
        raise HTTPException(status_code=400, detail="至少需要 2 個停靠點")
    
    print(f"🛣️ 計算路線: {len(request.stops)} 個點, 模式={request.mode}, 優化={request.optimize}")
    
    # 1. 嘗試 ArcGIS
    if ARCGIS_API_KEY:
        try:
            result = await route_with_arcgis(request.stops, request.mode, request.optimize)
            print(f"   ✅ ArcGIS 路線成功: {result['distance']}, {result['duration']}")
            return result
        except Exception as e:
            print(f"   ⚠️ ArcGIS 失敗: {e}, 切換到 OSRM")
    
    # 2. 備援到 OSRM
    try:
        result = await route_with_osrm(request.stops, request.mode)
        print(f"   ✅ OSRM 路線成功: {result['distance']}, {result['duration']}")
        return result
    except Exception as e:
        print(f"   ❌ OSRM 也失敗: {e}")
        raise HTTPException(status_code=500, detail="無法計算路線")

# 🔥 功能 12: 記帳相關 API
class ExpenseRequest(BaseModel):
    itinerary_id: Optional[str] = None  # 設為 Optional 方便 Update 使用
    title: Optional[str] = None
    amount_jpy: Optional[float] = None
    exchange_rate: Optional[float] = None
    payment_method: Optional[str] = None
    category: Optional[str] = None
    is_public: Optional[bool] = None
    created_by: Optional[str] = None
    creator_name: Optional[str] = None
    card_name: Optional[str] = None
    cashback_rate: Optional[float] = 0
    image_url: Optional[str] = None
    expense_date: Optional[str] = None  # 🆕 新增：費用日期

@app.post("/api/expenses")
async def add_expense(request: ExpenseRequest):
    try:
        print(f"📝 [Expense] Creating expense: {request.title}, amount: {request.amount_jpy}, user: {request.created_by}")
        payload = {
            "itinerary_id": request.itinerary_id,
            "title": request.title,
            "amount": request.amount_jpy,
            "currency": "JPY",
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

@app.get("/api/trips/{trip_id}/expenses")
async def get_expenses(trip_id: str, user_id: str = Header(None, alias="X-User-ID")):
    try:
        # 邏輯：抓出 (該行程的所有公帳) OR (該行程中 我建立的私帳)
        res = supabase.table("expenses").select("*").eq("itinerary_id", trip_id).execute()
        all_expenses = res.data
        
        filtered = []
        for exp in all_expenses:
            # 如果是公帳 -> 顯示
            if exp['is_public']:
                filtered.append(exp)
            # 如果是私帳 -> 檢查是否為本人
            elif exp['created_by'] == user_id:
                filtered.append(exp)
                
        return filtered
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 13: 修改行程標題
class UpdateTripTitleRequest(BaseModel):
    title: str

@app.patch("/api/trips/{trip_id}/title")
async def update_trip_title(trip_id: str, request: UpdateTripTitleRequest):
    try:
        supabase.table("itineraries").update({"title": request.title}).eq("id", trip_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 14: 修改/刪除記帳 (Expense)
class UpdateExpenseRequest(BaseModel):
    title: Optional[str] = None
    amount_jpy: Optional[float] = None
    is_public: Optional[bool] = None
    payment_method: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None  # 🆕 新增
    expense_date: Optional[str] = None  # 🆕 新增

@app.patch("/api/expenses/{expense_id}")
async def update_expense(expense_id: str, request: UpdateExpenseRequest):
    try:
        data = request.dict(exclude_unset=True)
        if 'amount_jpy' in data:
            data['amount'] = data.pop('amount_jpy') # 對應 DB 欄位
        
        supabase.table("expenses").update(data).eq("id", expense_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/expenses/{expense_id}")
async def delete_expense(expense_id: str):
    try:
        supabase.table("expenses").delete().eq("id", expense_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 功能 15: 刪除用戶所有資料 (GDPR 合規)
@app.delete("/api/user/{user_id}/data")
async def delete_user_data(user_id: str):
    """
    刪除用戶的所有資料 (GDPR 合規)
    
    刪除順序（避免外鍵約束）：
    1. expenses (消費記錄)
    2. itinerary_items (行程細項)
    3. trip_members (成員關係)
    4. itineraries (主行程)
    """
    try:
        print(f"🗑️ GDPR 刪除請求: user_id = {user_id}")
        deleted_counts = {}
        
        # 1. 先取得該用戶創建的所有行程 ID
        trips_res = supabase.table("itineraries").select("id").eq("creator_id", user_id).execute()
        trip_ids = [t["id"] for t in trips_res.data] if trips_res.data else []
        print(f"   📋 找到 {len(trip_ids)} 個行程")
        
        # 2. 刪除消費記錄 (by created_by)
        exp_res = supabase.table("expenses").delete().eq("created_by", user_id).execute()
        deleted_counts["expenses"] = len(exp_res.data) if exp_res.data else 0
        print(f"   ✅ 消費記錄: {deleted_counts['expenses']} 筆")
        
        # 3. 刪除行程細項 (by itinerary_id)
        items_deleted = 0
        for trip_id in trip_ids:
            items_res = supabase.table("itinerary_items").delete().eq("itinerary_id", trip_id).execute()
            items_deleted += len(items_res.data) if items_res.data else 0
        deleted_counts["items"] = items_deleted
        print(f"   ✅ 行程細項: {items_deleted} 筆")
        
        # 4. 刪除成員關係 (by user_id)
        mem_res = supabase.table("trip_members").delete().eq("user_id", user_id).execute()
        deleted_counts["members"] = len(mem_res.data) if mem_res.data else 0
        print(f"   ✅ 成員關係: {deleted_counts['members']} 筆")
        
        # 5. 刪除主行程 (by creator_id)
        trip_res = supabase.table("itineraries").delete().eq("creator_id", user_id).execute()
        deleted_counts["trips"] = len(trip_res.data) if trip_res.data else 0
        print(f"   ✅ 主行程: {deleted_counts['trips']} 筆")
        
        print(f"🎉 GDPR 刪除完成: {deleted_counts}")
        return {
            "status": "success",
            "message": "所有資料已刪除",
            "deleted": deleted_counts
        }
        
    except Exception as e:
        print(f"🔥 GDPR Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



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

class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []  # 對話歷史: [{"role": "user", "parts": [...]}] 或 [{"role": "user", "content": "..."}]
    thought_signatures: Optional[List[dict]] = None  # 🆕 上一輪的思想簽名 (Round-Trip)
    image: Optional[str] = None  # Base64 image string (optional)
    location: Optional[dict] = None  # 當前位置: {"lat": float, "lng": float, "name": str}
    # 🆕 v3.5: 行程上下文
    current_itinerary: Optional[dict] = None  # 精簡版行程 JSON
    focused_day: Optional[int] = None  # 用戶正在查看的天數

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
        from services.poi_service import detect_poi_query
        
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
    thought_signatures: Optional[List[dict]] = None
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
        
        # 發送完成事件
        yield f'event: done\ndata: {json.dumps({"model_used": model_name, "raw_parts": raw_parts})}\n\n'
        
    except Exception as e:
        print(f"🔥 Stream Error: {e}")
        yield f'event: error\ndata: {json.dumps({"message": str(e), "code": 500})}\n\n'


# 🆕 v3.6: 記憶摘要 API
class SummarizeRequest(BaseModel):
    history: List[Dict]  # 要摘要的對話歷史

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
    
    return StreamingResponse(
        stream_chat_generator(
            api_key=api_key,
            history=full_history,
            message=request.message,
            thought_signatures=request.thought_signatures
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


# ==================== POI 智能搜索 API ====================
from services.poi_service import (
    search_poi_combined,
    format_pois_for_ai,
    get_ai_prompt_for_recommendation,
    detect_poi_query
)


class POIRecommendRequest(BaseModel):
    pois: List[dict]
    user_query: str
    api_key: str
    user_preferences: Optional[dict] = None


@app.get("/api/poi/nearby")
async def search_nearby_poi(
    lat: float,
    lng: float,
    category: str = "restaurant",
    radius: int = 1000
):
    """
    搜索附近 POI
    
    Args:
        lat: 緯度
        lng: 經度
        category: 類別 (pharmacy, restaurant, convenience, supermarket, department_store, popular)
        radius: 搜索半徑（公尺，預設 1000）
    
    Returns:
        POI 列表（含距離、評分等）
    """
    valid_categories = ["pharmacy", "restaurant", "convenience", "supermarket", "department_store", "popular"]
    if category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid category. Valid: {valid_categories}")
    
    if radius < 100 or radius > 5000:
        raise HTTPException(status_code=400, detail="Radius must be between 100 and 5000 meters")
    
    try:
        pois = await search_poi_combined(lat, lng, category, radius)
        return {
            "count": len(pois),
            "radius": radius,
            "category": category,
            "pois": pois
        }
    except Exception as e:
        print(f"🔥 POI Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/poi/recommend")
async def ai_recommend_poi(request: POIRecommendRequest):
    """
    基於 POI 列表進行 AI 推薦
    
    Token 優化策略：
    1. POI 資料已由 /api/poi/nearby 預先查詢
    2. 只傳精簡摘要給 Gemini（~200 tokens vs ~2000 tokens）
    3. 節省 80%+ Token 消耗
    """
    if not request.pois:
        return {"recommendation": "附近沒有找到相關地點，請嘗試其他類別或擴大搜索範圍。"}
    
    if not request.api_key:
        raise HTTPException(status_code=400, detail="API key required")
    
    try:
        # Step 1: 格式化 POI 為精簡文字
        pois_text = format_pois_for_ai(request.pois, max_items=5)
        
        # Step 2: 生成精簡 prompt
        prompt = get_ai_prompt_for_recommendation(
            pois_text,
            request.user_query,
            request.user_preferences
        )
        
        # Step 3: 🆕 使用新版 Client API
        client = genai.Client(api_key=request.api_key)
        
        from google.genai import types
        config = types.GenerateContentConfig(
            max_output_tokens=300,
            temperature=0.7
        )
        
        response = client.models.generate_content(
            model=LITE_MODEL,
            contents=prompt,
            config=config
        )
        
        return {
            "recommendation": response.text,
            "pois_count": len(request.pois),
            "token_optimized": True
        }
        
    except Exception as e:
        print(f"🔥 POI Recommend Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/poi/categories")
async def get_poi_categories():
    """取得支援的 POI 類別列表"""
    return {
        "categories": [
            {"id": "department_store", "name": "百貨公司", "icon": "🏬"},
            {"id": "restaurant", "name": "美食餐廳", "icon": "🍽️"},
            {"id": "convenience", "name": "便利商店", "icon": "🏪"},
            {"id": "supermarket", "name": "超市", "icon": "🛒"},
            {"id": "pharmacy", "name": "藥局藥妝", "icon": "💊"},
            {"id": "popular", "name": "熱門景點", "icon": "🔥"}
        ]
    }


# ==================== WikiVoyage API ====================
from services.poi_service import search_wikivoyage


@app.get("/api/wikivoyage/search")
async def wikivoyage_search(place: str, lang: str = "en"):
    """
    搜索 WikiVoyage 景點描述
    
    Args:
        place: 景點名稱 (英文效果較佳)
        lang: 語言代碼 (en, ja, zh)
    
    Returns:
        WikiVoyage 頁面資訊
    """
    if not place or len(place) < 2:
        raise HTTPException(status_code=400, detail="Place name too short")
    
    result = await search_wikivoyage(place, lang)
    
    if not result:
        return {
            "found": False,
            "message": f"No WikiVoyage article found for '{place}'"
        }
    
    return {
        "found": True,
        **result
    }
