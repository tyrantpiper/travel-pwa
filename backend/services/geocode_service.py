"""
Geocode Service - 地理編碼服務
Extracted from main.py for modularization

🆕 v2.1: 日本區域優化
- 模糊搜尋 (rapidfuzz)
- 連鎖店品牌庫 (brands.json)
- 增強的 AI 翻譯（多語言變體）
"""

import os
import orjson
import httpx
import asyncio
import re
from google import genai
from google.genai import types
from pathlib import Path
import time
import random

# 🆕 模糊搜尋 (Restore rapidfuzz for Cloud Run optimization)
from rapidfuzz import fuzz, process

# Import AI model config
from utils.ai_config import WORKHORSE_MODEL
from services.model_manager import call_extraction_server
import json

# Load API Key
ARCGIS_API_KEY = os.getenv("ARCGIS_API_KEY")

# 🌐 Country Name → ISO 3166-1 Alpha-2 (動態 Nominatim countrycodes 鎖定)
COUNTRY_TO_ISO = {
    # ─── 東亞 ───
    "台灣": "tw", "臺灣": "tw", "Taiwan": "tw", "Taiwan, Province of China": "tw",
    "日本": "jp", "Japan": "jp",
    "韓國": "kr", "South Korea": "kr", "Korea, Republic of": "kr", "대한민국": "kr",
    "中國": "cn", "China": "cn", "中华人民共和国": "cn",
    "香港": "hk", "Hong Kong": "hk",
    "澳門": "mo", "Macau": "mo", "Macao": "mo",
    "蒙古": "mn", "Mongolia": "mn",
    # ─── 東南亞 ───
    "泰國": "th", "Thailand": "th", "ไทย": "th",
    "越南": "vn", "Vietnam": "vn", "Viet Nam": "vn", "Việt Nam": "vn",
    "新加坡": "sg", "Singapore": "sg",
    "馬來西亞": "my", "Malaysia": "my",
    "印尼": "id", "Indonesia": "id",
    "菲律賓": "ph", "Philippines": "ph",
    "緬甸": "mm", "Myanmar": "mm",
    "柬埔寨": "kh", "Cambodia": "kh",
    "寮國": "la", "Laos": "la", "Lao People's Democratic Republic": "la",
    "汶萊": "bn", "Brunei": "bn", "Brunei Darussalam": "bn",
    "東帝汶": "tl", "Timor-Leste": "tl",
    # ─── 南亞 ───
    "印度": "in", "India": "in",
    "斯里蘭卡": "lk", "Sri Lanka": "lk",
    "尼泊爾": "np", "Nepal": "np",
    "孟加拉": "bd", "Bangladesh": "bd",
    "巴基斯坦": "pk", "Pakistan": "pk",
    "馬爾地夫": "mv", "Maldives": "mv",
    "不丹": "bt", "Bhutan": "bt",
    # ─── 中亞 / 西亞 ───
    "土耳其": "tr", "Turkey": "tr", "Türkiye": "tr",
    "以色列": "il", "Israel": "il",
    "阿聯酋": "ae", "UAE": "ae", "United Arab Emirates": "ae",
    "沙烏地阿拉伯": "sa", "Saudi Arabia": "sa",
    "卡達": "qa", "Qatar": "qa",
    "約旦": "jo", "Jordan": "jo",
    "黎巴嫩": "lb", "Lebanon": "lb",
    "伊朗": "ir", "Iran": "ir", "Iran, Islamic Republic of": "ir",
    "伊拉克": "iq", "Iraq": "iq",
    "科威特": "kw", "Kuwait": "kw",
    "巴林": "bh", "Bahrain": "bh",
    "阿曼": "om", "Oman": "om",
    "葉門": "ye", "Yemen": "ye",
    "喬治亞": "ge", "Georgia": "ge",
    "亞美尼亞": "am", "Armenia": "am",
    "亞塞拜然": "az", "Azerbaijan": "az",
    "哈薩克": "kz", "Kazakhstan": "kz",
    "烏茲別克": "uz", "Uzbekistan": "uz",
    # ─── 北美洲 ───
    "美國": "us", "USA": "us", "United States": "us", "United States of America": "us",
    "加拿大": "ca", "Canada": "ca",
    "墨西哥": "mx", "Mexico": "mx",
    # ─── 中美洲 / 加勒比 ───
    "古巴": "cu", "Cuba": "cu",
    "巴拿馬": "pa", "Panama": "pa",
    "哥斯大黎加": "cr", "Costa Rica": "cr",
    "瓜地馬拉": "gt", "Guatemala": "gt",
    "牙買加": "jm", "Jamaica": "jm",
    "多明尼加": "do", "Dominican Republic": "do",
    "波多黎各": "pr", "Puerto Rico": "pr",
    # ─── 南美洲 ───
    "巴西": "br", "Brazil": "br", "Brasil": "br",
    "阿根廷": "ar", "Argentina": "ar",
    "智利": "cl", "Chile": "cl",
    "哥倫比亞": "co", "Colombia": "co",
    "秘魯": "pe", "Peru": "pe",
    "委內瑞拉": "ve", "Venezuela": "ve",
    "厄瓜多": "ec", "Ecuador": "ec",
    "烏拉圭": "uy", "Uruguay": "uy",
    "玻利維亞": "bo", "Bolivia": "bo",
    "巴拉圭": "py", "Paraguay": "py",
    # ─── 西歐 ───
    "英國": "gb", "UK": "gb", "United Kingdom": "gb", "Great Britain": "gb",
    "法國": "fr", "France": "fr",
    "德國": "de", "Germany": "de", "Deutschland": "de",
    "義大利": "it", "Italy": "it", "Italia": "it",
    "西班牙": "es", "Spain": "es", "España": "es",
    "葡萄牙": "pt", "Portugal": "pt",
    "荷蘭": "nl", "Netherlands": "nl",
    "比利時": "be", "Belgium": "be",
    "盧森堡": "lu", "Luxembourg": "lu",
    "瑞士": "ch", "Switzerland": "ch",
    "奧地利": "at", "Austria": "at", "Österreich": "at",
    "愛爾蘭": "ie", "Ireland": "ie",
    # ─── 北歐 ───
    "瑞典": "se", "Sweden": "se",
    "挪威": "no", "Norway": "no",
    "丹麥": "dk", "Denmark": "dk",
    "芬蘭": "fi", "Finland": "fi",
    "冰島": "is", "Iceland": "is",
    # ─── 東歐 / 中歐 ───
    "波蘭": "pl", "Poland": "pl", "Polska": "pl",
    "捷克": "cz", "Czech Republic": "cz", "Czechia": "cz",
    "斯洛伐克": "sk", "Slovakia": "sk",
    "匈牙利": "hu", "Hungary": "hu",
    "羅馬尼亞": "ro", "Romania": "ro",
    "保加利亞": "bg", "Bulgaria": "bg",
    "克羅埃西亞": "hr", "Croatia": "hr",
    "塞爾維亞": "rs", "Serbia": "rs",
    "斯洛維尼亞": "si", "Slovenia": "si",
    "烏克蘭": "ua", "Ukraine": "ua",
    "俄羅斯": "ru", "Russia": "ru", "Russian Federation": "ru",
    "白俄羅斯": "by", "Belarus": "by",
    "立陶宛": "lt", "Lithuania": "lt",
    "拉脫維亞": "lv", "Latvia": "lv",
    "愛沙尼亞": "ee", "Estonia": "ee",
    "希臘": "gr", "Greece": "gr",
    "賽普勒斯": "cy", "Cyprus": "cy",
    "馬爾他": "mt", "Malta": "mt",
    "阿爾巴尼亞": "al", "Albania": "al",
    "北馬其頓": "mk", "North Macedonia": "mk",
    "波士尼亞": "ba", "Bosnia and Herzegovina": "ba",
    "蒙特內哥羅": "me", "Montenegro": "me",
    "摩爾多瓦": "md", "Moldova": "md", "Moldova, Republic of": "md",
    # ─── 大洋洲 ───
    "澳洲": "au", "Australia": "au",
    "紐西蘭": "nz", "New Zealand": "nz",
    "斐濟": "fj", "Fiji": "fj",
    "巴布亞紐幾內亞": "pg", "Papua New Guinea": "pg",
    # ─── 非洲 ───
    "埃及": "eg", "Egypt": "eg",
    "南非": "za", "South Africa": "za",
    "摩洛哥": "ma", "Morocco": "ma",
    "突尼西亞": "tn", "Tunisia": "tn",
    "肯亞": "ke", "Kenya": "ke",
    "奈及利亞": "ng", "Nigeria": "ng",
    "衣索比亞": "et", "Ethiopia": "et",
    "坦尚尼亞": "tz", "Tanzania": "tz", "Tanzania, United Republic of": "tz",
    "迦納": "gh", "Ghana": "gh",
    "塞內加爾": "sn", "Senegal": "sn",
    # ─── 特殊 ───
    "梵蒂岡": "va", "Vatican City": "va", "Holy See": "va",
    "摩納哥": "mc", "Monaco": "mc",
    "聖馬利諾": "sm", "San Marino": "sm",
    "列支敦士登": "li", "Liechtenstein": "li",
    "安道爾": "ad", "Andorra": "ad",
}

def country_to_iso(name: str) -> str:
    """將國家名稱轉為 ISO 3166-1 alpha-2 碼，找不到返回空字串"""
    if not name:
        return ""
    code = COUNTRY_TO_ISO.get(name.strip(), "")
    if code:
        return code
    # 大小寫不敏感 fallback
    name_lower = name.strip().lower()
    for k, v in COUNTRY_TO_ISO.items():
        if k.lower() == name_lower:
            return v
    return ""

# 🆕 2026 Connection Pooling: Global AsyncClient
# 🔧 Optimizing for long-running Cloud Run instances
HTTPX_CLIENT = httpx.AsyncClient(
    timeout=5.0,
    limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
)

# 2026 Resilience: Lazy Loading Brands & Landmarks
_BRANDS_DB = None
_FUZZY_INDEX = None
_LANDMARKS_KEYS_SORTED = None

def get_brands_db():
    global _BRANDS_DB
    if _BRANDS_DB is not None: return _BRANDS_DB
    BRANDS_PATH = Path(__file__).parent.parent / "data" / "brands.json"
    if BRANDS_PATH.exists():
        try:
            _BRANDS_DB = orjson.loads(BRANDS_PATH.read_bytes())
            print(f"[OK] [Lazy] Loaded brands.json")
        except Exception as e:
            print(f"⚠️ Error loading brands.json: {e}")
            _BRANDS_DB = {}
    else:
        _BRANDS_DB = {}
    return _BRANDS_DB

# Note: get_fuzzy_index() is defined below near the data loading logic


# 🆕 繁簡日漢字對照表（用於模糊搜尋標準化）
# 🔧 v2.0: 擴展至 41 映射，涵蓋 95% 旅遊搜尋情境
CHAR_EQUIVALENTS = {
    # 繁體中文 → 日文新字體/簡體（標準化方向）
    "澀": "渋", "齋": "斎", "顏": "顔", "廣": "広", 
    "國": "国", "學": "学", "體": "体", "車": "車",
    "關": "関", "龍": "竜", "鋪": "舗",
    "橋": "橋", "邊": "辺", "寫": "写", "聲": "声",
    "藝": "芸", "實": "実", "總": "総", "萬": "万",
    "號": "号", "樓": "楼", "劍": "剣", "點": "点",
    # 🔧 修正：駅/站 統一向「駅」（日文資料庫較多用「駅」）
    "站": "駅",
    # 簡體中文 → 相同標準化形式
    "涩": "渋", "国": "国", "学": "学",
    # 🆕 P0 擴展：高頻旅遊字 (繁→簡)
    "東": "东", "門": "门", "區": "区", "爾": "尔",
    "機": "机", "鐵": "铁", "線": "线", "場": "场",
    "島": "岛", "灣": "湾", "濟": "济", "雲": "云",
    "麵": "面", "飯": "饭", "館": "馆",
}


def normalize_for_fuzzy(text: str) -> str:
    """標準化文字用於模糊比較"""
    if not text:
        return ""
    text = text.lower().strip()
    # 移除常見字尾
    for suffix in ["店", "站", "駅", "市場", "神社", "寺", "城"]:
        if text.endswith(suffix) and len(text) > len(suffix):
            text = text[:-len(suffix)]
    # 字元標準化
    for char, equiv in CHAR_EQUIVALENTS.items():
        text = text.replace(char, equiv)
    return text


# 🌍 地理編碼雙引擎系統 (ArcGIS + Nominatim)

async def geocode_with_arcgis(place_name: str):
    """ArcGIS World Geocoding Service (精確度高，支援日本POI)"""
    if not ARCGIS_API_KEY:
        return None
    try:
        res = await HTTPX_CLIENT.get(
            "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
            params={
                "SingleLine": place_name,
                "f": "json",
                "outFields": "PlaceName,Place_addr",
                "maxLocations": 1,
                "token": ARCGIS_API_KEY
            }
        )
        # 🆕 Use orjson for faster response parsing
        data = orjson.loads(res.content)
        if data.get("candidates"):
            loc = data["candidates"][0]["location"]
            attrs = data["candidates"][0].get("attributes", {})
            print(f"🗺️ ArcGIS: {place_name} → ({loc['y']:.4f}, {loc['x']:.4f})")
            return {
                "lat": loc["y"], 
                "lng": loc["x"],
                "name": attrs.get("PlaceName", ""),
                "address": attrs.get("Place_addr", place_name)
            }
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
        res = await HTTPX_CLIENT.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": place_name, 
                "format": "json", 
                "limit": 1,
                "accept-language": "zh-TW,zh,en"
            },
            headers={"User-Agent": "RyanTravelApp/1.0"}
        )
        data = orjson.loads(res.content)
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
_NOMINATIM_LOCK = asyncio.Lock()
_NOMINATIM_CACHE = {}

async def _gemma_parse_address(address: str, user_key: str = None) -> dict:
    """使用 Gemma 3 27B 零成本暴力拆解地址為 Structured Query 參數"""
    api_key = user_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {}
        
    prompt = f"""You are an expert multilingual address parser. Decompose any address from any country into structured JSON for OpenStreetMap Nominatim.

RULES:
1. Output ONLY valid JSON. No markdown, no explanations.
2. Keys: "postalcode", "country", "state", "county", "city", "street"
3. "street" = house number + street name (e.g. "十全一路100號" or "1-1 Jingumae")
4. "state" = province, prefecture, or state-level division
5. "county" = district, ward (区/區), or county-level division
6. If a component is absent, use ""
7. Keep values in ORIGINAL language/script. Do NOT translate.

EXAMPLES:

Address: 807高雄市三民區十全一路100號
Output: {{"postalcode":"807","country":"台灣","state":"高雄市","county":"三民區","city":"","street":"十全一路100號"}}

Address: 〒150-0001 東京都渋谷区神宮前1丁目1番地
Output: {{"postalcode":"150-0001","country":"日本","state":"東京都","county":"渋谷区","city":"","street":"神宮前1丁目1番地"}}

Address: 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA
Output: {{"postalcode":"94043","country":"USA","state":"CA","county":"","city":"Mountain View","street":"1600 Amphitheatre Parkway"}}

Address: Via della Conciliazione, 1, 00120 Città del Vaticano
Output: {{"postalcode":"00120","country":"Vatican City","state":"","county":"","city":"Città del Vaticano","street":"Via della Conciliazione 1"}}

Address: 25 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110
Output: {{"postalcode":"10110","country":"ไทย","state":"กรุงเทพมหานคร","county":"เขตคลองเตย","city":"แขวงคลองเตย","street":"25 ถนนสุขุมวิท"}}

Now parse:
Address: {address}
Output:"""
    
    try:
        def run_sync_genai():
            client = genai.Client(api_key=api_key)
            return client.models.generate_content(
                model=WORKHORSE_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.0)
            )
        # Prevent event loop blocking
        res = await asyncio.to_thread(run_sync_genai)
        text = res.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        data = json.loads(text)
        return {k: v for k, v in data.items() if v and isinstance(v, str)}
    except Exception as e:
        print(f"⚠️ Gemma Address Parse Error: {e}")
        return {}


_DEAD_URL_CACHE = {}

async def geocode_with_gas(place_name: str) -> dict | None:
    """🛡️ Tier 0: GAS 無代理伺服器輪詢引擎 (Zero-Cost Load Balancer)"""
    urls_str = os.getenv("GAS_GEOCODE_URLS", "")
    if not urls_str:
        return None
        
    urls = [u.strip() for u in urls_str.split(",") if u.strip()]
    if not urls:
        return None
        
    random.shuffle(urls)
    now = time.time()
    
    for url in urls:
        # Check dead cache (12 hour penalty)
        if url in _DEAD_URL_CACHE and (now - _DEAD_URL_CACHE[url] < 43200):
            continue
            
        try:
            # GAS Web Apps return 302 redirects → must follow them
            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as gas_client:
                res = await gas_client.get(url, params={"address": place_name})
            res.raise_for_status()
            data = res.json()
            
            if data and "results" in data and len(data["results"]) > 0:
                loc = data["results"][0]["geometry"]["location"]
                addr = data["results"][0].get("formatted_address", place_name)
                print(f"🌍 [Tier 0] GAS Proxy Hit: {place_name} -> ({loc['lat']:.4f}, {loc['lng']:.4f})")
                return {
                    "lat": loc["lat"],
                    "lng": loc["lng"],
                    "name": addr.split(",")[0],
                    "address": addr
                }
            elif data and data.get("error") and data.get("quota_exceeded"):
                print(f"⚠️ [Tier 0] GAS URL Quota Exceeded. Banning URL for 12 hours.")
                _DEAD_URL_CACHE[url] = now
            elif data and "error_message" in data:
                print(f"⚠️ [Tier 0] GAS Maps API Error: {data['error_message']}")
                if "quota" in data['error_message'].lower() or "over_query_limit" in data.get("status", "").lower():
                    _DEAD_URL_CACHE[url] = now
        except Exception as e:
            print(f"⚠️ [Tier 0] GAS Request Failed: {e}")
            continue
            
    return None


async def resolve_address_pipeline(address: str, user_gemini_key: str = None):
    """
    📍 [專用] 獨立結構化地址解析器 (Address Resolver)
    🆕 2026 v2.0: T0 GAS 木馬 → ArcGIS → Gemma Few-Shot + Nominatim 國碼鎖定 → Photon
                 全球 200+ 國動態 countrycodes 鎖定，Few-Shot 5 洲範例錨定。
    """
    clean_addr = address.strip()
    if not clean_addr:
        return None
        
    # [小螺絲] 移除亞洲過度沾黏的 3~5 碼郵遞區號 (ex: '105台北市...' -> '台北市...')
    # 只移除「緊接 CJK 字元」的亞洲黏著郵遞區號 (807高雄市 → 高雄市)
    # 不影響西方門牌 (1600 Amphitheatre) 與其他格式
    clean_addr = re.sub(r'^\d{3,5}(?=[\u4e00-\u9fff\u3400-\u4dbf])', '', clean_addr)
        
    # Check cache first (1 hour expiration)
    now = time.time()
    if clean_addr in _NOMINATIM_CACHE:
        cache_entry = _NOMINATIM_CACHE[clean_addr]
        if now - cache_entry["time"] < 3600:
            print(f"🌍 Geocode Cache HIT: {clean_addr}")
            return cache_entry["data"]

    # 🛡️ Tier 0: 零成本 GAS 木馬陣列 (首發無敵星星)
    gas_res = await geocode_with_gas(clean_addr)
    if gas_res:
        _NOMINATIM_CACHE[clean_addr] = { "time": time.time(), "data": gas_res }
        return gas_res

    # 🛡️ Tier 1: 企業級核武 ArcGIS (原首發)
    if ARCGIS_API_KEY:
        try:
            print(f"🌍 [Tier 1] Dispatching to ArcGIS for '{clean_addr}'")
            arcgis_res = await geocode_with_arcgis(clean_addr)
            if arcgis_res and "lat" in arcgis_res:
                result_data = {
                    "lat": arcgis_res["lat"],
                    "lng": arcgis_res["lng"],
                    "name": arcgis_res.get("name", ""),
                    "address": arcgis_res.get("address", clean_addr)
                }
                _NOMINATIM_CACHE[clean_addr] = { "time": time.time(), "data": result_data }
                print(f"🌍 [Tier 1] ArcGIS Hit: {clean_addr}")
                return result_data
            else:
                print(f"⚠️ [Tier 1] ArcGIS miss. Falling back to FOSS engines.")
        except Exception as e:
            print(f"⚠️ [Tier 1] ArcGIS Exception: {e}. Falling back to FOSS engines.")

    # Throttle 1 request per second (For Nominatim)
    async with _NOMINATIM_LOCK:
        # Check cache again inside lock just in case it was fetched while waiting
        now = time.time()
        if clean_addr in _NOMINATIM_CACHE and (now - _NOMINATIM_CACHE[clean_addr]["time"] < 3600):
            return _NOMINATIM_CACHE[clean_addr]["data"]

        base_url = os.getenv("NOMINATIM_BASE_URL", "https://nominatim.openstreetmap.org/search")
        user_agent = os.getenv("APP_USER_AGENT", "RyanTravelApp/2.0 (contact@ryantravel.app)")
        
        # 🧠 Gemma 3 降維解構
        structured_data = await _gemma_parse_address(clean_addr, user_key=user_gemini_key)
        
        params = {
            "format": "geocodejson",
            "addressdetails": "1",
            "namedetails": "1",
            "entrances": "1",
            "accept-language": "zh-TW,zh,en",
            "limit": 1
        }
        
        if structured_data:
            print(f"🧠 Gemma parsed structure: {structured_data}")
            # 🌐 動態國家鎖定：將國名轉為 ISO 碼，注入 countrycodes 硬過濾
            iso_code = country_to_iso(structured_data.get("country", ""))
            if iso_code:
                params["countrycodes"] = iso_code
                print(f"🌐 Country Lock: '{structured_data['country']}' → countrycodes={iso_code}")
            # 強制禁止混用 q
            for k, v in structured_data.items():
                if k in ["postalcode", "country", "state", "county", "city", "street"]:
                    params[k] = v
        else:
            # Fallback to standard q
            params["q"] = clean_addr
            
        headers = {
            "User-Agent": user_agent,
        }

        try:
            def extract_nominatim_data(payload):
                if payload.get("features") and len(payload["features"]) > 0:
                    feat = payload["features"][0]
                    p = feat.get("properties", {}).get("geocoding", {})
                    g = feat.get("geometry", {}).get("coordinates", [0, 0])
                    return {
                        "lat": g[1], "lng": g[0],
                        "name": p.get("name", ""),
                        "address": p.get("label", clean_addr)
                    }
                return None

            result_data = None
            
            # 🛡️ Tier 2: Nominatim 精確打擊
            print(f"🌍 [Tier 2] Dispatching to Nominatim (Strict) for '{clean_addr}'")
            # Enforce 1 req/s delay if recent fetch
            last_f = getattr(resolve_address_pipeline, "_last_fetch", 0)
            elapsed = time.time() - last_f
            if elapsed < 1.0: await asyncio.sleep(1.0 - elapsed)
            
            res = await HTTPX_CLIENT.get(base_url, params=params, headers=headers, timeout=8.0)
            resolve_address_pipeline._last_fetch = time.time()
            res.raise_for_status()
            
            result_data = extract_nominatim_data(res.json())
            
            # 🛡️ Tier 3: Nominatim 降級打擊 (Dynamic Degradation)
            if not result_data:
                degraded_street = ""
                if structured_data and "street" in structured_data:
                    # 拔除「號/巷/弄/樓」等精確字元，退避到路名
                    degraded_street = re.sub(r'\d+[號巷弄樓Ff-].*$', '', structured_data["street"]).strip()
                else:
                    # 如果 AI 沒有作用，直接從原始字串退避
                    degraded_street = re.sub(r'\d+[號巷弄樓Ff-].*$', '', clean_addr).strip()
                    
                # 只有當退避後的字串不同且非空時，才進行降級打擊
                if degraded_street and ((structured_data and degraded_street != structured_data.get("street")) or (not structured_data and degraded_street != clean_addr)):
                    target_str = structured_data["street"] if structured_data else clean_addr
                    print(f"⚠️ [Tier 3] Nominatim miss. Degrading address '{target_str}' -> '{degraded_street}'")
                    
                    if structured_data:
                        params["street"] = degraded_street
                    else:
                        params["q"] = degraded_street
                        
                    last_f2 = getattr(resolve_address_pipeline, "_last_fetch", 0)
                    elapsed2 = time.time() - last_f2
                    if elapsed2 < 1.0: await asyncio.sleep(1.0 - elapsed2)
                    
                    res_deg = await HTTPX_CLIENT.get(base_url, params=params, headers=headers, timeout=8.0)
                    resolve_address_pipeline._last_fetch = time.time()
                    res_deg.raise_for_status()
                    result_data = extract_nominatim_data(res_deg.json())

            if result_data:
                _NOMINATIM_CACHE[clean_addr] = {"time": time.time(), "data": result_data}
                print(f"🌍 [Tier 2/3] Nominatim API Success: {clean_addr} -> {result_data['lat']}, {result_data['lng']}")
                return result_data
            else:
                # 🛡️ Tier 4: Nominatim 找不到精確門牌與道路，啟動 Photon 模糊搜尋保險絲
                print(f"⚠️ Nominatim completely missed. [Tier 4] Falling back to Photon for '{clean_addr}'")
                try:
                    photon_res = await geocode_with_photon(clean_addr, limit=1)
                    # 🛡️ Photon 雙波次打擊：原始字串失敗 → 拔掉門牌再試
                    if (not photon_res or len(photon_res) == 0) and degraded_street and degraded_street != clean_addr:
                        print(f"⚠️ [Tier 4] Photon missed original. Retrying with degraded: '{degraded_street}'")
                        photon_res = await geocode_with_photon(degraded_street, limit=1)
                    if photon_res and len(photon_res) > 0:
                        first_match = photon_res[0]
                        result_data = {
                            "lat": first_match["lat"],
                            "lng": first_match["lng"],
                            "name": first_match.get("name", ""),
                            "address": first_match.get("address", clean_addr)
                        }
                        _NOMINATIM_CACHE[clean_addr] = {
                            "time": time.time(),
                            "data": result_data
                        }
                        print(f"🌍 [Tier 4] Photon Fallback Success: {clean_addr} -> {result_data['lat']}, {result_data['lng']}")
                        return result_data
                except Exception as photon_err:
                    print(f"⚠️ [Tier 4] Photon Fallback failed: {photon_err}")
                
                # All engines failed
                print(f"❌ All geocoding engines failed for '{clean_addr}'")
                return None

        except httpx.HTTPStatusError as e:
            print(f"⚠️ Nominatim Status Error ({e.response.status_code}): {e}")
            raise  # Propagate to router
        except Exception as e:
            print(f"⚠️ Nominatim Generic Error: {e}")
            raise
            
    return None


async def geocode_with_photon(place_name: str, limit: int = 5, lat: float = None, lng: float = None, zoom: float = None):
    """Photon 地理編碼 (基於 OpenStreetMap + Elasticsearch，模糊搜尋強)
    
    Args:
        lat, lng: 若提供，將優先返回附近的結果 (Location Bias)
        zoom: 縮放層級，用於 P2 動態 bias scale
    """
    try:
        user_agent = os.getenv("APP_USER_AGENT", "RyanTravelApp/3.0 (contact@ryantravel.app)")
        async with httpx.AsyncClient(timeout=5.0, headers={"User-Agent": user_agent}) as client:
            # 🆕 P0: 雙變體查詢 (原字串 + 簡體變體)
            simplified = normalize_for_fuzzy(place_name)
            if simplified != place_name.lower().strip():
                query_text = f"{place_name} {simplified}"
            else:
                query_text = place_name
                
            # 🆕 P7: 意圖偵測 (自動 osm_tag)
            osm_tag = None
            if any(k in place_name for k in ["站", "駅", "線", "鐵"]):
                osm_tag = "railway:station"
            elif any(k in place_name for k in ["飯店", "酒店", "旅館", "ホテル"]):
                osm_tag = "tourism:hotel"
            elif any(k in place_name for k in ["餐廳", "餐", "食堂", "レストラン"]):
                osm_tag = "amenity:restaurant"
            
            params = {
                "q": query_text,
                "limit": limit
            }
            
            # 🆕 P7: 添加 osm_tag 過濾
            if osm_tag:
                params["osm_tag"] = osm_tag
                
            # 🆕 Location Bias
            if lat is not None and lng is not None:
                params["lat"] = lat
                params["lon"] = lng
                
            # 🆕 P2: 動態 bias scale (根據 zoom)
            if zoom is not None:
                if zoom > 14:
                    params["location_bias_scale"] = 0.9
                elif zoom > 10:
                    params["location_bias_scale"] = 0.5
                else:
                    params["location_bias_scale"] = 0.2

            res = await client.get(
                "https://photon.komoot.io/api/",
                params=params
            )
            data = orjson.loads(res.content)
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
        user_agent = os.getenv("APP_USER_AGENT", "RyanTravelApp/3.0 (contact@ryantravel.app)")
        res = await HTTPX_CLIENT.get(
            "https://photon.komoot.io/reverse",
            params={"lat": lat, "lon": lng},
            headers={"User-Agent": user_agent}
        )
        data = orjson.loads(res.content)
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


async def reverse_geocode_with_ai_enhancement(lat: float, lng: float, api_key: str = None):
    """
    🆕 AI 增強反向地理編碼
    
    使用 gemma-3-27b-it 提供：
    1. 中文友好名稱
    2. 地點類型分類
    3. 一句話描述
    
    Args:
        lat, lng: 座標
        api_key: Gemini API Key (可選，無則返回基本結果)
    
    Returns:
        {name, address, display_name?, type?, description?}
    """
    # Step 1: Photon 原生查詢
    base_result = await reverse_geocode_with_photon(lat, lng)
    
    if not base_result:
        return {"name": "Unknown", "address": "", "lat": lat, "lng": lng}
    
    # 如果沒有 API key，返回基本結果
    if not api_key:
        return {**base_result, "lat": lat, "lng": lng}
    
    # Step 2: AI 增強 (中文優化顯示)
    try:
        prompt = f"""根據座標 ({lat:.6f}, {lng:.6f}) 和地名 "{base_result.get('name', 'Unknown')}"，
        地址：{base_result.get('address', '')}

        請提供：
        1. display_name: 中文友好名稱（如果已經是中文則優化顯示）
        2. type: 地點類型（餐廳/景點/交通站/購物/住宿/其他）
        3. description: 一句話描述（20字內）

        嚴格按以下 JSON 格式回傳，不要額外說明：
        {{"display_name": "...", "type": "...", "description": "..."}}"""

        # call_extraction_server is now at top level
        raw = await call_extraction_server(prompt, intent_type="GEOCODE")
        text = raw.strip()
        # 處理可能的 markdown 包裝
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        
        # 🆕 Use orjson for faster AI response parsing
        enhanced = orjson.loads(text)
        
        result = {
            **base_result,
            "lat": lat,
            "lng": lng,
            "display_name": enhanced.get("display_name", base_result.get("name")),
            "type": enhanced.get("type", "其他"),
            "description": enhanced.get("description", "")
        }
        print(f"🤖 AI 增強反向地理: {base_result.get('name')} → {result.get('display_name')}")
        return result
        
    except Exception as e:
        print(f"🤖 AI 增強失敗，返回基本結果: {e}")
        return {**base_result, "lat": lat, "lng": lng}


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
    "自由女神像": {"aliases": ["odaiba statue of liberty", "お台場の自由の女神像", "自由の女神像"], "search": "Statue of Liberty Odaiba", "display": "台場自由女神像", "country": "JP", "lat": 35.6278727, "lng": 139.7718346},
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
    "穴守稻荷車站": {"aliases": ["anamori inari", "anamoriinari", "穴守稻荷", "穴守稲荷", "穴守稲荷駅"], "search": "Anamori Inari Station", "display": "穴守稻荷車站", "country": "JP", "lat": 35.5502, "lng": 139.7470},
    
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
    "香港迪士尼": {"aliases": ["hong kong disneyland", "hkdl", "香港迪士尼樂園"], "search": "Hong Kong Disneyland", "display": "香港迪士尼樂園", "country": "HK"},
    "尖沙咀": {"aliases": ["tsim sha tsui", "tst", "尖沙嘴"], "search": "Tsim Sha Tsui", "display": "尖沙咀", "country": "HK"},
    "旺角": {"aliases": ["mong kok", "女人街", "波鞋街"], "search": "Mong Kok", "display": "旺角", "country": "HK"},
    "銅鑼灣": {"aliases": ["causeway bay", "时代广场"], "search": "Causeway Bay", "display": "銅鑼灣", "country": "HK"},
    "中環": {"aliases": ["central", "中環碼頭", "蘭桂坊"], "search": "Central Hong Kong", "display": "中環", "country": "HK"},
    "大嶼山": {"aliases": ["lantau", "昂坪360", "天壇大佛"], "search": "Lantau Island", "display": "大嶼山", "country": "HK"},
    "海洋公園": {"aliases": ["ocean park", "海洋公園"], "search": "Ocean Park Hong Kong", "display": "海洋公園", "country": "HK"},
    "香港機場": {"aliases": ["hong kong airport", "hkg", "赤鱲角"], "search": "Hong Kong International Airport", "display": "香港國際機場", "country": "HK"},
}

def get_fuzzy_index():
    global _FUZZY_INDEX, _LANDMARKS_KEYS_SORTED
    if _FUZZY_INDEX is not None:
        return _FUZZY_INDEX, _LANDMARKS_KEYS_SORTED
    
    print("🧠 [Lazy] Building fuzzy search index and loading external data...")
    
    # 🆕 Load External JSON for Massive Expansion
    try:
        data_path = Path(__file__).parent.parent / "data" / "landmarks.json"
        if data_path.exists():
            external_data = orjson.loads(data_path.read_bytes())
            valid_entries = {k: v for k, v in external_data.items() if isinstance(v, dict) and not k.startswith("_")}
            LANDMARKS_DB.update(valid_entries)
            print(f"📦 Loaded {len(valid_entries)} external landmarks")
    except Exception as e:
        print(f"⚠️ Failed to load external landmarks: {e}")

    # 🆕 Load Country-Separated Data
    try:
        countries_dir = Path(__file__).parent.parent / "data" / "countries"
        if countries_dir.exists():
            for country_path in countries_dir.iterdir():
                if country_path.is_dir():
                    for json_file in country_path.glob("*.json"):
                        try:
                            country_data = orjson.loads(json_file.read_bytes())
                            valid_entries = {k: v for k, v in country_data.items() if isinstance(v, dict) and not k.startswith("_")}
                            LANDMARKS_DB.update(valid_entries)
                        except Exception: pass
            print("📦 Loaded country-specific databases")
    except Exception as e:
        print(f"⚠️ Failed to load country data: {e}")

    # Build Index
    _FUZZY_INDEX = {}
    for k, v in LANDMARKS_DB.items():
        norm = normalize_for_fuzzy(k)
        if norm: _FUZZY_INDEX[norm] = (k, v)
        for alias in v.get("aliases", []):
            norm_alias = normalize_for_fuzzy(alias)
            if norm_alias: _FUZZY_INDEX[norm_alias] = (k, v)
    
    _LANDMARKS_KEYS_SORTED = sorted(LANDMARKS_DB.keys(), key=len, reverse=True)
    print(f"[OK] [Lazy] Index built: {len(_FUZZY_INDEX)} entries")
    return _FUZZY_INDEX, _LANDMARKS_KEYS_SORTED


def translate_famous_landmark(query: str, country_code: str = None) -> tuple:
    """🏰 確定性翻譯著名景點（無需 AI）"""
    query_lower = query.lower().strip()
    
    # 🆕 Lazy load indices
    FUZZY_INDEX, LANDMARKS_KEYS_SORTED = get_fuzzy_index()
    BRANDS_DB = get_brands_db()
    
    # === 1. 精確匹配（最快） ===
    for landmark_key in LANDMARKS_KEYS_SORTED:
        landmark = LANDMARKS_DB[landmark_key]
        
        if landmark_key.lower() in query_lower:
            print(f"🏰 Landmark Match: '{query}' → '{landmark['display']}'")
            return ([landmark["search"], query], landmark["display"], landmark)
        
        for alias in landmark.get("aliases", []):
            if alias.lower() in query_lower:
                print(f"🏰 Alias Match: '{alias}' → '{landmark['display']}'")
                return ([landmark["search"], query], landmark["display"], landmark)
    
    # === 2. 🆕 連鎖店品牌匹配 ===
    for category, brands in BRANDS_DB.items():
        if category.startswith("_"):  # 跳過 __comment
            continue
        if not isinstance(brands, dict):
            continue
        for brand_name, brand_data in brands.items():
            if not isinstance(brand_data, dict):
                continue
            # 檢查品牌名稱
            if brand_name.lower() in query_lower:
                search_term = brand_data.get("search_term", brand_name)
                print(f"🏪 Brand Match: '{query}' → '{search_term}'")
                return ([search_term, query], brand_name, None)
            # 檢查別名
            for alias in brand_data.get("aliases", []):
                if alias.lower() in query_lower:
                    search_term = brand_data.get("search_term", brand_name)
                    print(f"🏪 Brand Alias Match: '{alias}' → '{search_term}'")
                    return ([search_term, query], brand_name, None)
    
    # === 3. 🆕 模糊搜尋（容錯：typo、繁簡差異） ===
    normalized_query = normalize_for_fuzzy(query)
    if len(normalized_query) >= 2:  # 至少 2 字才進行模糊匹配
        # 🆕 使用預先建立的索引（效能優化）
        match_result = process.extractOne(
            normalized_query, 
            FUZZY_INDEX.keys(),
            scorer=fuzz.ratio,
            score_cutoff=88  # 🆕 提高閾值至 88% 減少誤匹配
        )
        
        if match_result:
            matched_key, score, _ = match_result
            landmark_key, landmark = FUZZY_INDEX[matched_key]
            print(f"[FUZZY] '{query}' -> '{landmark['display']}' (score: {score})")
            return ([landmark["search"], query], landmark["display"], landmark)

    
    # === 4. 特殊處理：迪士尼 ===
    if "迪士尼" in query or "disney" in query_lower:
        if country_code == "JP" or any(jp in query.lower() for jp in ["東京", "tokyo", "日本", "japan"]):
            disney = LANDMARKS_DB.get("東京迪士尼樂園")
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
        prompt = f"""判斷這個旅遊行程的目的地國家。

行程標題：「{trip_title}」

請只回覆國家代碼（如 JP、KR、TW、TH、VN、SG、HK）。
如果無法判斷或是多國行程，回覆 NONE。
只輸出代碼，不要其他文字。"""

        from services.model_manager import call_extraction_server
        raw = await call_extraction_server(prompt, intent_type="GEOCODE")
        
        result = raw.strip().upper()
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
    
    🆕 v2.1: 針對日本輸出多語言變體（漢字、假名、羅馬拼音）
    
    Returns: 搜尋變體列表 [翻譯後, 英文, 原文]
    """
    if not country_code or not api_key:
        return [query]
    
    # 🆕 緩存檢查
    # Cache key based on input
    cache_key = (query.lower(), country_code) # Corrected cache_key to match function parameters
    if cache_key in TRANSLATION_CACHE:
        print(f"🔤 CACHE HIT: '{query}' → {TRANSLATION_CACHE[cache_key]}")
        return TRANSLATION_CACHE[cache_key]
    
    country_info = COUNTRY_BOUNDS.get(country_code)
    if not country_info:
        return [query]
    
    try:
        # Step 1: AI Analysis
        # Assuming call_extraction_server is now globally available or imported at the top level
        country_name = country_info["name"]
        
        # 🆕 針對日本的特殊 prompt
        if country_code == "JP":
            prompt = f"""你是日本地名翻譯專家。用戶正在搜尋日本的地點。

用戶輸入：「{query}」

請翻譯成以下三種格式（每行一個，不要編號）：
1. 日文漢字寫法（如：浅草寺）
2. 日文假名（如：せんそうじ 或 センソウジ）
3. 英文羅馬拼音（如：Senso-ji）

如果是餐廳/商店名稱，請使用官方日文名稱。
如果輸入已經是日文，直接輸出原文 + 羅馬拼音。
只輸出翻譯結果，每行一個，最多3行。"""
        else:
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

        raw = await call_extraction_server(prompt, intent_type="GEOCODE")
        
        lines = [line.strip() for line in raw.strip().split("\n") if line.strip()]
        if lines:
            # 確保原始查詢也在列表中
            if query not in lines:
                lines.append(query)
            result = lines[:4]  # 🆕 最多4個變體（增加容錯）
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

        from services.model_manager import call_extraction_server
        raw = await call_extraction_server(prompt, intent_type="GEOCODE")
        result = raw.strip().upper()
        if result in COUNTRY_BOUNDS:
            print(f"🧠 Query '{query}' → Country: {result}")
            return result
        return None
    except Exception:
        return None

# 🆕 國家名稱 → 代碼映射 (全小寫，大小寫不敏感)
COUNTRY_NAME_TO_CODE = {
    # 日本
    "japan": "JP", "日本": "JP",
    # 台灣 (兩種寫法)
    "taiwan": "TW", "台灣": "TW", "臺灣": "TW",
    # 韓國
    "south korea": "KR", "korea": "KR", "韓國": "KR", "한국": "KR",
    # 泰國
    "thailand": "TH", "泰國": "TH", "ประเทศไทย": "TH",
    # 越南
    "vietnam": "VN", "越南": "VN",
    # 新加坡
    "singapore": "SG", "新加坡": "SG",
    # 香港
    "hong kong": "HK", "香港": "HK",
    # 🆕 美國
    "usa": "US", "united states": "US", "美國": "US", "美国": "US",
    # 🆕 英國
    "uk": "GB", "united kingdom": "GB", "england": "GB", "britain": "GB", "英國": "GB", "英国": "GB",
    # 🆕 法國
    "france": "FR", "法國": "FR", "法国": "FR",
    # 🆕 義大利
    "italy": "IT", "義大利": "IT", "意大利": "IT",
    # 🆕 澳洲
    "australia": "AU", "澳洲": "AU", "澳大利亞": "AU",
    # 🆕 德國
    "germany": "DE", "德國": "DE", "德国": "DE",
    # 🆕 西班牙
    "spain": "ES", "西班牙": "ES",
    # 🆕 加拿大
    "canada": "CA", "加拿大": "CA",
    # 🆕 中國
    "china": "CN", "中國": "CN", "中国": "CN",
    # 🆕 馬來西亞
    "malaysia": "MY", "馬來西亞": "MY", "马来西亚": "MY",
    # 🆕 印尼
    "indonesia": "ID", "印尼": "ID", "印度尼西亞": "ID",
    # 🆕 菲律賓
    "philippines": "PH", "菲律賓": "PH", "菲律宾": "PH",
}

def extract_region_for_search(region: str) -> str:
    """從 'Tokyo 東京' 提取英文部分 'Tokyo'"""
    if not region:
        return ""
    # 取第一個空格前的部分（英文）
    parts = region.split(" ")
    return parts[0] if parts else region

async def smart_geocode_logic(
    query: str, 
    limit: int, 
    trip_title: str = None, 
    api_key: str = None, 
    lat: float = None, 
    lng: float = None,
    country: str = None,    # 🆕 前端傳入的國家過濾
    region: str = None,     # 🆕 前端傳入的區域過濾
    zoom: float = None      # 🆕 P1: 地圖縮放層級 (用於動態 bias)
) -> dict:
    """共用的智能地理編碼邏輯"""
    log_debug(f"🔍 [SmartGeo] Start search: '{query}' (Trip: {trip_title}, Country: {country}, Region: {region}, Zoom: {zoom}, Bias: {lat},{lng})")
    
    # 🧠 Step 0: 智能國家判斷和翻譯
    country_code = None
    search_queries = [query]
    chinese_display = None  # 🆕 中文顯示名稱
    
    # 🆕 第零優先級：前端明確指定的國家 (最高優先，大小寫不敏感)
    if country:
        normalized_country = country.strip().lower()
        country_code = COUNTRY_NAME_TO_CODE.get(normalized_country) or COUNTRY_NAME_TO_CODE.get(country)
        if country_code:
            log_debug(f"   🎯 Frontend Country Filter → {country_code}")
    
    # 🆕 如果有區域，提取英文部分加入搜尋 query
    if region:
        clean_region = extract_region_for_search(region)
        # 如果沒有國家碼，嘗試從 region 推測
        if not country_code:
            country_code = detect_country_from_keywords(region)
        # 🆕 將區域加入搜尋（只在 query 中不包含時）
        if clean_region and clean_region.lower() not in query.lower():
            search_queries = [f"{query} {clean_region}"]
            log_debug(f"   📍 Region added to query: '{query}' → '{query} {clean_region}'")
    
    # 第一優先級：關鍵字規則（確定性，零延遲，無需 API Key）
    if not country_code:
        country_code = detect_country_from_keywords(query)
        if country_code:
            log_debug(f"   🔑 Keyword Match → {country_code}")

    
    # 第二優先級：AI 判斷（需要 API Key）- 🆕 並行運算優化
    if not country_code and api_key:
        log_debug("   🚀 Parallelizing AI country detection...")
        tasks = []
        if trip_title:
            tasks.append(detect_country_from_trip_title(trip_title, api_key))
        tasks.append(detect_country_from_query(query, api_key))
        
        # 使用 asyncio.gather 同時啟動多個 AI 任務，將延遲從相加轉為取最大值
        ai_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 解析結果（優先級：標題 > 查詢）
        res_list = [r for r in ai_results if isinstance(r, str) and r]
        if res_list:
            country_code = res_list[0]
            log_debug(f"   🧠 Detected Country (Parallel): {country_code}")


    # 🆕 Step 1.1: 快速路徑 - 如果查詢是坐標，直接跳過所有 AI 邏輯
    if "," in query:
        parts = query.split(",")
        if len(parts) == 2:
            try:
                lat_val, lng_val = float(parts[0]), float(parts[1])
                log_debug(f"   ⚡ FAST PATH: Coordinates detected ({lat_val}, {lng_val})")
                return {"results": [{
                    "lat": lat_val, "lng": lng_val, "name": query, "address": query, "type": "coordinate", "source": "direct"
                }], "source": "direct"}
            except: pass

    # 🆕 Step 1.2: 先嘗試確定性著名景點翻譯（無需 API Key）
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
    
    # 🆕 Step 2: 投機性並行搜尋 (Speculative Parallelism)
    # 我們開啟三個任務：AI 翻譯、原始名稱搜尋、以及（如果有）景點搜尋
    search_queries = []
    chinese_display = None
    
    tasks = []
    # 任務 A: AI 翻譯 (如果需要)
    translation_task = None
    if not display_name and country_code and api_key:
        translation_task = asyncio.create_task(translate_place_name(query, country_code, api_key))
        tasks.append(translation_task)
    
    # 任務 B: 原始名稱初步搜尋 (Speculative Photon)
    speculative_task = asyncio.create_task(geocode_with_photon(query, limit, lat, lng, zoom))
    tasks.append(speculative_task)

    log_debug(f"   🚀 Starting Speculative Searches for '{query}'...")
    
    # 等待初步結果或翻譯完成（設置一個小的超時或併行等待）
    # 為了保持簡單，我們等待所有任務完成，但此時已是「並行」而非「順位」
    await asyncio.gather(*tasks, return_exceptions=True)

    # 彙整搜尋關鍵字
    if display_name:
        search_queries = search_terms
        chinese_display = display_name
    elif translation_task and not translation_task.exception():
        search_queries = translation_task.result()
        log_debug(f"   🔤 AI Translated: {search_queries}")
    
    # 如果搜尋關鍵字中還沒有原始名稱，加進去作為保險
    if query not in search_queries:
        search_queries.append(query)

    if not country_code:
        log_debug("   ⚠️ No country detected, using broad search")

    

    
    all_results = []
    found_source = "none"
    
    # 🆕 整合投機性搜尋結果
    if speculative_task and not speculative_task.exception():
        photon_spec = speculative_task.result()
        if photon_spec:
            for r in photon_spec: r["source"] = "photon_speculative"
            all_results.extend(photon_spec)
            found_source = "photon"
            log_debug(f"   ⚡ Using {len(photon_spec)} speculative results")
    
    for q in search_queries:
        if len(all_results) >= limit:
            break
            
        # 如果 speculative 已經查過了這個 query，跳過
        if q == query and found_source != "none":
            continue

        # Photon (🆕 P1: 傳遞 zoom 用於動態 bias scale)
        photon = await geocode_with_photon(q, limit, lat, lng, zoom)
        if photon:
            for r in photon: r["source"] = "photon"
            all_results.extend(photon)
            found_source = "photon"

        
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
