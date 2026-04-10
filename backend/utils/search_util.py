"""
Search Utility (Fusion Phase 1)
------------------------------
Lightweight heuristic detection for search intent.
Used to decide whether to trigger Smart Search (POI) 
alongside standard Geocoding.
"""

import re

# POI Intent Keywords (Traditional & Simplified Chinese + Common English)
# Categorized for future potential expansion
POI_KEYWORDS = {
    "food": ["餐廳", "美食", "拉麵", "壽司", "燒肉", "甜點", "咖啡", "restaurant", "food", "ramen", "sushi", "cafe"],
    "shopping": ["藥妝", "百貨", "購物", "超市", "超商", "便利店", "mall", "shopping", "drugstore", "supermarket"],
    "attraction": ["景點", "主題樂園", "博物館", "神社", "寺廟", "公園", "attraction", "shrine", "museum", "park", "disney"],
    "generic": ["推薦", "值得去", "好玩", "哪裡有", "周邊", "附近", "recommend", "best"]
}

# Compile into a single regex for O(n) performance
_ALL_KW = [kw for list_kw in POI_KEYWORDS.values() for kw in list_kw]
POI_PATTERN = re.compile("|".join(rf"\b{re.escape(k)}\b" if k.isascii() else re.escape(k) for k in _ALL_KW), re.IGNORECASE)

def is_poi_query(query: str) -> bool:
    """
    🧠 快速判定是否為 POI 意圖查詢
    
    Returns:
        bool: True if query likely targets specific points of interest.
    """
    if not query:
        return False
    
    # 1. Regex Match (Keywords)
    if POI_PATTERN.search(query):
        return True
    
    # 2. Pattern Match (e.g. "Something in Someplace")
    # "の" (no) is common in Japanese POI naming but also in street names, 
    # so we rely on explicit keywords for now to avoid false positives.
    
    return False
