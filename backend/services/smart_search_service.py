"""
Smart Search Service - 防胡謅版
================================

設計原則：
1. 只用 1 次 AI 調用（Intent 解析）
2. 不生成推薦理由（最易胡謅）
3. 只返回 POI 真實資料
4. 無結果時明確說「找不到」
"""

import json
import re
from typing import List, Dict, Optional, Tuple
from math import radians, cos, sin, sqrt, atan2

from google import genai
from google.genai import types

from utils.ai_config import WORKHORSE_MODEL
from services.poi_service import search_poi_combined
from services.geocode_service import geocode_place


# --- Intent 解析 Prompt ---

INTENT_PARSE_PROMPT = """
你是一個旅遊搜尋意圖分析器。分析用戶的搜尋查詢，提取結構化意圖。

用戶查詢：「{query}」
當前位置參考：{region}

請分析並輸出 JSON（不要 markdown）：
{{
    "intent_type": "recommendation|nearby|specific",
    "category": "restaurant|shopping|attraction|convenience|pharmacy|null",
    "food_type": "ramen|sushi|cafe|curry|izakaya|null",
    "location": "提取的地點名或 null",
    "keywords": ["關鍵詞1", "關鍵詞2"]
}}

意圖類型：
- recommendation: 推薦類（好吃的、值得去的）
- nearby: 附近類（附近有什麼、周邊）
- specific: 精確搜尋（具體店名）

範例：
- 「新宿好吃的拉麵」→ {{"intent_type":"recommendation","category":"restaurant","food_type":"ramen","location":"新宿",...}}
- 「附近便利商店」→ {{"intent_type":"nearby","category":"convenience","location":null,...}}
"""


# --- 輔助函數 ---

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """計算兩點間距離（公尺）"""
    R = 6371000
    lat1_rad, lat2_rad = radians(lat1), radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lng = radians(lng2 - lng1)
    
    a = sin(delta_lat/2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c


async def parse_intent(
    api_key: str,
    query: str,
    region: Optional[str] = None
) -> Dict:
    """
    使用 AI 解析用戶意圖（唯一的 AI 調用！）
    """
    client = genai.Client(api_key=api_key)
    
    prompt = INTENT_PARSE_PROMPT.format(
        query=query,
        region=region or "未知"
    )
    
    config = types.GenerateContentConfig(
        temperature=0.1,  # 低溫度確保穩定
        max_output_tokens=400
    )
    
    try:
        response = client.models.generate_content(
            model=WORKHORSE_MODEL,
            contents=prompt,
            config=config
        )
        
        text = response.text
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            print(f"✅ Intent parsed: {result}")
            return result
        
    except Exception as e:
        print(f"⚠️ Intent parse failed: {e}")
    
    # Fallback: 基本規則解析
    return {
        "intent_type": "specific",
        "category": "restaurant" if any(k in query for k in ["吃", "餐", "麵", "飯"]) else None,
        "food_type": None,
        "location": None,
        "keywords": [query]
    }


async def get_poi_candidates(
    intent: Dict,
    lat: float,
    lng: float,
    max_distance: int = 10000  # 10km 最大驗證距離
) -> Tuple[List[Dict], Optional[Tuple[float, float]]]:
    """
    根據意圖獲取 POI 候選（純 API，無 AI）
    
    Returns:
        (候選列表, 目標坐標)
    """
    intent_type = intent.get("intent_type", "specific")
    category = intent.get("category", "restaurant")
    location = intent.get("location")
    
    print(f"🔍 get_poi_candidates: type={intent_type}, category={category}, location={location}")
    
    # 確定搜尋坐標
    search_lat, search_lng = lat, lng
    target_coords = None
    
    if location:
        try:
            geo_result = await geocode_place(location, lat, lng)
            if geo_result and geo_result.get("lat") and geo_result.get("lng"):
                search_lat = geo_result["lat"]
                search_lng = geo_result["lng"]
                target_coords = (search_lat, search_lng)
                print(f"✅ Geocoded '{location}' → ({search_lat:.4f}, {search_lng:.4f})")
        except Exception as e:
            print(f"⚠️ Geocode failed: {e}")
    
    # 類別映射
    category_map = {
        "restaurant": "restaurant",
        "shopping": "department_store",
        "convenience": "convenience",
        "pharmacy": "pharmacy",
        "attraction": "popular"
    }
    poi_category = category_map.get(category, "restaurant")
    
    # 多階段搜尋：逐步擴大半徑
    for radius in [1000, 2000, 3000, 5000]:
        print(f"🔍 Searching POI: category={poi_category}, radius={radius}m")
        try:
            pois = await search_poi_combined(
                lat=search_lat,
                lng=search_lng,
                category=poi_category,
                radius=radius
            )
            
            if pois and len(pois) > 0:
                print(f"✅ Found {len(pois)} POIs at radius={radius}m")
                
                # 驗證：過濾太遠的結果（如果有目標位置）
                if target_coords:
                    valid_pois = []
                    for poi in pois:
                        poi_lat = poi.get("lat")
                        poi_lng = poi.get("lng")
                        if poi_lat and poi_lng:
                            dist = haversine_distance(target_coords[0], target_coords[1], poi_lat, poi_lng)
                            if dist <= max_distance:
                                poi["distance_to_target"] = round(dist)
                                valid_pois.append(poi)
                    
                    if valid_pois:
                        print(f"✅ {len(valid_pois)} POIs within {max_distance}m of target")
                        return valid_pois, target_coords
                else:
                    return pois, None
                    
        except Exception as e:
            print(f"⚠️ POI search failed at radius={radius}: {e}")
    
    print("❌ No POI candidates found")
    return [], target_coords


async def smart_search(
    api_key: str,
    query: str,
    lat: float,
    lng: float,
    region: Optional[str] = None,
    trip_title: Optional[str] = None,
    max_results: int = 5
) -> Dict:
    """
    🛡️ 防胡謅版智能搜尋
    
    設計：
    - 只用 1 次 AI 調用（Intent 解析）
    - 不生成推薦理由
    - 只返回 POI 真實資料
    """
    print(f"🧠 Smart Search: query='{query}', region='{region}'")
    
    # Step 1: AI 解析意圖（唯一的 AI 調用）
    intent = await parse_intent(api_key, query, region or trip_title)
    
    # Step 2: 獲取 POI 候選（純 API，無 AI）
    candidates, target_coords = await get_poi_candidates(intent, lat, lng)
    
    # Step 3: 構建響應
    location_str = intent.get("location") or "附近"
    category_str = intent.get("food_type") or intent.get("category") or "地點"
    
    if candidates and len(candidates) > 0:
        # 成功：返回真實 POI 資料
        results = []
        for poi in candidates[:max_results]:
            # 只返回真實資料，不添加任何 AI 生成的描述！
            results.append({
                "name": poi.get("name", ""),
                "lat": poi.get("lat"),
                "lng": poi.get("lng"),
                "address": poi.get("address", ""),
                "distance": poi.get("distance"),
                "rating": poi.get("rating"),
                "source": poi.get("source", "osm")
            })
        
        return {
            "status": "success",
            "query_type": intent.get("intent_type", "specific"),
            "understood_intent": f"在{location_str}找{category_str}",
            "results": results,
            "total_found": len(candidates)
        }
    else:
        # 失敗：明確說找不到，不要胡謅！
        return {
            "status": "not_found",
            "query_type": intent.get("intent_type", "specific"),
            "understood_intent": f"在{location_str}找{category_str}",
            "message": f"在{location_str}附近找不到{category_str}相關店家",
            "suggestions": [
                "嘗試更大的搜尋範圍",
                "使用更具體的地名",
                "嘗試其他類別"
            ]
        }
