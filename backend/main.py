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

from supabase import create_client, Client
from google import genai
from google.genai import types # 🆕 Import types
import httpx  # For async HTTP requests (geocoding)
from dotenv import load_dotenv

# 1. 載入環境變數 (只讀 Supabase)
load_dotenv()

app = FastAPI(title="Ryan's AI Travel Tool (BYOK Edition)")

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


async def geocode_with_photon(place_name: str, limit: int = 5, lat: float = None, lng: float = None):
    """Photon 地理編碼 (基於 OpenStreetMap + Elasticsearch，模糊搜尋強)
    
    Args:
        lat, lng: 若提供，將優先返回附近的結果 (Location Bias)
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            params = {
                "q": place_name,
                "limit": limit,
                "lang": "zh"  # 中文優先
            }
            # 🆕 Location Bias
            if lat is not None and lng is not None:
                params["lat"] = lat
                params["lon"] = lng

            res = await client.get(
                "https://photon.komoot.io/api/",
                params=params
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


async def geocode_place(place_name: str, lat: float = None, lng: float = None):
    """智能地理編碼：ArcGIS 優先，Photon 備援"""

    # 1. 優先嘗試 ArcGIS (精確度高)
    if ARCGIS_API_KEY:
        result = await geocode_with_arcgis(place_name)
        if result:
            return result
        print(f"⚠️ ArcGIS 查無結果，降級到 Photon...")
    
    # 2. 降級到 Photon（取代 Nominatim）
    photon_results = await geocode_with_photon(place_name, limit=1, lat=lat, lng=lng)
    if photon_results:
        first = photon_results[0]
        return {"lat": first["lat"], "lng": first["lng"]}
    
    return None


# 🧠 智能地理編碼系統

# 國家邊界框（用於過濾搜尋結果）
COUNTRY_BOUNDS = {
    "JP": {"lat_min": 20.4, "lat_max": 45.5, "lng_min": 122.9, "lng_max": 154.0, "lang": "ja", "name": "日本"},
    "KR": {"lat_min": 33.1, "lat_max": 38.6, "lng_min": 124.6, "lng_max": 132.0, "lang": "ko", "name": "韓國"},
    "TW": {"lat_min": 21.8, "lat_max": 25.3, "lng_min": 119.3, "lng_max": 122.1, "lang": "zh-TW", "name": "台灣"},
    "TH": {"lat_min": 5.6, "lat_max": 20.5, "lng_min": 97.3, "lng_max": 105.6, "lang": "th", "name": "泰國"},
    "VN": {"lat_min": 8.2, "lat_max": 23.4, "lng_min": 102.1, "lng_max": 109.5, "lang": "vi", "name": "越南"},
    "SG": {"lat_min": 1.15, "lat_max": 1.47, "lng_min": 103.6, "lng_max": 104.0, "lang": "en", "name": "新加坡"},
    "HK": {"lat_min": 22.15, "lat_max": 22.56, "lng_min": 113.8, "lng_max": 114.4, "lang": "zh-HK", "name": "香港"},
}

# 🆕 關鍵字 → 國家代碼 映射 (確定性規則，無需 AI)
LOCATION_KEYWORDS = {
    "JP": [
        # 城市
        "東京", "tokyo", "大阪", "osaka", "京都", "kyoto", "北海道", "hokkaido",
        "沖繩", "okinawa", "札幌", "sapporo", "名古屋", "nagoya", "福岡", "fukuoka",
        "奈良", "nara", "神戶", "kobe", "橫濱", "yokohama", "廣島", "hiroshima",
        # 著名景點
        "迪士尼", "disney", "淺草", "asakusa", "箱根", "hakone", "富士", "fuji",
        "新宿", "shinjuku", "澀谷", "shibuya", "涩谷", "銀座", "ginza",
        "成田", "narita", "羽田", "haneda", "秋葉原", "akihabara", "原宿", "harajuku",
        "上野", "ueno", "池袋", "ikebukuro", "品川", "shinagawa",
        "清水寺", "金閣寺", "伏見稻荷", "嵐山", "arashiyama",
        "環球影城", "universal", "心齋橋", "道頓堀", "通天閣",
        "日本", "japan", "関西", "関東", "九州", "四國",
    ],
    "KR": [
        "首爾", "seoul", "釜山", "busan", "濟州", "jeju", "仁川", "incheon",
        "明洞", "myeongdong", "弘大", "hongdae", "東大門", "dongdaemun",
        "景福宮", "南山塔", "n seoul tower", "梨泰院", "itaewon",
        "韓國", "korea", "樂天", "lotte",
    ],
    "TW": [
        "台北", "taipei", "台中", "taichung", "台南", "tainan", "高雄", "kaohsiung",
        "九份", "jiufen", "淡水", "tamsui", "墾丁", "kenting", "花蓮", "hualien",
        "101", "西門町", "ximending", "士林", "shilin", "故宮", "北投", "beitou",
        "台灣", "taiwan", "饒河", "逢甲", "日月潭", "sun moon lake", "阿里山",
    ],
    "TH": [
        "曼谷", "bangkok", "普吉", "phuket", "清邁", "chiang mai", "芭達雅", "pattaya",
        "華欣", "hua hin", "蘇梅", "samui", "大城", "ayutthaya",
        "考山路", "khao san", "恰圖恰", "chatuchak", "水門", "pratunam",
        "泰國", "thailand",
    ],
    "VN": [
        "河內", "hanoi", "胡志明", "ho chi minh", "峴港", "da nang", "會安", "hoi an",
        "下龍灣", "ha long", "芽莊", "nha trang", "大叻", "dalat",
        "越南", "vietnam",
    ],
    "SG": [
        "新加坡", "singapore", "聖淘沙", "sentosa", "烏節路", "orchard", "克拉碼頭", "clarke quay",
        "濱海灣", "marina bay", "樟宜", "changi", "環球影城",
    ],
    "HK": [
        "香港", "hong kong", "旺角", "mong kok", "尖沙咀", "tsim sha tsui",
        "銅鑼灣", "causeway bay", "中環", "central", "太平山", "victoria peak",
        "迪士尼", "disney", "海洋公園", "ocean park", "大嶼山", "lantau",
    ],
}

def detect_country_from_keywords(query: str) -> str:
    """🔑 從搜尋關鍵字確定性判斷國家（無需 AI，零延遲）
    
    這是 Google Maps 風格的語意解析：
    - "東京迪士尼" → JP (命中 "東京")
    - "首爾塔" → KR (命中 "首爾")
    
    Returns: 國家代碼 或 None
    """
    query_lower = query.lower()
    
    for country_code, keywords in LOCATION_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in query_lower:
                print(f"🔑 Keyword Match: '{kw}' → {country_code}")
                return country_code
    return None

# 🆕 擴展版地標資料庫（支援別名、中文顯示、國家識別、座標直接回傳）
LANDMARKS_DB = {
    # ═══════════════════════════════════════════════════════════════
    # 日本 - 主題公園 (含座標，可秒回)
    # ═══════════════════════════════════════════════════════════════
    "東京迪士尼": {"aliases": ["东京迪士尼", "tokyo disneyland", "tdl", "東京ディズニーランド"], "search": "Tokyo Disneyland", "display": "東京迪士尼樂園", "country": "JP", "lat": 35.6329, "lng": 139.8804},
    "東京迪士尼海洋": {"aliases": ["东京迪士尼海洋", "tokyo disneysea", "tds", "東京ディズニーシー"], "search": "Tokyo DisneySea", "display": "東京迪士尼海洋", "country": "JP", "lat": 35.6267, "lng": 139.8850},
    "大阪環球影城": {"aliases": ["日本環球影城", "usj", "universal studios japan", "ユニバーサル"], "search": "Universal Studios Japan", "display": "日本環球影城", "country": "JP", "lat": 34.6654, "lng": 135.4323},
    "富士急樂園": {"aliases": ["富士急ハイランド", "fuji-q", "fujiq"], "search": "Fuji-Q Highland", "display": "富士急樂園", "country": "JP", "lat": 35.4833, "lng": 138.7778},
    
    # ═══════════════════════════════════════════════════════════════
    # 日本 - 東京景點 (含座標，可秒回)
    # ═══════════════════════════════════════════════════════════════
    "淺草寺": {"aliases": ["浅草寺", "senso-ji", "sensoji", "雷門"], "search": "Senso-ji Temple", "display": "淺草寺", "country": "JP", "lat": 35.7148, "lng": 139.7967},
    "東京鐵塔": {"aliases": ["东京塔", "tokyo tower", "東京タワー"], "search": "Tokyo Tower", "display": "東京鐵塔", "country": "JP", "lat": 35.6586, "lng": 139.7454},
    "晴空塔": {"aliases": ["天空樹", "skytree", "tokyo skytree", "スカイツリー", "东京晴空塔"], "search": "Tokyo Skytree", "display": "東京晴空塔", "country": "JP", "lat": 35.7101, "lng": 139.8107},
    "明治神宮": {"aliases": ["meiji shrine", "meiji jingu", "明治神宫"], "search": "Meiji Shrine", "display": "明治神宮", "country": "JP", "lat": 35.6764, "lng": 139.6993},
    "皇居": {"aliases": ["imperial palace", "皇居東御苑", "东京皇居"], "search": "Imperial Palace Tokyo", "display": "皇居", "country": "JP", "lat": 35.6852, "lng": 139.7528},
    "上野公園": {"aliases": ["ueno park", "上野恩賜公園"], "search": "Ueno Park", "display": "上野公園", "country": "JP", "lat": 35.7146, "lng": 139.7732},
    "新宿御苑": {"aliases": ["shinjuku gyoen", "新宿御苑"], "search": "Shinjuku Gyoen", "display": "新宿御苑", "country": "JP", "lat": 35.6852, "lng": 139.7100},
    "東京車站": {"aliases": ["东京站", "tokyo station", "東京駅"], "search": "Tokyo Station", "display": "東京車站", "country": "JP", "lat": 35.6812, "lng": 139.7671},
    "澀谷十字路口": {"aliases": ["涩谷", "shibuya crossing", "shibuya scramble", "スクランブル交差点", "渋谷"], "search": "Shibuya Crossing", "display": "澀谷十字路口", "country": "JP", "lat": 35.6595, "lng": 139.7004},
    "秋葉原": {"aliases": ["akihabara", "アキバ", "秋叶原"], "search": "Akihabara", "display": "秋葉原電器街", "country": "JP", "lat": 35.7023, "lng": 139.7745},
    "銀座": {"aliases": ["ginza", "銀座"], "search": "Ginza Tokyo", "display": "銀座", "country": "JP", "lat": 35.6717, "lng": 139.7649},
    "原宿": {"aliases": ["harajuku", "竹下通", "原宿竹下通"], "search": "Harajuku", "display": "原宿", "country": "JP", "lat": 35.6702, "lng": 139.7027},
    "池袋": {"aliases": ["ikebukuro", "池袋サンシャイン"], "search": "Ikebukuro", "display": "池袋", "country": "JP", "lat": 35.7295, "lng": 139.7109},
    "六本木": {"aliases": ["roppongi", "roppongi hills", "六本木ヒルズ"], "search": "Roppongi", "display": "六本木", "country": "JP", "lat": 35.6628, "lng": 139.7313},
    "台場": {"aliases": ["odaiba", "お台場", "彩虹大橋"], "search": "Odaiba", "display": "台場", "country": "JP", "lat": 35.6295, "lng": 139.7753},
    "築地市場": {"aliases": ["tsukiji", "tsukiji market", "築地"], "search": "Tsukiji Market", "display": "築地市場", "country": "JP", "lat": 35.6654, "lng": 139.7707},
    "豐洲市場": {"aliases": ["toyosu", "toyosu market", "豊洲市場"], "search": "Toyosu Market", "display": "豐洲市場", "country": "JP", "lat": 35.6455, "lng": 139.7853},
    # 購物/娛樂
    "teamLab Borderless": {"aliases": ["teamlab", "チームラボ", "teamlab planets", "數位藝術美術館"], "search": "teamLab Borderless", "display": "teamLab 數位藝術美術館", "country": "JP", "lat": 35.6265, "lng": 139.7837},  # 台場/豐洲
    "池袋陽光城": {"aliases": ["sunshine city", "サンシャインシティ", "sunshine 60"], "search": "Ikebukuro Sunshine City", "display": "池袋陽光城", "country": "JP", "lat": 35.7283, "lng": 139.7193},
    "東京巨蛋": {"aliases": ["tokyo dome", "東京ドーム", "tokyodome"], "search": "Tokyo Dome", "display": "東京巨蛋", "country": "JP", "lat": 35.7056, "lng": 139.7519},
    "表參道": {"aliases": ["omotesando", "表参道", "表參道hills"], "search": "Omotesando", "display": "表參道", "country": "JP", "lat": 35.6652, "lng": 139.7123},
    "代官山": {"aliases": ["daikanyama", "代官山蔦屋"], "search": "Daikanyama", "display": "代官山", "country": "JP", "lat": 35.6486, "lng": 139.7033},
    "自由之丘": {"aliases": ["jiyugaoka", "自由が丘"], "search": "Jiyugaoka", "display": "自由之丘", "country": "JP", "lat": 35.6073, "lng": 139.6689},
    "吉祥寺": {"aliases": ["kichijoji", "井之頭公園"], "search": "Kichijoji", "display": "吉祥寺", "country": "JP", "lat": 35.7031, "lng": 139.5796},
    "惠比壽": {"aliases": ["ebisu", "恵比寿", "惠比壽花園廣場"], "search": "Ebisu", "display": "惠比壽", "country": "JP", "lat": 35.6467, "lng": 139.7101},
    "中野百老匯": {"aliases": ["nakano broadway", "中野ブロードウェイ"], "search": "Nakano Broadway", "display": "中野百老匯", "country": "JP", "lat": 35.7078, "lng": 139.6657},
    "下北澤": {"aliases": ["shimokitazawa", "下北沢"], "search": "Shimokitazawa", "display": "下北澤", "country": "JP", "lat": 35.6618, "lng": 139.6682},
    # ═══════════════════════════════════════════════════════════════
    # 日本 - 京都景點 (含座標，可秒回)
    # ═══════════════════════════════════════════════════════════════
    "清水寺": {"aliases": ["kiyomizu-dera", "kiyomizudera", "清水の舞台"], "search": "Kiyomizu-dera", "display": "清水寺", "country": "JP", "lat": 34.9949, "lng": 135.7850},
    "金閣寺": {"aliases": ["kinkaku-ji", "kinkakuji", "金閣", "鹿苑寺"], "search": "Kinkaku-ji", "display": "金閣寺", "country": "JP", "lat": 35.0394, "lng": 135.7292},
    "銀閣寺": {"aliases": ["ginkaku-ji", "ginkakuji", "銀閣", "慈照寺"], "search": "Ginkaku-ji", "display": "銀閣寺", "country": "JP", "lat": 35.0270, "lng": 135.7982},
    "伏見稻荷大社": {"aliases": ["伏見稻荷", "fushimi inari", "千本鳥居", "伏見稲荷大社"], "search": "Fushimi Inari Taisha", "display": "伏見稻荷大社", "country": "JP", "lat": 34.9671, "lng": 135.7727},
    "嵐山": {"aliases": ["arashiyama", "嵐山竹林", "竹林小徑", "嵯峨野"], "search": "Arashiyama", "display": "嵐山", "country": "JP", "lat": 35.0094, "lng": 135.6667},
    "二條城": {"aliases": ["nijo castle", "二条城"], "search": "Nijo Castle", "display": "二條城", "country": "JP", "lat": 35.0142, "lng": 135.7479},
    "祇園": {"aliases": ["gion", "花見小路", "祇園花見小路"], "search": "Gion Kyoto", "display": "祇園", "country": "JP", "lat": 35.0037, "lng": 135.7751},
    "八坂神社": {"aliases": ["yasaka shrine", "八坂神社"], "search": "Yasaka Shrine", "display": "八坂神社", "country": "JP", "lat": 35.0036, "lng": 135.7785},
    "京都車站": {"aliases": ["kyoto station", "京都駅"], "search": "Kyoto Station", "display": "京都車站", "country": "JP", "lat": 34.9858, "lng": 135.7588},
    "錦市場": {"aliases": ["nishiki market", "錦市場"], "search": "Nishiki Market", "display": "錦市場", "country": "JP", "lat": 35.0050, "lng": 135.7649},
    "平安神宮": {"aliases": ["heian shrine", "平安神宮"], "search": "Heian Shrine", "display": "平安神宮", "country": "JP", "lat": 35.0160, "lng": 135.7820},
    "哲學之道": {"aliases": ["philosopher's path", "哲学の道"], "search": "Philosopher's Path", "display": "哲學之道", "country": "JP", "lat": 35.0233, "lng": 135.7942},
    
    # ═══════════════════════════════════════════════════════════════
    # 日本 - 大阪景點 (含座標，可秒回)
    # ═══════════════════════════════════════════════════════════════
    "道頓堀": {"aliases": ["dotonbori", "道頓崛", "固力果看板", "glico"], "search": "Dotonbori", "display": "道頓堀", "country": "JP", "lat": 34.6687, "lng": 135.5013},
    "心齋橋": {"aliases": ["shinsaibashi", "心斋桥"], "search": "Shinsaibashi", "display": "心齋橋", "country": "JP", "lat": 34.6748, "lng": 135.5009},
    "通天閣": {"aliases": ["tsutenkaku", "新世界"], "search": "Tsutenkaku", "display": "通天閣", "country": "JP", "lat": 34.6525, "lng": 135.5063},
    "大阪城": {"aliases": ["osaka castle", "大阪城公園", "大坂城"], "search": "Osaka Castle", "display": "大阪城", "country": "JP", "lat": 34.6873, "lng": 135.5262},
    "黑門市場": {"aliases": ["kuromon market", "黒門市場"], "search": "Kuromon Market", "display": "黑門市場", "country": "JP", "lat": 34.6679, "lng": 135.5065},
    "難波": {"aliases": ["namba", "なんば"], "search": "Namba Osaka", "display": "難波", "country": "JP", "lat": 34.6659, "lng": 135.5013},
    "梅田": {"aliases": ["umeda", "大阪梅田", "梅田スカイビル"], "search": "Umeda Osaka", "display": "梅田", "country": "JP", "lat": 34.7055, "lng": 135.4983},
    "天王寺": {"aliases": ["tennoji", "阿倍野harukas", "あべのハルカス"], "search": "Tennoji", "display": "天王寺", "country": "JP", "lat": 34.6473, "lng": 135.5135},
    "海遊館": {"aliases": ["kaiyukan", "osaka aquarium"], "search": "Osaka Aquarium Kaiyukan", "display": "海遊館", "country": "JP", "lat": 34.6545, "lng": 135.4290},
    "天保山": {"aliases": ["tempozan", "tempozan ferris wheel", "天保山大摩天輪"], "search": "Tempozan", "display": "天保山", "country": "JP", "lat": 34.6539, "lng": 135.4285},
    
    # ═══════════════════════════════════════════════════════════════
    # 日本 - 其他地區 (含座標，可秒回)
    # ═══════════════════════════════════════════════════════════════
    "富士山": {"aliases": ["mount fuji", "mt fuji", "fujisan", "富士山五合目"], "search": "Mount Fuji", "display": "富士山", "country": "JP", "lat": 35.3606, "lng": 138.7274},
    "箱根": {"aliases": ["hakone", "箱根温泉", "蘆之湖", "芦ノ湖"], "search": "Hakone", "display": "箱根", "country": "JP", "lat": 35.2324, "lng": 139.1069},
    "河口湖": {"aliases": ["kawaguchiko", "河口湖"], "search": "Lake Kawaguchi", "display": "河口湖", "country": "JP", "lat": 35.5163, "lng": 138.7519},
    "奈良公園": {"aliases": ["nara park", "奈良鹿", "東大寺", "奈良"], "search": "Nara Park", "display": "奈良公園", "country": "JP", "lat": 34.6851, "lng": 135.8430},
    "姬路城": {"aliases": ["himeji castle", "姫路城", "白鷺城"], "search": "Himeji Castle", "display": "姬路城", "country": "JP", "lat": 34.8394, "lng": 134.6939},
    "廣島和平公園": {"aliases": ["hiroshima peace park", "原爆ドーム", "原爆圓頂", "広島"], "search": "Hiroshima Peace Memorial", "display": "廣島和平紀念公園", "country": "JP", "lat": 34.3955, "lng": 132.4536},
    "宮島": {"aliases": ["miyajima", "厳島神社", "嚴島神社", "海上鳥居"], "search": "Itsukushima Shrine", "display": "宮島", "country": "JP", "lat": 34.2959, "lng": 132.3198},
    "金澤兼六園": {"aliases": ["kenrokuen", "兼六園", "金沢", "金澤"], "search": "Kenrokuen Garden", "display": "兼六園", "country": "JP", "lat": 36.5625, "lng": 136.6625},
    "白川鄉": {"aliases": ["shirakawa-go", "合掌村", "白川郷"], "search": "Shirakawa-go", "display": "白川鄉合掌村", "country": "JP", "lat": 36.2576, "lng": 136.9064},
    "沖繩美麗海水族館": {"aliases": ["churaumi", "美ら海水族館", "沖繩水族館", "美麗海"], "search": "Okinawa Churaumi Aquarium", "display": "沖繩美麗海水族館", "country": "JP", "lat": 26.6944, "lng": 127.8778},
    "札幌": {"aliases": ["sapporo", "時計台", "大通公園"], "search": "Sapporo", "display": "札幌", "country": "JP", "lat": 43.0618, "lng": 141.3545},
    "小樽運河": {"aliases": ["otaru canal", "小樽"], "search": "Otaru Canal", "display": "小樽運河", "country": "JP", "lat": 43.1970, "lng": 140.9940},
    "函館山": {"aliases": ["hakodate", "函館夜景", "函館山ロープウェイ"], "search": "Mount Hakodate", "display": "函館山", "country": "JP", "lat": 41.7587, "lng": 140.7031},
    
    # ═══════════════════════════════════════════════════════════════
    # 日本 - 人氣餐廳 (旗艦店座標，用於品牌搜索)
    # ═══════════════════════════════════════════════════════════════
    # 拉麵
    "一蘭拉麵": {"aliases": ["ichiran", "一蘭", "いちらん", "一蘭ラーメン"], "search": "Ichiran Ramen", "display": "一蘭拉麵", "country": "JP", "lat": 35.6617, "lng": 139.7037},  # 澀谷本店
    "一風堂": {"aliases": ["ippudo", "一風堂ラーメン", "博多一風堂"], "search": "Ippudo Ramen", "display": "一風堂", "country": "JP", "lat": 35.6938, "lng": 139.7034},  # 新宿本店
    "蒙古タンメン中本": {"aliases": ["nakamoto", "蒙古湯麵中本", "中本"], "search": "Mouko Tanmen Nakamoto", "display": "蒙古湯麵中本", "country": "JP", "lat": 35.7051, "lng": 139.7729},  # 池袋本店
    "麵屋武藏": {"aliases": ["menya musashi", "つけ麺"], "search": "Menya Musashi", "display": "麵屋武藏", "country": "JP", "lat": 35.6891, "lng": 139.6995},  # 新宿
    
    # 壽司
    "藏壽司": {"aliases": ["くら寿司", "kura sushi", "無添くら寿司"], "search": "Kura Sushi", "display": "藏壽司", "country": "JP", "lat": 35.6580, "lng": 139.7016},  # 澀谷店
    "壽司郎": {"aliases": ["スシロー", "sushiro", "スシロー回転寿司"], "search": "Sushiro", "display": "壽司郎", "country": "JP", "lat": 35.6896, "lng": 139.7006},  # 新宿店
    "築地壽司": {"aliases": ["tsukiji sushi", "築地すし", "すし大"], "search": "Tsukiji Sushi", "display": "築地壽司", "country": "JP", "lat": 35.6655, "lng": 139.7707},  # 築地
    
    # 燒肉/螃蟹
    "敘敘苑": {"aliases": ["叙々苑", "jojoen", "叙叙苑"], "search": "Jojoen Yakiniku", "display": "敘敘苑", "country": "JP", "lat": 35.6620, "lng": 139.7310},  # 六本木本店
    "牛角": {"aliases": ["gyukaku", "ぎゅうかく"], "search": "Gyukaku", "display": "牛角", "country": "JP", "lat": 35.6591, "lng": 139.7034},  # 澀谷店
    "蟹道樂": {"aliases": ["kani doraku", "かに道楽", "カニ道楽"], "search": "Kani Doraku", "display": "蟹道樂", "country": "JP", "lat": 34.6688, "lng": 135.5015},  # 道頓堀本店
    
    # 丼飯/定食
    "松屋": {"aliases": ["matsuya", "まつや", "松屋牛丼"], "search": "Matsuya", "display": "松屋", "country": "JP", "lat": 35.6896, "lng": 139.7006},  # 新宿
    "吉野家": {"aliases": ["yoshinoya", "よしのや"], "search": "Yoshinoya", "display": "吉野家", "country": "JP", "lat": 35.6580, "lng": 139.7016},  # 澀谷
    "すき家": {"aliases": ["sukiya", "すきや", "sukiya牛丼"], "search": "Sukiya", "display": "すき家", "country": "JP", "lat": 35.7296, "lng": 139.7109},  # 池袋
    "CoCo壱番屋": {"aliases": ["coco ichibanya", "ココイチ", "咖哩屋"], "search": "CoCo Ichibanya", "display": "CoCo壱番屋", "country": "JP", "lat": 35.6896, "lng": 139.7006},  # 新宿
    
    # 咖啡/甜點
    "Blue Bottle Coffee": {"aliases": ["藍瓶咖啡", "blue bottle", "ブルーボトル"], "search": "Blue Bottle Coffee", "display": "Blue Bottle Coffee", "country": "JP", "lat": 35.6617, "lng": 139.7037},  # 青山店
    "猿田彥咖啡": {"aliases": ["sarutahiko", "猿田彦珈琲"], "search": "Sarutahiko Coffee", "display": "猿田彥咖啡", "country": "JP", "lat": 35.6617, "lng": 139.7037},  # 惠比壽本店
    # ═══════════════════════════════════════════════════════════════
    # 日本 - 機場與車站 (含座標，可秒回)
    # ═══════════════════════════════════════════════════════════════
    "成田機場": {"aliases": ["narita airport", "narita", "nrt", "成田空港"], "search": "Narita Airport", "display": "成田國際機場", "country": "JP", "lat": 35.7720, "lng": 140.3929},
    "羽田機場": {"aliases": ["haneda airport", "haneda", "hnd", "羽田空港"], "search": "Haneda Airport", "display": "羽田國際機場", "country": "JP", "lat": 35.5494, "lng": 139.7798},
    "關西機場": {"aliases": ["kansai airport", "kix", "関西空港", "關西國際機場"], "search": "Kansai International Airport", "display": "關西國際機場", "country": "JP", "lat": 34.4347, "lng": 135.2441},
    "新大阪站": {"aliases": ["shin-osaka", "新大阪駅"], "search": "Shin-Osaka Station", "display": "新大阪站", "country": "JP", "lat": 34.7336, "lng": 135.5003},
    "品川站": {"aliases": ["shinagawa", "品川駅"], "search": "Shinagawa Station", "display": "品川站", "country": "JP", "lat": 35.6284, "lng": 139.7387},
    "新宿站": {"aliases": ["shinjuku station", "新宿駅"], "search": "Shinjuku Station", "display": "新宿站", "country": "JP", "lat": 35.6896, "lng": 139.7006},
    "澀谷站": {"aliases": ["shibuya station", "渋谷駅"], "search": "Shibuya Station", "display": "澀谷站", "country": "JP", "lat": 35.6580, "lng": 139.7016},
    "難波站": {"aliases": ["namba station", "難波駅", "なんば"], "search": "Namba Station", "display": "難波站", "country": "JP", "lat": 34.6659, "lng": 135.5013},
    "博多站": {"aliases": ["hakata station", "博多駅"], "search": "Hakata Station", "display": "博多站", "country": "JP", "lat": 33.5897, "lng": 130.4207},
    "名古屋站": {"aliases": ["nagoya station", "名古屋駅"], "search": "Nagoya Station", "display": "名古屋站", "country": "JP", "lat": 35.1709, "lng": 136.8815},
    
    # ═══════════════════════════════════════════════════════════════
    # 韓國 (含座標，可秒回)
    # ═══════════════════════════════════════════════════════════════
    "首爾塔": {"aliases": ["南山塔", "n seoul tower", "남산타워", "namsan tower"], "search": "N Seoul Tower", "display": "首爾塔", "country": "KR", "lat": 37.5512, "lng": 126.9882},
    "景福宮": {"aliases": ["gyeongbokgung", "경복궁", "光化門"], "search": "Gyeongbokgung Palace", "display": "景福宮", "country": "KR", "lat": 37.5796, "lng": 126.9770},
    "明洞": {"aliases": ["myeongdong", "명동", "明洞購物"], "search": "Myeongdong", "display": "明洞", "country": "KR", "lat": 37.5636, "lng": 126.9850},
    "弘大": {"aliases": ["hongdae", "홍대", "弘益大學"], "search": "Hongdae", "display": "弘大", "country": "KR", "lat": 37.5563, "lng": 126.9237},
    "東大門": {"aliases": ["dongdaemun", "동대문", "ddp"], "search": "Dongdaemun", "display": "東大門", "country": "KR", "lat": 37.5662, "lng": 127.0095},
    "梨泰院": {"aliases": ["itaewon", "이태원"], "search": "Itaewon", "display": "梨泰院", "country": "KR", "lat": 37.5344, "lng": 126.9947},
    "樂天世界": {"aliases": ["lotte world", "롯데월드", "樂天遊樂園"], "search": "Lotte World", "display": "樂天世界", "country": "KR", "lat": 37.5111, "lng": 127.0980},
    "樂天塔": {"aliases": ["lotte tower", "롯데타워", "樂天世界塔"], "search": "Lotte World Tower", "display": "樂天世界塔", "country": "KR", "lat": 37.5126, "lng": 127.1026},
    "北村韓屋村": {"aliases": ["bukchon", "북촌한옥마을", "韓屋村"], "search": "Bukchon Hanok Village", "display": "北村韓屋村", "country": "KR", "lat": 37.5827, "lng": 126.9850},
    "仁寺洞": {"aliases": ["insadong", "인사동"], "search": "Insadong", "display": "仁寺洞", "country": "KR", "lat": 37.5742, "lng": 126.9856},
    "江南": {"aliases": ["gangnam", "강남"], "search": "Gangnam Seoul", "display": "江南", "country": "KR", "lat": 37.4979, "lng": 127.0276},
    "仁川機場": {"aliases": ["incheon airport", "icn", "인천공항"], "search": "Incheon Airport", "display": "仁川國際機場", "country": "KR", "lat": 37.4602, "lng": 126.4407},
    "濟州島": {"aliases": ["jeju", "제주도", "濟州"], "search": "Jeju Island", "display": "濟州島", "country": "KR", "lat": 33.4996, "lng": 126.5312},
    "釜山海雲台": {"aliases": ["haeundae", "해운대", "海雲台"], "search": "Haeundae Beach", "display": "海雲台海灘", "country": "KR", "lat": 35.1587, "lng": 129.1604},
    
    # ═══════════════════════════════════════════════════════════════
    # 台灣 (含座標，可秒回)
    # ═══════════════════════════════════════════════════════════════
    "台北101": {"aliases": ["taipei 101", "101大樓", "一零一"], "search": "Taipei 101", "display": "台北101", "country": "TW", "lat": 25.0339, "lng": 121.5645},
    "九份": {"aliases": ["jiufen", "九份老街", "九分"], "search": "Jiufen Old Street", "display": "九份老街", "country": "TW", "lat": 25.1097, "lng": 121.8454},
    "西門町": {"aliases": ["ximending", "西門"], "search": "Ximending", "display": "西門町", "country": "TW", "lat": 25.0424, "lng": 121.5081},
    "士林夜市": {"aliases": ["shilin night market", "士林"], "search": "Shilin Night Market", "display": "士林夜市", "country": "TW", "lat": 25.0880, "lng": 121.5241},
    "饒河夜市": {"aliases": ["raohe night market", "饒河街"], "search": "Raohe Night Market", "display": "饒河夜市", "country": "TW", "lat": 25.0513, "lng": 121.5779},
    "故宮博物院": {"aliases": ["national palace museum", "台北故宮", "故宮"], "search": "National Palace Museum Taiwan", "display": "國立故宮博物院", "country": "TW", "lat": 25.1024, "lng": 121.5485},
    "日月潭": {"aliases": ["sun moon lake", "日月潭"], "search": "Sun Moon Lake", "display": "日月潭", "country": "TW", "lat": 23.8588, "lng": 120.9163},
    "阿里山": {"aliases": ["alishan", "阿里山森林"], "search": "Alishan", "display": "阿里山", "country": "TW", "lat": 23.5106, "lng": 120.8066},
    "台北車站": {"aliases": ["taipei station", "台北火車站", "北車"], "search": "Taipei Main Station", "display": "台北車站", "country": "TW", "lat": 25.0478, "lng": 121.5170},
    "中正紀念堂": {"aliases": ["chiang kai-shek memorial", "中正廟"], "search": "Chiang Kai-shek Memorial Hall", "display": "中正紀念堂", "country": "TW", "lat": 25.0350, "lng": 121.5219},
    "淡水老街": {"aliases": ["tamsui", "淡水", "漁人碼頭"], "search": "Tamsui Old Street", "display": "淡水老街", "country": "TW", "lat": 25.1697, "lng": 121.4383},
    "北投溫泉": {"aliases": ["beitou", "北投", "地熱谷"], "search": "Beitou Hot Spring", "display": "北投溫泉", "country": "TW", "lat": 25.1375, "lng": 121.5077},
    "桃園機場": {"aliases": ["taoyuan airport", "tpe", "桃機"], "search": "Taoyuan Airport", "display": "桃園國際機場", "country": "TW", "lat": 25.0777, "lng": 121.2327},
    
    # ═══════════════════════════════════════════════════════════════
    # 泰國
    # ═══════════════════════════════════════════════════════════════
    "大皇宮": {"aliases": ["grand palace", "大王宮", "พระบรมมหาราชวัง"], "search": "Grand Palace Bangkok", "display": "大皇宮", "country": "TH"},
    "臥佛寺": {"aliases": ["wat pho", "วัดโพธิ์", "涅槃寺"], "search": "Wat Pho", "display": "臥佛寺", "country": "TH"},
    "鄭王廟": {"aliases": ["wat arun", "วัดอรุณ", "黎明寺"], "search": "Wat Arun", "display": "鄭王廟", "country": "TH"},
    "考山路": {"aliases": ["khao san road", "ถนนข้าวสาร", "背包客街"], "search": "Khao San Road", "display": "考山路", "country": "TH"},
    "恰圖恰市場": {"aliases": ["chatuchak", "jj market", "週末市場"], "search": "Chatuchak Market", "display": "恰圖恰週末市場", "country": "TH"},
    "水門市場": {"aliases": ["pratunam", "水門"], "search": "Pratunam Market", "display": "水門市場", "country": "TH"},
    "四面佛": {"aliases": ["erawan shrine", "พระพรหม"], "search": "Erawan Shrine", "display": "四面佛", "country": "TH"},
    "暹羅廣場": {"aliases": ["siam square", "siam paragon", "สยาม"], "search": "Siam Square", "display": "暹羅廣場", "country": "TH"},
    "素萬那普機場": {"aliases": ["suvarnabhumi", "bkk", "曼谷機場"], "search": "Suvarnabhumi Airport", "display": "素萬那普國際機場", "country": "TH"},
    
    # ═══════════════════════════════════════════════════════════════
    # 新加坡
    # ═══════════════════════════════════════════════════════════════
    "魚尾獅": {"aliases": ["merlion", "merlion park", "鱼尾狮"], "search": "Merlion", "display": "魚尾獅公園", "country": "SG"},
    "濱海灣金沙": {"aliases": ["marina bay sands", "mbs", "金沙酒店"], "search": "Marina Bay Sands", "display": "濱海灣金沙酒店", "country": "SG"},
    "聖淘沙": {"aliases": ["sentosa", "環球影城新加坡"], "search": "Sentosa", "display": "聖淘沙島", "country": "SG"},
    "新加坡環球影城": {"aliases": ["universal studios singapore", "uss"], "search": "Universal Studios Singapore", "display": "新加坡環球影城", "country": "SG"},
    "烏節路": {"aliases": ["orchard road", "orchard"], "search": "Orchard Road", "display": "烏節路", "country": "SG"},
    "牛車水": {"aliases": ["chinatown singapore"], "search": "Chinatown Singapore", "display": "牛車水", "country": "SG"},
    "濱海灣花園": {"aliases": ["gardens by the bay", "超級樹"], "search": "Gardens by the Bay", "display": "濱海灣花園", "country": "SG"},
    "樟宜機場": {"aliases": ["changi airport", "sin", "星耀樟宜"], "search": "Changi Airport", "display": "樟宜國際機場", "country": "SG"},
    
    # ═══════════════════════════════════════════════════════════════
    # 香港
    # ═══════════════════════════════════════════════════════════════
    "太平山頂": {"aliases": ["victoria peak", "the peak", "山頂纜車"], "search": "Victoria Peak", "display": "太平山頂", "country": "HK"},
    "維多利亞港": {"aliases": ["victoria harbour", "維港", "幻彩詠香江"], "search": "Victoria Harbour", "display": "維多利亞港", "country": "HK"},
    "香港迪士尼": {"aliases": ["hong kong disneyland", "hkdl", "迪士尼"], "search": "Hong Kong Disneyland", "display": "香港迪士尼樂園", "country": "HK"},
    "尖沙咀": {"aliases": ["tsim sha tsui", "tst", "尖沙嘴"], "search": "Tsim Sha Tsui", "display": "尖沙咀", "country": "HK"},
    "旺角": {"aliases": ["mong kok", "女人街", "波鞋街"], "search": "Mong Kok", "display": "旺角", "country": "HK"},
    "銅鑼灣": {"aliases": ["causeway bay", "时代广场"], "search": "Causeway Bay", "display": "銅鑼灣", "country": "HK"},
    "中環": {"aliases": ["central", "中環碼頭", "蘭桂坊"], "search": "Central Hong Kong", "display": "中環", "country": "HK"},
    "大嶼山": {"aliases": ["lantau", "昂坪360", "天壇大佛"], "search": "Lantau Island", "display": "大嶼山", "country": "HK"},
    "海洋公園": {"aliases": ["ocean park", "海洋公園"], "search": "Ocean Park Hong Kong", "display": "海洋公園", "country": "HK"},
    "香港機場": {"aliases": ["hong kong airport", "hkg", "赤鱲角"], "search": "Hong Kong International Airport", "display": "香港國際機場", "country": "HK"},
}

# 預先計算排序後的鍵（最長優先匹配）
LANDMARKS_KEYS_SORTED = sorted(LANDMARKS_DB.keys(), key=len, reverse=True)

def translate_famous_landmark(query: str, country_code: str = None) -> tuple:
    """🏰 確定性翻譯著名景點（無需 AI）
    
    Returns: (search_terms: list, display_name: str, landmark_data: dict|None) 或 ([query], None, None)
    """
    query_lower = query.lower().strip()
    
    # 使用最長優先匹配（關鍵字必須在查詢中，防止誤匹配）
    for landmark_key in LANDMARKS_KEYS_SORTED:
        landmark = LANDMARKS_DB[landmark_key]
        
        # 檢查主關鍵字（必須是關鍵字在查詢中，而不是反過來）
        if landmark_key.lower() in query_lower:
            print(f"🏰 Landmark Match: '{query}' → '{landmark['display']}'")
            return ([landmark["search"], query], landmark["display"], landmark)
        
        # 檢查別名（同樣只檢查別名是否在查詢中）
        for alias in landmark.get("aliases", []):
            if alias.lower() in query_lower:
                print(f"🏰 Alias Match: '{alias}' → '{landmark['display']}'")
                return ([landmark["search"], query], landmark["display"], landmark)
    
    # 特殊處理：如果包含「迪士尼」和日本相關詞彙
    if "迪士尼" in query or "disney" in query_lower:
        if country_code == "JP" or any(jp in query.lower() for jp in ["東京", "tokyo", "日本", "japan"]):
            disney = LANDMARKS_DB.get("東京迪士尼")
            return (["Tokyo Disneyland", "東京ディズニーランド", query], "東京迪士尼樂園", disney)
        elif country_code == "HK" or "香港" in query:
            return (["Hong Kong Disneyland", query], "香港迪士尼樂園", None)
    
    return ([query], None, None)

async def detect_country_from_trip_title(trip_title: str, api_key: str = None) -> str:
    """🧠 使用 Gemini 從行程標題判斷目的地國家
    
    Returns: 國家代碼 (JP, KR, TW...) 或 None
    """
    if not trip_title or not api_key:
        return None
    
    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""判斷這個旅遊行程的目的地國家。

行程標題：「{trip_title}」

請只回覆國家代碼（如 JP、KR、TW、TH、VN、SG、HK）。
如果無法判斷或是多國行程，回覆 NONE。
只輸出代碼，不要其他文字。"""

        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0,
                max_output_tokens=10
            )
        )
        
        result = response.text.strip().upper()
        if result in COUNTRY_BOUNDS:
            print(f"🧠 Trip title '{trip_title}' → Country: {result}")
            return result
        return None
    except Exception as e:
        print(f"🧠 Country detection error: {e}")
        return None


# 🆕 翻譯結果緩存（減少重複 AI 調用）
TRANSLATION_CACHE = {}  # {(query, country_code): [translations]}

async def translate_place_name(query: str, country_code: str, api_key: str = None) -> list:
    """🔤 使用 Gemini 將地名翻譯成目標國家語言
    
    Returns: 搜尋變體列表 [翻譯後, 英文, 原文]
    """
    if not country_code or not api_key:
        return [query]
    
    # 🆕 緩存檢查
    cache_key = (query.lower(), country_code)
    if cache_key in TRANSLATION_CACHE:
        print(f"🔤 CACHE HIT: '{query}' → {TRANSLATION_CACHE[cache_key]}")
        return TRANSLATION_CACHE[cache_key]
    
    country_info = COUNTRY_BOUNDS.get(country_code)
    if not country_info:
        return [query]
    
    try:
        client = genai.Client(api_key=api_key)
        country_name = country_info["name"]
        
        prompt = f"""你是地名翻譯專家。用戶正在搜尋{country_name}的地點。

用戶輸入：「{query}」

請判斷這是否為{country_name}的地名或景點：
1. 如果是，輸出該地名的【當地語言寫法】和【英文/羅馬拼音】
2. 如果不確定，只輸出原文

格式：每行一個，最多3行，不要編號或說明。
例如：
浅草寺
Senso-ji
淺草寺"""

        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0,
                max_output_tokens=100
            )
        )
        
        lines = [line.strip() for line in response.text.strip().split("\n") if line.strip()]
        if lines:
            # 確保原始查詢也在列表中
            if query not in lines:
                lines.append(query)
            result = lines[:3]  # 最多3個變體
            # 🆕 存入緩存
            TRANSLATION_CACHE[cache_key] = result
            print(f"🔤 Translated '{query}' → {result} (cached)")
            return result
        return [query]
    except Exception as e:
        print(f"🔤 Translation error: {e}")
        return [query]


def filter_results_by_country(results: list, country_code: str, strict: bool = True) -> list:
    """🗺️ 根據經緯度過濾結果，只保留目標國家內的地點
    
    Args:
        strict: 若為 True，且過濾後有結果，則只返回過濾後的結果。
               若過濾後無結果，則根據策略決定是否返回原結果。
    """
    if not country_code or country_code not in COUNTRY_BOUNDS:
        return results
    
    bounds = COUNTRY_BOUNDS[country_code]
    filtered = []
    
    for r in results:
        lat = r.get("lat", 0)
        lng = r.get("lng", 0)
        
        # 寬鬆邊界檢查 (+/- 0.1 度緩衝)
        if (bounds["lat_min"] - 0.1 <= lat <= bounds["lat_max"] + 0.1 and 
            bounds["lng_min"] - 0.1 <= lng <= bounds["lng_max"] + 0.1):
            filtered.append(r)
    
    if filtered:
        print(f"🗺️ Filtered: {len(results)} → {len(filtered)} (Strict: {country_code})")
        return filtered
    
    # 如果嚴格過濾後完全沒結果
    if strict:
        print(f"🗺️ Filtered: {len(results)} → 0 (Strict mode: discarding all)")
        return []
        
    print(f"🗺️ Filtered: {len(results)} → 0 (Relaxed: returning original)")
    return results


# 🌍 地理編碼 API 端點（供前端使用）
# GeocodeSearchRequest, GeocodeReverseRequest 已移至 models/base.py

async def detect_country_from_query(query: str, api_key: str = None) -> str:
    """🧠 從搜尋關鍵字推斷國家（當標題失效時的 Fallback）"""
    if not query or not api_key:
        return None
        
    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""用戶正在搜尋旅遊地點，請推測目標國家。
搜尋關鍵字：「{query}」

請只回覆國家代碼（如 JP, KR, TW, TH...）。
範例：
"東京迪士尼" -> JP
"首爾塔" -> KR
"士林夜市" -> TW
"101" -> TW

如果無法確定，回覆 NONE。
只輸出代碼，不要其他文字。"""

        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0, max_output_tokens=10)
        )
        result = response.text.strip().upper()
        if result in COUNTRY_BOUNDS:
            print(f"🧠 Query '{query}' → Country: {result}")
            return result
        return None
    except Exception:
        return None

async def smart_geocode_logic(query: str, limit: int, trip_title: str = None, api_key: str = None, lat: float = None, lng: float = None) -> dict:
    """共用的智能地理編碼邏輯"""
    log_debug(f"🔍 [SmartGeo] Start search: '{query}' (Trip: {trip_title}, Bias: {lat},{lng})")
    
    # 🧠 Step 0: 智能國家判斷和翻譯
    country_code = None
    search_queries = [query]
    chinese_display = None  # 🆕 中文顯示名稱
    
    # 🆕 第一優先級：關鍵字規則（確定性，零延遲，無需 API Key）
    country_code = detect_country_from_keywords(query)
    if country_code:
        log_debug(f"   🔑 Keyword Match → {country_code}")
    
    # 第二優先級：AI 判斷（需要 API Key）
    if not country_code and api_key:
        # 嘗試從標題判斷
        if trip_title:
            log_debug("   🧠 invoking detect_country_from_trip_title...")
            country_code = await detect_country_from_trip_title(trip_title, api_key)
            log_debug(f"   🧠 Detected Country (Title): {country_code}")
        
        # 若標題失敗，嘗試從 Query 判斷
        if not country_code:
            log_debug("   🧠 Title detection failed/skipped. Trying query detection...")
            country_code = await detect_country_from_query(query, api_key)
            log_debug(f"   🧠 Detected Country (Query): {country_code}")

    # 🆕 Step 1: 先嘗試確定性著名景點翻譯（無需 API Key）
    landmark_result = translate_famous_landmark(query, country_code)
    search_terms, display_name, landmark_data = landmark_result
    
    # 🚀 INSTANT RETURN: 如果景點有座標，直接回傳，完全跳過 API 調用
    if landmark_data and landmark_data.get("lat") and landmark_data.get("lng"):
        instant_result = {
            "lat": landmark_data["lat"],
            "lng": landmark_data["lng"],
            "name": landmark_data.get("display", display_name),
            "address": f"{landmark_data.get('display', display_name)}, {landmark_data.get('country', '')}",
            "type": "landmark",
            "source": "landmarks_db",
            "original_name": query
        }
        log_debug(f"   ⚡ INSTANT RETURN: {display_name} ({landmark_data['lat']}, {landmark_data['lng']})")
        return {"results": [instant_result], "source": "landmarks_db"}
    
    if display_name:  # 匹配到著名景點（但沒有座標，需要搜索）
        search_queries = search_terms
        chinese_display = display_name
        log_debug(f"   🏰 Landmark Translated: {search_queries} → Display: {chinese_display}")
    # Step 2: 若著名景點沒匹配，嘗試 AI 翻譯
    elif country_code and api_key:
        translated = await translate_place_name(query, country_code, api_key)
        search_queries = translated
        log_debug(f"   🔤 AI Translated: {translated}")
    elif not country_code:
        log_debug("   ⚠️ No country detected, using broad search")
    

    
    all_results = []
    found_source = "none"
    
    for q in search_queries:
        if len(all_results) >= limit:
            break
            
        # Photon
        photon = await geocode_with_photon(q, limit, lat, lng)
        if photon:
            for r in photon: r["source"] = "photon"
            all_results.extend(photon)
            found_source = "photon"
            continue
        
        # Nominatim
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                params = {"q": q, "format": "json", "limit": limit, "addressdetails": 1}
                if country_code: params["countrycodes"] = country_code.lower()
                res = await client.get("https://nominatim.openstreetmap.org/search", params=params, headers={"User-Agent": "RyanTravelApp/2.0"})
                data = res.json()
                if data:
                    for item in data:
                        all_results.append({
                            "lat": float(item["lat"]), "lng": float(item["lon"]),
                            "name": item.get("name") or item.get("display_name", "").split(",")[0],
                            "address": item.get("display_name", ""), "type": item.get("type", "place"),
                            "source": "nominatim"
                        })
                    found_source = "nominatim"
        except Exception as e:
            print(f"   ⚠️ Nominatim error: {e}")

    # ArcGIS Fallback
    if not all_results and ARCGIS_API_KEY:
        try:
            params = {"SingleLine": query, "f": "json", "outFields": "PlaceName,Place_addr,Type", "maxLocations": limit, "token": ARCGIS_API_KEY}
            if lat is not None and lng is not None:
                params["location"] = f"{lng},{lat}" # ArcGIS uses x,y
                params["distance"] = 50000 # 50km radius bias
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(
                    "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
                    params=params
                )
                data = res.json()
                if data.get("candidates"):
                    for c in data["candidates"]:
                        all_results.append({
                            "lat": c["location"]["y"], "lng": c["location"]["x"],
                            "name": c.get("attributes", {}).get("PlaceName", query),
                            "address": c.get("attributes", {}).get("Place_addr", ""),
                            "type": c.get("attributes", {}).get("Type", "place"),
                            "source": "arcgis"
                        })
                    found_source = "arcgis"
        except Exception:
            pass

    # 🗺️ 嚴格過濾
    if country_code and all_results:
        all_results = filter_results_by_country(all_results, country_code, strict=True)

    # 去重
    seen = set()
    unique = []
    for r in all_results:
        key = (round(r["lat"], 5), round(r["lng"], 5))
        if key not in seen:
            seen.add(key)
            unique.append(r)

    # 🆕 注入中文顯示名稱
    if chinese_display and unique:
        unique[0]["name"] = chinese_display
        unique[0]["original_name"] = unique[0].get("name", query)  # 保留原始名稱
        log_debug(f"   ✨ Injected Chinese Name: {chinese_display}")

    return {"results": unique[:limit], "source": found_source}

def log_debug(msg):
    # Use print instead of file write (HF Spaces has read-only filesystem)
    print(f"[DEBUG] {msg}")

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

@app.post("/api/geocode/search")
async def geocode_search(
    request: GeocodeSearchRequest,
    x_gemini_key: str = Header(None, alias="X-Gemini-Key")
):
    """🔍 智能地理編碼搜尋（四層架構）"""
    log_debug(f"REQ: q='{request.query}', trip='{request.tripTitle}', bias={request.lat},{request.lng}")
    return await smart_geocode_logic(request.query, request.limit, request.tripTitle, x_gemini_key, request.lat, request.lng)


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
           - **desc (短備註)**: 簡短說明 (< 30 字)，如「民宿 Check-in」「必吃拉麵」
           - **memo (詳細備忘)**: 較長的地點指引或說明，如「從 B3 出口走 2 分鐘」「需提前 30 分預約」「營業至 22:00」
        
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
                    "desc": "民宿 Check-in",
                    "memo": "從押上站 B3 出口出來右轉直走約 2 分鐘",
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



# 簡化的 AI 生成請求 (SimplePromptRequest 已移至 models/base.py)

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
        
        # 🆕 Fix: 直接使用 Client + JSON Mode，確保不被截斷
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=PRIMARY_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                max_output_tokens=8192
            )
        )
        raw_text = response.text
        
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



# --- 存檔/行程相關資料模型 ---
# ItineraryItem, SaveItineraryRequest, JoinTripRequest, CreateManualTripRequest,
# UpdateItemRequest, CreateItemRequest 已移至 models/base.py

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

# 🔥 功能 3.0.1: 匯入到現有行程 (ImportToTripRequest 已移至 models/base.py)

@app.post("/api/import-to-trip")
async def import_to_trip(request: ImportToTripRequest):
    print(f"📥 正在匯入至現有行程 ID: {request.trip_id}...")
    
    try:
        # 1. 檢查行程是否存在並獲取現有資料
        trip_res = supabase.table("itineraries").select("*").eq("id", request.trip_id).execute()
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="找不到指定的行程")
            
        existing_trip = trip_res.data[0]
        existing_content = existing_trip.get("content") or {}
        
        # 2. 合併 content 資料 (深度合併)
        # 用戶匯入的新資料優先於舊資料（或者保留舊資料？通常匯入是為了充實，所以合併）
        def merge_dicts(old_d, new_d):
            if not new_d: return old_d or {}
            if not old_d: return new_d
            result = old_d.copy()
            result.update(new_d) # 簡單的 key-level update
            return result
            
        updated_content = {
            "daily_locations": merge_dicts(existing_content.get("daily_locations"), request.daily_locations),
            "day_notes": merge_dicts(existing_content.get("day_notes"), request.day_notes),
            "day_costs": merge_dicts(existing_content.get("day_costs"), request.day_costs),
            "day_tickets": merge_dicts(existing_content.get("day_tickets"), request.day_tickets)
        }
        
        # 3. 更新主行程 content
        supabase.table("itineraries").update({"content": updated_content}).eq("id", request.trip_id).execute()
        
        # 4. 插入細項 (Children)
        items_data = []
        for item in request.items:
            items_data.append({
                "itinerary_id": request.trip_id,
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
                "tags": item.tags,
                "sub_items": item.sub_items,
                "link_url": item.link_url
            })
            
        if items_data:
            print(f"   📦 準備插入 {len(items_data)} 個細項...")
            supabase.table("itinerary_items").insert(items_data).execute()
            
        return {"status": "success", "message": f"成功匯入 {len(items_data)} 個項目"}

    except Exception as e:
        import traceback
        print(f"🔥 Import Error: {e}")
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

# 🔥 功能 3.3.5: 更新每日資訊 (UpdateDayDataRequest 已移至 models/base.py)

@app.put("/api/trips/{trip_id}/day-data")
async def update_day_data(trip_id: str, request: UpdateDayDataRequest):
    """更新特定天的注意事項、預估花費、交通票券"""
    try:
        print(f"📝 更新 Day {request.day} 資訊 for Trip {trip_id}")
        
        # 1. 取得現有行程
        trip_res = supabase.table("itineraries").select("content").eq("id", trip_id).execute()
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        content = trip_res.data[0].get("content") or {}
        
        # 2. 更新對應的資料 (注意: 前端傳來的 key 是字串或整數，需統一處理)
        day_key = str(request.day)
        
        if request.day_notes is not None:
            existing_notes = content.get("day_notes", {})
            # 前端傳來的格式: { "1": [...] } 或 { 1: [...] }
            new_data = request.day_notes.get(day_key) or request.day_notes.get(request.day) or []
            existing_notes[day_key] = new_data
            content["day_notes"] = existing_notes
            
        if request.day_costs is not None:
            existing_costs = content.get("day_costs", {})
            new_data = request.day_costs.get(day_key) or request.day_costs.get(request.day) or []
            existing_costs[day_key] = new_data
            content["day_costs"] = existing_costs
            
        if request.day_tickets is not None:
            existing_tickets = content.get("day_tickets", {})
            new_data = request.day_tickets.get(day_key) or request.day_tickets.get(request.day) or []
            existing_tickets[day_key] = new_data
            content["day_tickets"] = existing_tickets
        
        # 🆕 行前清單
        if request.day_checklists is not None:
            existing_checklists = content.get("day_checklists", {})
            new_data = request.day_checklists.get(day_key) or request.day_checklists.get(request.day) or []
            existing_checklists[day_key] = new_data
            content["day_checklists"] = existing_checklists
        
        # 3. 寫回資料庫
        update_res = supabase.table("itineraries").update({"content": content}).eq("id", trip_id).execute()
        
        print(f"✅ Day {request.day} 資訊更新成功")
        return {"status": "success", "day": request.day}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Update Day Data Error: {e}")
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
            "day_checklists": (trip.get("content") or {}).get("day_checklists", {}),

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
# 🔥 功能 8.1: 刪除整天行程 (Deep Logic Fix)
@app.delete("/api/trips/{trip_id}/days/{day_number}")
async def delete_day(trip_id: str, day_number: int):
    print(f"🗑️ 嘗試刪除行程 {trip_id} 的第 {day_number} 天 (With Deep Content Clean)")
    try:
        from datetime import datetime, timedelta

        # 1. 取得現有行程與 content
        trip = supabase.table("itineraries").select("start_date, end_date, content").eq("id", trip_id).single().execute()
        if not trip.data:
            raise HTTPException(status_code=404, detail="行程不存在")

        # 2. 刪除該天的所有細項 (Activities)
        res = supabase.table("itinerary_items")\
            .delete()\
            .eq("itinerary_id", trip_id)\
            .eq("day_number", day_number)\
            .execute()
        deleted_count = len(res.data) if res.data else 0
        
        # 3. 調整後續天數的 activities (day_number - 1)
        remaining = supabase.table("itinerary_items")\
            .select("id, day_number")\
            .eq("itinerary_id", trip_id)\
            .gt("day_number", day_number)\
            .execute()
        
        for item in remaining.data:
             supabase.table("itinerary_items")\
                .update({"day_number": item["day_number"] - 1})\
                .eq("id", item["id"])\
                .execute()

        # 4. 🧠 Deep Content Shift (處理 content 內的 Map 結構)
        # 用來防止「幽靈資料」：刪除的天數資料必須清空，後面的資料必須往前補
        content = trip.data.get("content") or {}
        
        # 定義所有需要處理的 Map 欄位
        DAY_MAP_FIELDS = ["daily_locations", "day_notes", "day_costs", "day_tickets", "day_checklists"]
        
        # 計算最大天數 (為了迴圈邊界)
        start_date = datetime.strptime(trip.data["start_date"], "%Y-%m-%d") if trip.data.get("start_date") else None
        end_date = datetime.strptime(trip.data["end_date"], "%Y-%m-%d") if trip.data.get("end_date") else None
        current_max_day = (end_date - start_date).days + 1 if (start_date and end_date) else 30 # Fallback 30

        for field in DAY_MAP_FIELDS:
            if field in content and isinstance(content[field], dict):
                # A. 先刪除目標天數的資料 (壁紙撕掉)
                if str(day_number) in content[field]:
                    del content[field][str(day_number)]
                
                # B. 後面的天數往前移 (10 -> 9, 9 -> 8 ... day_number+1 -> day_number)
                # 必須從 day_number + 1 開始往後掃描直到 current_max_day
                for i in range(day_number + 1, current_max_day + 2): # +2 for safety buffer
                    old_key = str(i)
                    new_key = str(i - 1)
                    
                    if old_key in content[field]:
                        # 搬移資料
                        content[field][new_key] = content[field][old_key]
                        # 刪除舊位址 (這是關鍵，不然會變成複製)
                        del content[field][old_key]

        # 5. 更新行程 (Content + EndDate)
        updates = {"content": content}
        
        if end_date:
            new_end = end_date - timedelta(days=1)
            updates["end_date"] = new_end.strftime("%Y-%m-%d")
            
        supabase.table("itineraries").update(updates).eq("id", trip_id).execute()

        print(f"   ✅ Day {day_number} 刪除完成，Content 已校正，Activities 已位移")
        return {"status": "success", "deleted_items": deleted_count}

    except Exception as e:
        print(f"🔥 Delete Day Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 🆕 功能 8.2: 新增天數 (Deep Logic Fix + Smart Clone + Ghostbuster)
class AddDayRequest(BaseModel):
    position: str = "end"  # "end" 或 "before:N" (例如 "before:3")
    clone_content: bool = False # 🆕 是否移植鄰近天數的內容

@app.post("/api/trips/{trip_id}/days")
async def add_day(trip_id: str, request: AddDayRequest):
    print(f"➕ 嘗試新增天數到行程 {trip_id}, 位置: {request.position}, 移植內容: {request.clone_content} (With Ghostbuster)")
    try:
        from datetime import datetime, timedelta
        
        # 1. 取得現有行程資訊
        trip = supabase.table("itineraries").select("start_date, end_date, content").eq("id", trip_id).single().execute()
        if not trip.data:
            raise HTTPException(status_code=404, detail="行程不存在")
            
        content = trip.data.get("content") or {}
        # 全部欄位 (用於位移)
        DAY_MAP_FIELDS = ["daily_locations", "day_notes", "day_costs", "day_tickets", "day_checklists"]
        # 🧠 Smart Clone 允許複製的欄位 (排除花費與票券)
        CLONEABLE_FIELDS = ["daily_locations", "day_notes", "day_checklists"]

        # 2. 計算目前的天數 (精確計算) & Ghostbuster 👻 找出隱藏的最大天數
        start_date = datetime.strptime(trip.data["start_date"], "%Y-%m-%d") if trip.data.get("start_date") else datetime.now()
        end_date = datetime.strptime(trip.data["end_date"], "%Y-%m-%d") if trip.data.get("end_date") else start_date
        date_calculated_days = (end_date - start_date).days + 1
        
        # 🔍 Ghostbuster: 掃描 content 找出真正的 max key (解決字串排序問題 "10" < "2")
        all_content_keys = []
        for field in DAY_MAP_FIELDS:
            if field in content and isinstance(content[field], dict):
                all_content_keys.extend(content[field].keys())
        
        valid_day_nums = [int(k) for k in all_content_keys if k.isdigit()] # 強制轉 INT
        content_max_day = max(valid_day_nums) if valid_day_nums else 0
        
        # 取最大的作為當前邊界，確保位移時能覆蓋到所有幽靈資料
        # 但如果是 "新增到結尾"，我們應該忽略幽靈，直接覆蓋在正確的天數上
        shift_limit_day = max(date_calculated_days, content_max_day)
        
        if content_max_day > date_calculated_days:
            print(f"   👻 發現幽靈資料! Content Max: {content_max_day} > Date Max: {date_calculated_days}")

        new_day = -1
        source_day_for_clone = None

        # 3. 根據 position 處理
        if request.position == "end":
            # 新增到最後一天之後 - 直接鎖定正確的日期順序，無視幽靈 (Overwrite)
            new_day = date_calculated_days + 1
            print(f"   ➕ 新增 Day {new_day} 到結尾 (覆蓋該位置可能的幽靈)")
            source_day_for_clone = new_day - 1 # 若要複製，來源是原本的最後一天
            
        elif request.position.startswith("before:"):
            # 插入到指定天之前
            insert_before = int(request.position.split(":")[1])
            insert_before = max(1, insert_before)
            new_day = insert_before
            source_day_for_clone = insert_before 
            
            # A. 調整 Activities
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
            
            # B. 🧠 Deep Content Shift (Reverse Order)
            # 這裡必須使用 shift_limit_day，確保連同幽靈資料一起往後移，避免資料損失
            for field in DAY_MAP_FIELDS:
                if field not in content: content[field] = {}
                if not isinstance(content[field], dict): content[field] = {}

                for i in range(shift_limit_day, insert_before - 1, -1):
                    old_key = str(i)
                    new_key = str(i + 1)
                    
                    if old_key in content[field]:
                        content[field][new_key] = content[field][old_key]
                        del content[field][old_key]
            
            # 修正 Clone Source
            if insert_before == 1:
                source_day_for_clone = 2 
            else:
                source_day_for_clone = insert_before - 1

            print(f"   ➕ 插入 Day {new_day}, Content 已反向位移")

        else:
            raise HTTPException(status_code=400, detail="無效的 position 格式")
        
        # 4. 🔥 Scorched Earth Clean (焦土清理)
        # 強制清理 new_day 位置，不管之前有沒有幽靈，都得死
        target_key = str(new_day)
        print(f"   🔥 執行焦土清理 Day {new_day}")
        
        cleaned_count = 0
        for field in DAY_MAP_FIELDS:
             if field not in content: content[field] = {}
             if target_key in content[field]:
                 del content[field][target_key]
                 print(f"      🧹 已清除殘留資料: {field}[{target_key}]")
                 cleaned_count += 1
        
        if cleaned_count > 0:
            print(f"   ✅ 焦土清理完成，共清除 {cleaned_count} 個欄位")

        # 5. 🧠 Smart Clone 執行 (如果需要)
        # 此時 new_day 已經絕對乾淨
        if request.clone_content and source_day_for_clone:
            print(f"   🌱 執行智慧移植: 從 Day {source_day_for_clone} -> Day {new_day}")
            src_key = str(source_day_for_clone)
            
            for field in CLONEABLE_FIELDS: # 只複製允許的欄位
                if field in content and src_key in content[field]:
                    import copy
                    content[field][target_key] = copy.deepcopy(content[field][src_key])
                    print(f"      ✅ 複製 {field}")

        # 6. 更新行程 (Content + EndDate)
        # 如果是 Append End: 總天數 = 舊天數 + 1
        # 如果是 Insert Before: 總天數 = 舊天數 + 1 (因為所有東西都推後了一天)
        # 注意：如果原本有幽靈資料 (Max > Date)，Insert 後 Max 也會 +1。
        # 我們這裡只關心 "合法的行程長度"。如果原本有 5 天 (date), Insert 1 天 -> 變成 6 天。
        # 不管 content max 是多少，end date 應該只反應合法的增加。
        
        final_total_days = date_calculated_days + 1
        
        new_end_date = start_date + timedelta(days=final_total_days - 1)
        
        updates = {
            "content": content,
            "end_date": new_end_date.strftime("%Y-%m-%d")
        }
        
        supabase.table("itineraries").update(updates).eq("id", trip_id).execute()
        
        return {"status": "success", "new_day": new_day, "total_days": final_total_days}

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
        trips_res = supabase.table("itineraries").select("id").eq("created_by", user_id).execute()
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
        trip_res = supabase.table("itineraries").delete().eq("created_by", user_id).execute()
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


# 🆕 v4.0: POI AI 增強 (Progressive Intelligence Layer 2)
class POIAIEnrichRequest(BaseModel):
    name: str
    type: str
    lat: float
    lng: float
    api_key: Optional[str] = None


@app.post("/api/poi/ai-enrich")
async def ai_enrich_poi(request: POIAIEnrichRequest):
    """
    AI 增強 POI 端點 - 使用 Gemini + Grounding 取得評論摘要
    
    Returns:
        {
            "summary": "AI 懶人包",
            "must_try": ["推薦 1", "推薦 2"],
            "rating": 4.5,
            "business_status": "OPERATIONAL"
        }
    """
    try:
        api_key = request.api_key
        if not api_key:
            raise HTTPException(status_code=400, detail="需要 API Key")
        
        from services.model_manager import call_extraction
        
        prompt = f"""
You are a travel guide assistant. Search the web for information about this place and provide a structured response.

Target:
- Name: {request.name}
- Type: {request.type}
- Location: {request.lat}, {request.lng}

Please search for reviews, ratings, and popular items (if it's a restaurant).

Output in this EXACT JSON format (no markdown, pure JSON):
{{
    "summary": "A 1-2 sentence vibe check in Traditional Chinese (e.g., 氛圍舒適的咖啡廳，適合約會或工作)",
    "must_try": ["Item 1", "Item 2", "Item 3"],
    "rating": 4.5,
    "business_status": "OPERATIONAL"
}}

If it's not a restaurant, put relevant highlights in must_try field (e.g., ["夜景絕美", "拍照聖地"]).
Rating should be a number from 1-5 based on general web sentiment.
"""
        
        result = await call_extraction(api_key, prompt, "POI_ENRICH")
        
        # 解析 JSON
        import re
        json_match = re.search(r'\{[\s\S]*\}', result)
        if json_match:
            data = json.loads(json_match.group())
            return data
        else:
            return {
                "summary": result[:200],
                "must_try": [],
                "rating": 0,
                "business_status": "UNKNOWN"
            }
        
    except Exception as e:
        print(f"🔥 AI POI 增強失敗：{e}")
        raise HTTPException(status_code=500, detail=f"AI 增強失敗: {str(e)}")


# 🆕 v3.7: POI 三源整合 API
from services.poi_service import enrich_poi_complete, format_enriched_poi_for_ai


class POIEnrichRequest(BaseModel):
    name: str  # 景點名稱
    wikidata_id: Optional[str] = None  # Wikidata ID (可選)


@app.post("/api/poi/enrich")
async def enrich_poi(request: POIEnrichRequest):
    """
    三源整合 POI 端點 - Wikipedia + WikiVoyage + Wikidata
    
    Returns:
        {
            "display_name": {"primary": "金閣寺", "secondary": "金閣寺 (Kinkaku-ji)"},
            "cultural_desc": "...",
            "travel_tips": "...",
            "official_url": "..."
        }
    """
    try:
        poi = {
            "name": request.name,
            "wikidata_id": request.wikidata_id or ""
        }
        
        enriched = await enrich_poi_complete(poi)
        formatted = format_enriched_poi_for_ai(enriched)
        
        return {
            "success": True,
            "poi": enriched,
            "formatted": formatted
        }
        
    except Exception as e:
        print(f"🔥 POI 整合失敗：{e}")
        raise HTTPException(status_code=500, detail=f"POI 整合失敗: {str(e)}")


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
