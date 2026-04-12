"""
POI 服務層 - 整合 OSM Overpass + OpenTripMap API
提供附近設施搜索功能，並優化 AI Token 消耗
"""

import httpx
import asyncio
import re
from typing import List, Dict, Optional
from math import radians, cos, sin, sqrt, atan2
from urllib.parse import quote
from datetime import datetime
import time
import logging
from utils.url_safety import is_safe_url

logger = logging.getLogger("poi-service")

# 🆕 Phase 1 Observability (Lazy Loading to prevent Windows import deadlock)
_POI_METRICS = {"latency": None, "requests": None}

def _get_poi_metrics():
    """Lazy initialization of Prometheus metrics with ModuleNotFoundError resilience"""
    try:
        from prometheus_client import Counter, Histogram
        if _POI_METRICS["latency"] is None:
            _POI_METRICS["latency"] = Histogram(
                "poi_enrichment_latency_seconds",
                "Latency of individual source enrichment in seconds",
                ["source"],
                buckets=[0.1, 0.5, 1.0, 2.0, 2.5, 3.0, 5.0, 10.0]
            )
        if _POI_METRICS["requests"] is None:
            _POI_METRICS["requests"] = Counter(
                "poi_enrichment_requests_total",
                "Total number of enrichment requests per source and status",
                ["source", "status"]
            )
        return _POI_METRICS["latency"], _POI_METRICS["requests"]
    except (ImportError, ModuleNotFoundError):
        # 🛡️ Resilience logic: Return a Mock object that accepts .labels().observe() and .labels().inc()
        class MockMetric:
            def labels(self, *args, **kwargs): return self
            def observe(self, *args, **kwargs): pass
            def inc(self, *args, **kwargs): pass
        return MockMetric(), MockMetric()

# 🆕 Phase 1 Concurrency Control
WIKI_SEMAPHORE = asyncio.Semaphore(50)

# Overpass API endpoint
OVERPASS_API = "https://overpass-api.de/api/interpreter"

# OpenTripMap API (免費無限制)
OPENTRIPMAP_API = "https://api.opentripmap.com/0.1/en/places"

# POI 類別映射: 前端類別 -> Overpass 查詢標籤
CATEGORY_OVERPASS_MAP = {
    "department_store": 'nwr["shop"="department_store"]',
    "restaurant": 'nwr["amenity"="restaurant"]',
    "convenience": 'nwr["shop"="convenience"]',
    "supermarket": 'nwr["shop"="supermarket"]',
    "pharmacy": 'nwr["amenity"="pharmacy"]',
    "popular": None  # 熱門景點使用 OpenTripMap
}

# POI 類別映射: 前端類別 -> OpenTripMap kinds
CATEGORY_OPENTRIPMAP_MAP = {
    "department_store": "malls",
    "restaurant": "foods",
    "convenience": "shops",
    "supermarket": "shops",
    "pharmacy": "drugstores",  # OpenTripMap 用 drugstores
    "popular": "interesting_places"
}

# 位置相關關鍵字 (用於偵測 POI 查詢)
LOCATION_KEYWORDS = [
    "附近", "周邊", "nearby", "around", "near",
    "哪裡有", "哪裏有", "哪邊有", "where",
    "推薦", "recommend", "suggest",
    "最近的", "closest", "nearest"
]

# 類別關鍵字映射 (用戶語言 -> POI 類別)
CATEGORY_KEYWORDS = {
    "pharmacy": ["藥局", "藥妝", "藥店", "pharmacy", "drugstore", "松本清", "大國"],
    "restaurant": ["餐廳", "美食", "吃飯", "restaurant", "food", "吃的", "好吃"],
    "convenience": ["超商", "便利商店", "便利店", "7-11", "全家", "羅森", "lawson", "便利"],
    "supermarket": ["超市", "超級市場", "supermarket", "grocery"],
    "department_store": ["百貨", "百貨公司", "mall", "shopping"],
    "popular": ["景點", "熱門", "觀光", "attraction", "tourist", "sightseeing"]
}


def detect_poi_query(message: str) -> Optional[Dict]:
    """
    偵測訊息是否為 POI 相關查詢
    
    Args:
        message: 用戶訊息
    
    Returns:
        如果是 POI 查詢，回傳 {"is_poi_query": True, "category": "pharmacy"}
        否則回傳 None
    """
    message_lower = message.lower()
    
    # 檢查是否包含位置關鍵字
    has_location_keyword = any(kw in message_lower for kw in LOCATION_KEYWORDS)
    
    if not has_location_keyword:
        return None
    
    # 偵測類別
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in message_lower:
                return {
                    "is_poi_query": True,
                    "category": category,
                    "matched_keyword": kw
                }
    
    # 有位置關鍵字但無明確類別，預設搜索熱門景點
    return {
        "is_poi_query": True,
        "category": "popular",
        "matched_keyword": None
    }


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """計算兩點間的 Haversine 距離（公尺）"""
    R = 6371000  # 地球半徑（公尺）
    
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    
    a = sin(delta_lat/2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c


async def search_overpass(
    lat: float,
    lng: float,
    category: str,
    radius: int = 1000
) -> List[Dict]:
    """
    透過 OSM Overpass API 搜索附近 POI
    
    Args:
        lat: 中心點緯度
        lng: 中心點經度
        category: POI 類別 (pharmacy, restaurant, etc.)
        radius: 搜索半徑（公尺）
    
    Returns:
        POI 列表
    """
    overpass_tag = CATEGORY_OVERPASS_MAP.get(category)
    if not overpass_tag:
        return []
    
    # Overpass QL 查詢語法
    query = f"""
    [out:json][timeout:10];
    (
      {overpass_tag}(around:{radius},{lat},{lng});
    );
    out center;
    """
    
    # [SAFETY] SSRF Protection
    if not is_safe_url(OVERPASS_API):
        logger.warning(f"Blocked unsafe Overpass request: {OVERPASS_API}")
        return []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                OVERPASS_API,
                data={"data": query}
            )
            response.raise_for_status()
            data = response.json()
            
            pois = []
            for element in data.get("elements", []):
                # 取得座標（node 直接有，way/relation 用 center）
                poi_lat = element.get("lat") or element.get("center", {}).get("lat")
                poi_lng = element.get("lon") or element.get("center", {}).get("lon")
                
                if not poi_lat or not poi_lng:
                    continue
                
                tags = element.get("tags", {})
                name = tags.get("name") or tags.get("name:en") or tags.get("name:ja") or "Unknown"
                
                # 計算距離
                distance = round(haversine_distance(lat, lng, poi_lat, poi_lng))
                
                pois.append({
                    "id": f"osm_{element.get('id')}",
                    "name": name,
                    "category": category,
                    "lat": poi_lat,
                    "lng": poi_lng,
                    "distance": distance,
                    "address": tags.get("addr:full") or tags.get("addr:street", ""),
                    "phone": tags.get("phone", ""),
                    "website": tags.get("website", ""),
                    "opening_hours": tags.get("opening_hours", ""),
                    "wikidata_id": tags.get("wikidata", ""),
                    "source": "osm"
                })
            
            # 按距離排序
            pois.sort(key=lambda x: x["distance"])
            return pois[:20]  # 最多回傳 20 個
            
    except Exception as e:
        print(f"Overpass API error: {e}")
        return []


async def search_opentripmap(
    lat: float,
    lng: float,
    category: str,
    radius: int = 1000,
    api_key: str = ""
) -> List[Dict]:
    """
    透過 OpenTripMap API 搜索附近旅遊景點
    
    Args:
        lat: 中心點緯度
        lng: 中心點經度
        category: POI 類別
        radius: 搜索半徑（公尺）
        api_key: OpenTripMap API Key (免費申請)
    
    Returns:
        POI 列表（含評分）
    """
    kind = CATEGORY_OPENTRIPMAP_MAP.get(category, "interesting_places")
    
    # 注意：OpenTripMap 免費版需要 API Key，但額度很高
    # 如果沒有 key，嘗試無 key 請求
    url = f"{OPENTRIPMAP_API}/radius"
    params = {
        "radius": radius,
        "lon": lng,
        "lat": lat,
        "kinds": kind,
        "format": "json",
        "limit": 20
    }
    if api_key:
        params["apikey"] = api_key
    
    # [SAFETY] SSRF Protection
    if not is_safe_url(url):
        logger.warning(f"Blocked unsafe OpenTripMap request: {url}")
        return []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            
            # OpenTripMap 可能回傳空或錯誤
            if response.status_code != 200:
                print(f"OpenTripMap error: {response.status_code}")
                return []
            
            data = response.json()
            if not isinstance(data, list):
                return []
            
            pois = []
            for item in data:
                poi_lat = item.get("point", {}).get("lat")
                poi_lng = item.get("point", {}).get("lon")
                
                if not poi_lat or not poi_lng:
                    continue
                
                distance = round(haversine_distance(lat, lng, poi_lat, poi_lng))
                
                pois.append({
                    "id": f"otm_{item.get('xid')}",
                    "name": item.get("name") or "Unknown",
                    "category": category,
                    "lat": poi_lat,
                    "lng": poi_lng,
                    "distance": distance,
                    "rating": item.get("rate", 0),  # 1-10 評分
                    "wikidata_id": item.get("wikidata", ""),
                    "source": "opentripmap"
                })
            
            pois.sort(key=lambda x: x["distance"])
            return pois
            
    except Exception as e:
        print(f"OpenTripMap API error: {e}")
        return []


async def search_poi_combined(
    lat: float,
    lng: float,
    category: str,
    radius: int = 1000,
    opentripmap_key: str = ""
) -> List[Dict]:
    """
    整合多個來源搜索 POI，合併去重
    
    優先使用 Overpass（座標精確），OpenTripMap 補充評分
    """
    # 並行查詢兩個 API
    overpass_task = search_overpass(lat, lng, category, radius)
    opentripmap_task = search_opentripmap(lat, lng, category, radius, opentripmap_key)
    
    overpass_results, opentripmap_results = await asyncio.gather(
        overpass_task,
        opentripmap_task,
        return_exceptions=True
    )
    
    # 處理異常
    overpass_results = overpass_results if isinstance(overpass_results, list) else []
    opentripmap_results = opentripmap_results if isinstance(opentripmap_results, list) else []
    
    # 建立 Wikidata ID 對照表（用於合併評分）
    wikidata_ratings = {}
    for poi in opentripmap_results:
        if poi.get("wikidata_id"):
            wikidata_ratings[poi["wikidata_id"]] = poi.get("rating", 0)
    
    # 為 Overpass 結果補充評分
    for poi in overpass_results:
        if poi.get("wikidata_id") and poi["wikidata_id"] in wikidata_ratings:
            poi["rating"] = wikidata_ratings[poi["wikidata_id"]]
    
    # 合併結果，Overpass 優先（座標更精確）
    combined = overpass_results.copy()
    
    # 加入 OpenTripMap 獨有的（無 Overpass 對應）
    overpass_wikidata_ids = {p.get("wikidata_id") for p in overpass_results if p.get("wikidata_id")}
    for poi in opentripmap_results:
        if poi.get("wikidata_id") and poi["wikidata_id"] not in overpass_wikidata_ids:
            combined.append(poi)
    
    # 重新排序
    combined.sort(key=lambda x: x["distance"])
    return combined[:20]


def format_pois_for_ai(pois: List[Dict], max_items: int = 5) -> str:
    """
    將 POI 列表格式化為精簡文字，供 AI 處理
    
    這是 Token 優化的關鍵！
    原始 JSON 可能 5KB，格式化後只有 ~500 bytes
    """
    if not pois:
        return "附近沒有找到相關地點。"
    
    lines = []
    for i, poi in enumerate(pois[:max_items], 1):
        rating_str = f"⭐{poi.get('rating', '-')}" if poi.get('rating') else ""
        hours_str = f" | {poi.get('opening_hours', '')}" if poi.get('opening_hours') else ""
        
        line = f"{i}. {poi['name']} ({poi['distance']}m) {rating_str}{hours_str}"
        lines.append(line)
    
    return "\n".join(lines)


def get_ai_prompt_for_recommendation(
    pois_text: str,
    user_query: str,
    user_preferences: Optional[Dict] = None
) -> str:
    """
    生成給 Gemini 的精簡 prompt
    
    設計原則：
    - System prompt 固定、精簡
    - POI 資料已預處理
    - 用戶問題直接帶入
    """
    preferences_str = ""
    if user_preferences:
        prefs = []
        if user_preferences.get("prefer_rating"):
            prefs.append("重視評分")
        if user_preferences.get("prefer_distance"):
            prefs.append("重視距離")
        if user_preferences.get("prefer_price"):
            prefs.append("重視價格")
        if prefs:
            preferences_str = f"\n用戶偏好：{', '.join(prefs)}"
    
    return f"""你是專業旅遊助手。根據以下附近地點資訊回答問題。

地點列表：
{pois_text}
{preferences_str}

用戶問題：{user_query}

請給出簡潔推薦（100字內），說明原因。"""


# ==================== WikiVoyage API ====================

WIKIVOYAGE_API = "https://en.wikivoyage.org/w/api.php"


async def search_wikivoyage(place_name: str, lang: str = "en", client: httpx.AsyncClient = None) -> Optional[Dict]:
    """
    透過 WikiVoyage MediaWiki API 搜索景點描述 (經由共享 Client 與 Semaphore)
    """
    # 🛡️ SSRF Protection: Validate language whitelist
    allowed_langs = {"en", "zh", "ja", "ko", "fr", "de", "es", "it", "ru", "pt"}
    if lang not in allowed_langs:
        print(f"[POI] Blocked potential SSRF attempt with invalid lang: {lang}")
        return None

    api_url = f"https://{lang}.wikivoyage.org/w/api.php"
    
    params = {
        "action": "query",
        "prop": "extracts",
        "exintro": "true",       # 只取摘要
        "explaintext": "true",   # 純文字 (非 HTML)
        "titles": place_name,
        "format": "json",
        "formatversion": "2"
    }
    
    start_time = time.time()
    try:
        headers = {
            "User-Agent": "RyanTravelApp/1.2 (contact@example.com)",
            "Accept": "application/json"
        }
        
        async with WIKI_SEMAPHORE:
            # 🛡️ Anti-SSRF Guard
            if not is_safe_url(api_url):
                return None

            if client:
                response = await client.get(api_url, params=params, headers=headers, follow_redirects=True)
            else:
                async with httpx.AsyncClient(timeout=10.0) as temp_client:
                    response = await temp_client.get(api_url, params=params, headers=headers, follow_redirects=True)
            
            latency = time.time() - start_time
            latency_metric, _ = _get_poi_metrics()
            latency_metric.labels(source="wikivoyage").observe(latency)
            
            if response.status_code != 200:
                _, requests_metric = _get_poi_metrics()
                requests_metric.labels(source="wikivoyage", status="error").inc()
                print(f"WikiVoyage API error: {response.status_code}")
                return None
            
            _, requests_metric = _get_poi_metrics()
            requests_metric.labels(source="wikivoyage", status="success").inc()
            
            data = response.json()
            pages = data.get("query", {}).get("pages", [])
            
            if not pages:
                return None
            
            page = pages[0]
            if page.get("missing"):
                return None
            
            title = page.get("title", place_name)
            extract = page.get("extract", "")
            
            if len(extract) > 500:
                extract = extract[:500] + "..."
            
            return {
                "title": title,
                "description": extract,
                "url": f"https://{lang}.wikivoyage.org/wiki/{title.replace(' ', '_')}"
            }
            
    except Exception as e:
        print(f"WikiVoyage API error: {e}")
        return None


async def enrich_poi_with_wikivoyage(poi: Dict, lang: str = "en", client: httpx.AsyncClient = None) -> Dict:
    """
    用 WikiVoyage 資料豐富 POI 資訊 (共享 Client)
    """
    if not poi.get("name"):
        return poi
    
    wiki_data = await search_wikivoyage(poi["name"], lang, client=client)
    
    if wiki_data:
        poi["wikivoyage_description"] = wiki_data.get("description", "")
        poi["wikivoyage_url"] = wiki_data.get("url", "")
    
    return poi


# ==================== Wikipedia API ====================

from utils.url_safety import is_safe_url

async def get_wikipedia_summary(name: str, lang: str = "zh", client: httpx.AsyncClient = None, is_retry: bool = False, lat: float = None, lng: float = None) -> tuple[str, str]:
    """
    從 Wikipedia 獲取景點簡介 (200 字以內，共享 Client 與 Semaphore)
    """
    # 🛡️ SSRF Protection: Validate language whitelist
    allowed_langs = {"en", "zh", "ja", "ko", "fr", "de", "es", "it", "ru", "pt"}
    if lang not in allowed_langs:
        print(f"[POI] Blocked potential SSRF attempt with invalid Wikipedia lang: {lang}")
        return "", ""

    start_time = time.time()
    try:
        headers = {
            "User-Agent": "RyanTravelApp/1.2 (contact@example.com)",
            "Accept": "application/json"
        }

        # 📍 優先權加固 (Phase 6.10)：十倍視野優化，確保密集景區地標不遺漏
        if lat is not None and lng is not None and not is_retry:
            geo_url = f"https://{lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord={lat}|{lng}&gsradius=1000&gslimit=10&format=json"
            if is_safe_url(geo_url): # 🛡️ 安全防護不中斷
                try:
                    if client:
                        geo_resp = await client.get(geo_url, headers=headers)
                    else:
                        async with httpx.AsyncClient(timeout=5.0) as temp_client:
                            geo_resp = await temp_client.get(geo_url, headers=headers)
                            
                    if geo_resp.status_code == 200:
                        geo_data = geo_resp.json()
                        geosearch_results = geo_data.get("query", {}).get("geosearch", [])
                        if geosearch_results:
                            # 🎯 智慧選擇：從附近條目中找名字最契合的 (擴大檢索深度至 10)
                            best_title = geosearch_results[0]["title"]
                            
                            # 第一輪：嘗試全字包含 (掃描前 10 項)
                            found_exact = False
                            for entry in geosearch_results[:10]:
                                t = entry["title"]
                                if name in t or t in name:
                                    best_title = t
                                    found_exact = True
                                    break
                            
                            # 第二輪：智慧分詞比對 (處理中正廟 -> 中正紀念堂, 自由廣場 -> 自由廣場 (台北))
                            if not found_exact:
                                # 🧠 智慧分詞：生成所有可能的 2 字片段 (N-grams) 提高命中率
                                search_fragments = [name[i:i+2] for i in range(len(name)-1)]
                                # 同時保留原始 split 部份 (針對英文關鍵字)
                                search_fragments.extend([p for p in name.split() if len(p) >= 2])
                                
                                # 擴大比對深度至前 10 名
                                for entry in geosearch_results[:10]:
                                    entry_t = entry["title"]
                                    if any(frag in entry_t for frag in search_fragments):
                                        best_title = entry_t
                                        break
                                
                                # 如果地理搜尋找到了精確條目，直接跳轉
                                print(f"📍 [Wiki Geosearch] Found best nearby match: {best_title}")
                                return await get_wikipedia_summary(best_title, lang=lang, client=client, is_retry=True, lat=lat, lng=lng)
                except Exception as e:
                    print(f"⚠️ [Wiki Geosearch] Priority check failed: {e}")

        # Wikipedia REST API 規範：空格應轉為下底線 _
        clean_name = name.strip().replace(' ', '_')
        url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{quote(clean_name)}"
        if not is_safe_url(url):
            return "", ""
        
        async with WIKI_SEMAPHORE:
            if client:
                response = await client.get(url, headers=headers, follow_redirects=True)
            else:
                async with httpx.AsyncClient(timeout=10.0) as temp_client:
                    response = await temp_client.get(url, headers=headers, follow_redirects=True)
            
            latency = time.time() - start_time
            latency_metric, _ = _get_poi_metrics()
            latency_metric.labels(source="wikipedia").observe(latency)
                    
            if response.status_code == 200:
                _, requests_metric = _get_poi_metrics()
                requests_metric.labels(source="wikipedia", status="success").inc()
                data = response.json()
                extract = data.get("extract", "")
                image_url = data.get("thumbnail", {}).get("source", "") # 🆕 Phase 5.3.2: Extract image
                
                final_extract = extract[:200] if len(extract) > 200 else extract
                return final_extract, image_url
            else:
                _, requests_metric = _get_poi_metrics()
                requests_metric.labels(source="wikipedia", status="error").inc()
                
                # 🆕 智慧搜尋保底：當直接查無結果 (404) 時
                if response.status_code == 404 and not is_retry:
                    # 備案：關鍵字搜尋 (OpenSearch)
                    search_url = f"https://{lang}.wikipedia.org/w/api.php?action=opensearch&search={quote(name)}&limit=1&format=json"
                    try:
                        if client:
                            search_resp = await client.get(search_url, headers=headers)
                        else:
                            async with httpx.AsyncClient(timeout=5.0) as temp_client:
                                search_resp = await temp_client.get(search_url, headers=headers)
                                
                        if search_resp.status_code == 200:
                            search_data = search_resp.json()
                            if len(search_data) > 1 and search_data[1]:
                                best_title = search_data[1][0]
                                return await get_wikipedia_summary(best_title, lang=lang, client=client, is_retry=True, lat=lat, lng=lng)
                    except Exception as search_err:
                        print(f"⚠️ [Wiki Search] Fallback search failed for '{name}': {search_err}")
    except Exception as e:
        _, requests_metric = _get_poi_metrics()
        requests_metric.labels(source="wikipedia", status="exception").inc()
        print(f"Wikipedia API error ({lang}): {e}")
    
    # 語言 fallback: zh → ja → en
    fallback_order = {"zh": "ja", "ja": "en"}
    if lang in fallback_order:
        return await get_wikipedia_summary(name, fallback_order[lang], client=client, lat=lat, lng=lng)
    
    return "", "" # 🆕 Phase 5.3.2: Return tuple


# ==================== Wikidata API ====================

async def get_wikidata_labels(wikidata_id: str, client: httpx.AsyncClient = None) -> Optional[Dict]:
    """
    從 Wikidata 獲取多語言 labels 和結構化資料 (共享 Client 與 Semaphore)
    """
    if not re.match(r"^Q\d+$", wikidata_id):
        return None

    start_time = time.time()
    try:
        url = f"https://www.wikidata.org/wiki/Special:EntityData/{wikidata_id}.json"
        if not is_safe_url(url):
            return None

        headers = {
            "User-Agent": "RyanTravelApp/1.2 (contact@example.com)"
        }
        
        async with WIKI_SEMAPHORE:
            if client:
                response = await client.get(url, headers=headers)
            else:
                async with httpx.AsyncClient(timeout=5.0) as temp_client:
                    response = await temp_client.get(url, headers=headers)
            
            latency = time.time() - start_time
            latency_metric, _ = _get_poi_metrics()
            latency_metric.labels(source="wikidata").observe(latency)
                    
            if response.status_code != 200:
                _, requests_metric = _get_poi_metrics()
                requests_metric.labels(source="wikidata", status="error").inc()
                print(f"⚠️ Wikidata API returned {response.status_code} for {wikidata_id}")
                return None
            
            _, requests_metric = _get_poi_metrics()
            requests_metric.labels(source="wikidata", status="success").inc()
            
            data = response.json()
            # 支援 entities 結構抓取
            entities = data.get("entities", {})
            entity = entities.get(wikidata_id, {})
            if not entity:
                # 有時返回的 key 可能不同或層級有差，做個保險
                if entities:
                    first_key = list(entities.keys())[0]
                    entity = entities[first_key]
            
            # 解析多語言 labels
            labels_raw = entity.get("labels", {})
            labels = {}
            # 支援更多 BCP 47 變體
            for lang in ["zh-tw", "zh-hant", "zh-hk", "zh", "ja", "en", "ko"]:
                if lang in labels_raw:
                    # 規範化 key
                    key = lang
                    if lang in ["zh-tw", "zh-hant"]: key = "zh-TW"
                    elif lang == "zh-hk": key = "zh-HK"
                    elif lang == "zh": key = "zh-CN"
                    elif lang == "ja": key = "ja-JP"
                    elif lang == "en": key = "en-US"
                    elif lang == "ko": key = "ko-KR"
                    
                    if key not in labels:
                        labels[key] = labels_raw[lang].get("value", "")
            
            claims = entity.get("claims", {})
            website = ""
            if "P856" in claims:
                website = claims["P856"][0].get("mainsnak", {}).get("datavalue", {}).get("value", "")
            
            opening_hours = ""
            if "P3025" in claims:
                opening_hours = claims["P3025"][0].get("mainsnak", {}).get("datavalue", {}).get("value", "")
            
            # 解析 Sitelinks (全域抓取支援 Phase 5.2 翻譯鏈)
            sitelinks_raw = entity.get("sitelinks", {})
            sitelinks = {k: v.get("title", "") for k, v in sitelinks_raw.items()}
            
            # P18: 核心高畫質圖源
            wikidata_image = ""
            if "P18" in claims:
                wikidata_image = claims["P18"][0].get("mainsnak", {}).get("datavalue", {}).get("value", "")
            
            return {
                "labels": labels,
                "sitelinks": sitelinks,
                "website": website,
                "opening_hours": opening_hours,
                "wikidata_image": wikidata_image # 🆕 Phase 5.1.1
            }
            
    except Exception as e:
        print(f"Wikidata API error: {e}")
        return None


# ==================== 三源整合 ====================

async def enrich_poi_complete(poi: Dict, client: httpx.AsyncClient = None) -> Dict:
    """
    三源互補整合：Wikidata + Wikipedia + WikiVoyage (2026 Phase 1 Parallel)
    """
    name = poi.get("name", "")
    wikidata_id = poi.get("wikidata_id", "")
    
    if not name:
        return poi
    
    poi["warnings"] = []
    poi["status"] = "SUCCESS"
    poi["resolved_language"] = "zh-TW" # Default
    poi["image_url"] = ""              # 🆕 Phase 5.3.1 Safety Init
    
    lat = poi.get("lat")
    lng = poi.get("lng")
    
    # 並行查詢三個來源 (每項 3s Timeout 防護)
    try:
        tasks = [
            asyncio.wait_for(get_wikidata_labels(wikidata_id, client=client), 6.0) if wikidata_id else asyncio.sleep(0),
            asyncio.wait_for(get_wikipedia_summary(name, client=client, lat=lat, lng=lng), 6.0),
            asyncio.wait_for(search_wikivoyage(name, client=client), 6.0)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 1. 處理 Wikidata 結果
        wikidata_result = None
        res0 = results[0]
        if isinstance(res0, asyncio.TimeoutError):
            poi["warnings"].append("WIKIDATA_TIMEOUT")
            if poi["status"] == "SUCCESS": poi["status"] = "PARTIAL_SUCCESS"
        elif isinstance(res0, Exception):
            poi["warnings"].append("WIKIDATA_ERROR")
            if poi["status"] == "SUCCESS": poi["status"] = "PARTIAL_SUCCESS"
        else:
            wikidata_result = res0
            
        # 2. 處理 Wikipedia 結果 (三步 Fallback 流程)
        wikipedia_result = ""
        wikipedia_image = "" # 🆕 Phase 5.3.2
        res1 = results[1]
        
        # 定義：內部抓取函式 (方便 fallback 時重用)
        async def fetch_wiki(title_to_fetch: str):
            if not title_to_fetch: return "", ""
            return await get_wikipedia_summary(title_to_fetch, client=client, lat=lat, lng=lng)

        if isinstance(res1, asyncio.TimeoutError):
            poi["warnings"].append("WIKIPEDIA_TIMEOUT")
            if poi["status"] == "SUCCESS": poi["status"] = "PARTIAL_SUCCESS"
        elif isinstance(res1, Exception):
            # 初始抓取異常，稍後嘗試 Sitelink Fallback
            pass
        else:
            # Unpack the tuple
            if isinstance(res1, tuple):
                wikipedia_result, wikipedia_image = res1
            else:
                wikipedia_result = res1 or ""

        # --- Fallback Step 2 & 3: Wikidata Sitelink ---
        if not wikipedia_result and wikidata_result:
            sitelinks = wikidata_result.get("sitelinks", {})
            
            # Step 2: 優先核心語系 (zh -> ja -> en)
            best_title = sitelinks.get("zhwiki") or sitelinks.get("jawiki") or sitelinks.get("enwiki")
            
            # Step 3: 全球保底 (Phase 5.2: 抓取第一個可用語系)
            target_lang = "zh" # Default
            if not best_title and sitelinks:
                # 排除一些非百科的 Meta 連結
                valid_wikis = [k for k in sitelinks.keys() if k.endswith("wiki") and not k.startswith("commons")]
                if valid_wikis:
                    wiki_key = valid_wikis[0]
                    best_title = sitelinks[wiki_key]
                    target_lang = wiki_key.replace("wiki", "")
                    print(f"🌍 [Global Fallback] Using {target_lang} Wikipedia: {best_title}")

            if best_title:
                try:
                    # 使用 2s timeout 進行二次抓取
                    res_fallback = await asyncio.wait_for(get_wikipedia_summary(best_title, lang=target_lang, client=client, lat=lat, lng=lng), 2.0)
                    if isinstance(res_fallback, tuple):
                        wikipedia_result, wikipedia_image = res_fallback
                        # 如果不是中文且抓取成功，標記需要翻譯
                        if not target_lang.startswith("zh"):
                            poi["resolved_language"] = target_lang
                    else:
                        wikipedia_result = res_fallback
                except:
                    # 二次抓取失敗不中斷流程
                    pass

        # 最終 Wikipedia 狀態判定與 Warning 固定
        if not wikipedia_result:
            if isinstance(res1, asyncio.TimeoutError):
                # 已經有 TIMEOUT warning 了
                pass
            else:
                # 查無結果 (Page Not Found)
                poi["warnings"].append("WIKIPEDIA_NOT_FOUND")
            
            if poi["status"] == "SUCCESS": poi["status"] = "PARTIAL_SUCCESS"
        else:
            # 有結果，但如果是空字串 (理論上 fetch_wiki 不會回傳空但保險起見)
            if not wikipedia_result.strip():
                poi["warnings"].append("WIKIPEDIA_EMPTY")
            
        # 3. 處理 WikiVoyage 結果
        wikivoyage_result = None
        res2 = results[2]
        if isinstance(res2, asyncio.TimeoutError):
            poi["warnings"].append("WIKIVOYAGE_TIMEOUT")
        elif isinstance(res2, Exception):
            poi["warnings"].append("WIKIVOYAGE_ERROR")
        else:
            wikivoyage_result = res2
        
        if wikidata_result:
            # 🆕 Phase 5.1.3: Wikidata Image Fallback
            if not poi.get("image_url") and wikidata_result.get("wikidata_image"):
                # 將 Commons 檔名轉為基本連結 (後續由 Proxy 處理)
                img_name = wikidata_result["wikidata_image"].replace(" ", "_")
                poi["image_url"] = f"https://commons.wikimedia.org/wiki/Special:FilePath/{img_name}?width=500"

            labels = wikidata_result.get("labels", {})
            # BCP 47 優先權
            primary = labels.get("zh-TW") or labels.get("zh-HK") or labels.get("zh-CN") or name
            ja_name = labels.get("ja-JP", "")
            en_name = labels.get("en-US", "")
            
            poi["resolved_language"] = "zh-TW" # 能查到 Wikidata 預設視為繁中處理
            
            secondary_parts = []
            if ja_name and ja_name != primary: secondary_parts.append(ja_name)
            if en_name: secondary_parts.append(f"({en_name})")
            
            poi["display_name"] = {
                "primary": primary,
                "secondary": " ".join(secondary_parts) if secondary_parts else ""
            }
            
            if wikidata_result.get("website"):
                poi["official_url"] = wikidata_result["website"]
            if wikidata_result.get("opening_hours"):
                poi["wikidata_hours"] = wikidata_result["opening_hours"]
        else:
            if wikidata_id:
                poi["warnings"].append("WIKIDATA_NOT_FOUND")
                poi["status"] = "PARTIAL_SUCCESS"

        # Wikipedia 文化描述
        if wikipedia_result:
            poi["cultural_desc"] = wikipedia_result
            if wikipedia_image:
                poi["image_url"] = wikipedia_image # 🆕 Phase 5.3.3: Store image
        else:
            # Warning 已經在前面 Logic 分支中處理過 WIKIPEDIA_TIMEOUT/NOT_FOUND
            if poi["status"] == "SUCCESS": poi["status"] = "PARTIAL_SUCCESS"
        
        # WikiVoyage 旅遊指南
        if wikivoyage_result:
            poi["travel_tips"] = wikivoyage_result.get("description", "")
            if wikivoyage_result.get("url"):
                poi["wikivoyage_url"] = wikivoyage_result["url"]
        else:
            poi["warnings"].append("WIKIVOYAGE_EMPTY")

        # 最終失敗判定
        if poi["status"] == "SUCCESS" and not wikidata_result and not wikipedia_result and not wikivoyage_result:
            poi["status"] = "FAILED"
        
    except Exception as e:
        print(f"enrich_poi_complete error: {e}")
        poi["status"] = "FAILED"
    
    return poi


def format_enriched_poi_for_ai(poi: Dict) -> str:
    """
    將豐富後的 POI 格式化為 AI 可讀文字
    """
    lines = []
    
    # 名稱 (主標題 + 副標題)
    display = poi.get("display_name", {})
    if display:
        name_line = display.get("primary", poi.get("name", ""))
        if display.get("secondary"):
            name_line += f" {display['secondary']}"
        lines.append(f"📍 {name_line}")
    else:
        lines.append(f"📍 {poi.get('name', '')}")
    
    # 文化描述
    if poi.get("cultural_desc"):
        lines.append(f"📖 {poi['cultural_desc']}")
    
    # 旅遊指南
    if poi.get("travel_tips"):
        lines.append(f"🧳 {poi['travel_tips'][:150]}...")
    
    # 官方連結
    if poi.get("official_url"):
        lines.append(f"🔗 官網: {poi['official_url']}")
    
    return "\n".join(lines)


def get_source_urls(poi: Dict, place_name: str) -> list:
    """
    🆕 v3.7.1: 提取來源 URLs 用於前端引用標示
    
    Returns:
        [
            {"title": "Wikipedia: 金閣寺", "url": "https://..."},
            {"title": "WikiVoyage: 金閣寺", "url": "https://..."}
        ]
    """
    sources = []
    
    # Wikipedia 來源
    if poi.get("cultural_desc"):
        # Wikipedia URL 格式
        wiki_url = f"https://zh.wikipedia.org/wiki/{quote(place_name)}"
        sources.append({
            "title": f"Wikipedia: {place_name}",
            "url": wiki_url
        })
    
    # WikiVoyage 來源
    if poi.get("wikivoyage_url"):
        sources.append({
            "title": f"WikiVoyage: {place_name}",
            "url": poi["wikivoyage_url"]
        })
    
    # 官方網站
    if poi.get("official_url"):
        sources.append({
            "title": "官方網站",
            "url": poi["official_url"]
        })
    
    return sources
