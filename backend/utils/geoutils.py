import math

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    計算兩點間的 Haversine 距離（單位：公尺）
    
    準確度：約 0.5% 誤差（對於 50m 門檻足夠精準）
    效能：單次計算 < 1ms
    """
    # 地球平均半徑（WGS84 標準：6371.0088714 km）
    R = 6371008.8  # 轉換為公尺
    
    # 轉換為弧度
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    # Haversine 公式
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * 
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance_meters = R * c
    return distance_meters
