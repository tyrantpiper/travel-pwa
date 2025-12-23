"""
POI 服務層 - 整合 OSM Overpass + OpenTripMap API
提供附近設施搜索功能，並優化 AI Token 消耗
"""

import httpx
import asyncio
from typing import List, Dict, Optional
from math import radians, cos, sin, sqrt, atan2

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
    if isinstance(overpass_results, Exception):
        overpass_results = []
    if isinstance(opentripmap_results, Exception):
        opentripmap_results = []
    
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


async def search_wikivoyage(place_name: str, lang: str = "en") -> Optional[Dict]:
    """
    透過 WikiVoyage MediaWiki API 搜索景點描述
    
    Args:
        place_name: 景點名稱 (英文效果較佳)
        lang: 語言代碼 (en, ja, zh 等)
    
    Returns:
        {
            "title": "Tokyo",
            "description": "Tokyo is Japan's capital...",
            "url": "https://en.wikivoyage.org/wiki/Tokyo"
        }
    
    Note:
        WikiVoyage 速率限制: 每 30 秒最多 1 請求
        建議快取結果避免重複查詢
    """
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
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(api_url, params=params)
            
            if response.status_code != 200:
                print(f"WikiVoyage API error: {response.status_code}")
                return None
            
            data = response.json()
            pages = data.get("query", {}).get("pages", [])
            
            if not pages:
                return None
            
            page = pages[0]
            
            # 檢查是否找到頁面
            if page.get("missing"):
                return None
            
            title = page.get("title", place_name)
            extract = page.get("extract", "")
            
            # 限制描述長度 (避免 token 過多)
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


async def enrich_poi_with_wikivoyage(poi: Dict, lang: str = "en") -> Dict:
    """
    用 WikiVoyage 資料豐富 POI 資訊
    
    Args:
        poi: POI 資料字典
        lang: 語言代碼
    
    Returns:
        豐富後的 POI (加入 wikivoyage_description)
    """
    if not poi.get("name"):
        return poi
    
    wiki_data = await search_wikivoyage(poi["name"], lang)
    
    if wiki_data:
        poi["wikivoyage_description"] = wiki_data.get("description", "")
        poi["wikivoyage_url"] = wiki_data.get("url", "")
    
    return poi

