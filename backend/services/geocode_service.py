"""
Geocode Service - 地理編碼服務
Extracted from main.py for modularization
"""

import os
import json
import httpx
from google import genai
from google.genai import types

# Import AI model config
from utils.ai_config import WORKHORSE_MODEL

# Load API Key
ARCGIS_API_KEY = os.getenv("ARCGIS_API_KEY")

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
    import json
    
    # Step 1: Photon 原生查詢
    base_result = await reverse_geocode_with_photon(lat, lng)
    
    if not base_result:
        return {"name": "Unknown", "address": "", "lat": lat, "lng": lng}
    
    # 如果沒有 API key，返回基本結果
    if not api_key:
        return {**base_result, "lat": lat, "lng": lng}
    
    # Step 2: AI 增強 (中文優化顯示)
    try:
        client = genai.Client(api_key=api_key)
        
        prompt = f"""根據座標 ({lat:.6f}, {lng:.6f}) 和地名 "{base_result.get('name', 'Unknown')}"，
地址：{base_result.get('address', '')}

請提供：
1. display_name: 中文友好名稱（如果已經是中文則優化顯示）
2. type: 地點類型（餐廳/景點/交通站/購物/住宿/其他）
3. description: 一句話描述（20字內）

嚴格按以下 JSON 格式回傳，不要額外說明：
{{"display_name": "...", "type": "...", "description": "..."}}"""

        response = await client.aio.models.generate_content(
            model=WORKHORSE_MODEL,  # gemma-3-27b-it
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0,
                max_output_tokens=150
            )
        )
        
        # 解析 JSON
        text = response.text.strip()
        # 處理可能的 markdown 包裝
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        
        enhanced = json.loads(text)
        
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

# 🆕 Load External JSON for Massive Expansion
try:
    data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "landmarks.json")
    if os.path.exists(data_path):
        with open(data_path, "r", encoding="utf-8") as f:
            external_data = json.load(f)
            # 🔧 Filter: Skip metadata keys (starting with _) and non-dict entries
            valid_entries = {
                k: v for k, v in external_data.items()
                if isinstance(v, dict) and not k.startswith("_")
            }
            LANDMARKS_DB.update(valid_entries)
            print(f"📦 Loaded {len(valid_entries)} external landmarks from landmarks.json")
except Exception as e:
    print(f"⚠️ Failed to load external landmarks: {e}")

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
            model=WORKHORSE_MODEL,  # gemma-3-27b-it (多語言專家)
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
