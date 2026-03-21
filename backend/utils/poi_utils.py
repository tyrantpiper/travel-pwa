import re

def normalize_poi_name(name: str) -> str:
    """正規化 POI 名稱：轉小寫、去除多餘空白與括號內容"""
    if not name:
        return ""
    # 轉小寫、去首尾空白
    n = name.lower().strip()
    # 移除括號內容 (例如 "淺草寺 (Senso-ji)" -> "淺草寺")
    n = re.sub(r'\s*[\(\[（【].*?[\)\]）】]', '', n)
    return n.strip()

def round_poi_coord(coord: float) -> str:
    """將座標四捨五入至小數點後 6 位，確保快取命中率"""
    return f"{coord:.6f}"

def generate_v2_cache_key(name: str, lat: float, lng: float, poi_id: str = None, wikidata_id: str = None) -> str:
    """
    生成 POI 增強快取 Key (v2)
    優先順序：poi_id > wikidata_id > normalized_name+coords:v2
    """
    if poi_id:
        return f"poi:v2:id:{poi_id}"
    if wikidata_id:
        return f"poi:v2:wiki:{wikidata_id}"
    
    norm_name = normalize_poi_name(name)
    r_lat = round_poi_coord(lat)
    r_lng = round_poi_coord(lng)
    
    return f"poi:v2:loc:{norm_name}:{r_lat}:{r_lng}"
