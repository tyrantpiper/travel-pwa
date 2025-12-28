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
    """
    log_debug(f"REQ: q='{request.query}', trip='{request.tripTitle}', bias={request.lat},{request.lng}")
    return await smart_geocode_logic(
        request.query, 
        request.limit, 
        request.tripTitle, 
        x_gemini_key, 
        request.lat, 
        request.lng
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
