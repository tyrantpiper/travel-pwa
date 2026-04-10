"""
Geocode Router
--------------
Handles all geocoding-related API endpoints.
"""

from fastapi import APIRouter, Header, Request
from models.base import GeocodeSearchRequest, GeocodeReverseRequest
from services.geocode_service import (
    smart_geocode_logic,
    reverse_geocode_with_photon,
    reverse_geocode_with_ai_enhancement,  # 🆕 AI 增強版
    log_debug,
    geocode_place, # 🆕 用於 Tier 3 Fallback
    resolve_address_pipeline
)
from services.link_resolver import resolve_google_maps_link # 🆕 Link-to-Pin 核心
from models.base import ResolveAddressRequest, ResolveAddressErrorResponse
import httpx
import re
import asyncio
from utils.limiter import limiter
from utils.search_util import is_poi_query
from services.smart_search_service import smart_search

router = APIRouter(prefix="/api/geocode", tags=["geocode"])


@router.post("/search")
@limiter.limit("30/minute")
async def geocode_search(
    request: Request,
    body: GeocodeSearchRequest,
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
    log_debug(f"REQ: q='{body.query}', trip='{body.tripTitle}', country={body.country}, region={body.region}, zoom={body.zoom}, bias={body.lat},{body.lng}")
    
    # 💡 搜尋融合 (Search Fusion) Phase 1: 意圖雙向觸發
    # 如果偵測到具體的 POI 意圖（如「拉麵」、「景點」），同步啟動 Smart Search 挖掘。
    search_tasks = []
    
    # Task A: 標考地編碼 (核心導航)
    search_tasks.append(smart_geocode_logic(
        body.query, 
        body.limit, 
        body.tripTitle, 
        x_gemini_key, 
        body.lat, 
        body.lng,
        body.country,
        body.region,
        body.zoom
    ))
    
    # Task B: 智慧意圖挖掘 (僅在偵測到意圖且有 API Key 時)
    trigger_smart = is_poi_query(body.query) and x_gemini_key
    if trigger_smart:
        log_debug(f"🧠 [Fusion] POI Intent Detected: '{body.query}' -> Triggering Smart Search")
        search_tasks.append(smart_search(
            api_key=x_gemini_key,
            query=body.query,
            lat=body.lat or 35.6895, # 預設東京 or 傳入座標
            lng=body.lng or 139.6917,
            region=body.region or body.tripTitle,
            trip_title=body.tripTitle,
            max_results=body.limit
        ))
    
    # 並行處理
    results = await asyncio.gather(*search_tasks, return_exceptions=True)
    
    geocode_results = []
    smart_results = None
    
    # 解析 A: 地理編碼結果 (必然存在)
    if not isinstance(results[0], Exception):
        geocode_results = results[0]
        
    # 解析 B: 智慧搜尋結果 (選用)
    if trigger_smart and len(results) > 1 and not isinstance(results[1], Exception):
        smart_results = results[1]
        
    # 🧬 結果匯流 (Normalization)
    if smart_results and "recommendations" in smart_results:
        # 將 Smart Search 的推薦轉化為地圖 Pin 點格式
        fusion_pois = []
        for rec in smart_results["recommendations"]:
            fusion_pois.append({
                "name": rec["name"],
                "display_name": f"✨ {rec['name']} ({rec['reason']})", # 顯示推薦理由
                "lat": rec["lat"],
                "lng": rec["lng"],
                "type": "poi",
                "importance": 0.9,
                "address": rec.get("highlights", ["推薦地點"])[0],
                "source": "smart_fusion"
            })
        # 決定混合策略：POI 置頂，地理定位置後（這讓「搜拉麵」能直接看到店）
        return fusion_pois + geocode_results
        
    return geocode_results


@router.post("/reverse")
@limiter.limit("30/minute")
async def geocode_reverse(request: Request, body: GeocodeReverseRequest):
    """反向地理編碼：座標 → 地名
    
    使用 Photon（免費無限制）
    """
    print(f"🔍 Reverse geocode: ({body.lat}, {body.lng})")
    
    # 使用 Photon 反向地理編碼
    result = await reverse_geocode_with_photon(body.lat, body.lng)
    if result:
        return {"success": True, **result}
    
    return {"success": False, "name": "Unknown", "address": ""}


@router.post("/resolve-link")
@limiter.limit("20/minute")
async def geocode_resolve_link(request: Request, body: dict):
    """🆕 Heuristic Dual-Link Engine (2026)
    
    解析 Google Maps 座標或 官網/社群 媒體首圖。
    body: { url: str, type: "map" | "media" }
    """
    url = body.get("url")
    res_type = body.get("type", "map")
    
    if not url:
        return {"success": False, "error": "No URL provided"}
        
    # 🛡️ Phase 1: Input Sanitization (針對 iPhone 分享雜訊)
    # 提取第一個 http/https 連結，過濾掉店名與地址雜訊
    if res_type == "map":
        url_match = re.search(r'(https?://[^\s]+)', url)
        if url_match:
            # ✂️ Surgical Strip: Remove trailing punctuation often found in mobile shares
            new_url = url_match.group(1).rstrip('.,!?:;"\'。，！？')
            if new_url != url:
                log_debug(f"🧹 Sanitization: Extracted clean URL from input blob: {new_url[:50]}...")
                url = new_url
        
    if res_type == "media":
        # 解析官網/IG/FB 首圖
        from services.link_resolver import resolve_generic_link
        result = await resolve_generic_link(url)
        return result

    # 預設：解析地圖 (Tier 1 & 2: Redirect + Regex)
    result = await resolve_google_maps_link(url)
    
    # Tier 3: Semantic Fallback
    if not result.get("lat") and result.get("query"):
        geo = await geocode_place(result["query"])
        if geo:
            result["lat"] = geo["lat"]
            result["lng"] = geo["lng"]
            result["method"] = f"{result['method']}+jit_geocode"
            
    return {"success": True, **result}


@router.post("/resolve-address", response_model=None)
@limiter.limit("20/minute")
async def resolve_address(request: Request, body: ResolveAddressRequest, x_gemini_key: str = Header(None, alias="X-Gemini-Key")):
    """📍 獨立地址解析器 (FOSS 規範)
    專門處理結構化地址與 5 大黃金屬性。
    統一返回 ResolveAddressErrorResponse DTO 以利前端判斷 retryable。
    """
    try:
        result = await resolve_address_pipeline(body.address, user_gemini_key=x_gemini_key)
        if result:
            return {"success": True, **result}
        
        # 找不到但沒有拋錯
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=404,
            content={"code": "NOT_FOUND", "message": "無法在地圖上定位此地址", "retryable": False}
        )
        
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        retryable = status in [500, 502, 503, 504]
        
        if status in [429, 403]:
            # Nominatim 限流或 UA 阻擋
            retryable = True
            message = "解析服務繁忙或遭遇限流，請稍後再試"
            status = 429 # Normalize to 429
        else:
            message = "外部地圖服務暫時無法連線"
            
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=status,
            content={"code": f"HTTP_{status}", "message": message, "retryable": retryable}
        )
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={"code": "INTERNAL_ERROR", "message": str(e), "retryable": True}
        )
