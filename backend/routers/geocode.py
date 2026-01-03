"""
Geocode Router
--------------
Handles all geocoding-related API endpoints.
"""

from fastapi import APIRouter, Header
from models.base import GeocodeSearchRequest, GeocodeReverseRequest
from services.geocode_service import (
    smart_geocode_logic,
    reverse_geocode_with_photon,
    reverse_geocode_with_ai_enhancement,  # 🆕 AI 增強版
    log_debug
)

router = APIRouter(prefix="/api/geocode", tags=["geocode"])


@router.post("/search")
async def geocode_search(
    request: GeocodeSearchRequest,
    x_gemini_key: str = Header(None, alias="X-Gemini-Key")
):
    """🔍 智能地理編碼搜尋（四層架構）
    
    使用多層地理編碼策略：
    1. LANDMARKS_DB 秒回
    2. Photon 中文優化
    3. Nominatim 降級
    4. ArcGIS 最終降級
    
    🆕 支援結構化過濾參數 (country/region)
    """
    log_debug(f"REQ: q='{request.query}', trip='{request.tripTitle}', country={request.country}, region={request.region}, zoom={request.zoom}, bias={request.lat},{request.lng}")
    return await smart_geocode_logic(
        request.query, 
        request.limit, 
        request.tripTitle, 
        x_gemini_key, 
        request.lat, 
        request.lng,
        request.country,    # 🆕 傳遞國家過濾
        request.region,     # 🆕 傳遞區域過濾
        request.zoom        # 🆕 P1: 傳遞縮放層級
    )


@router.post("/reverse")
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
