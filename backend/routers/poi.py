"""
POI Router
----------
Handles Point of Interest related endpoints including:
- AI-powered enrichment
- Wikipedia/WikiVoyage integration
- Nearby search
- AI recommendations
"""

import json
import re
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx
from typing import List, Optional, Any, Dict
from google import genai
from google.genai import types

from models.base import POIAIEnrichRequest, POIEnrichRequest, POIRecommendRequest, SmartSearchRequest
from utils.deps import get_gemini_key
from utils.ai_config import LITE_MODEL
from services.poi_service import (
    enrich_poi_complete,
    format_enriched_poi_for_ai,
    search_poi_combined,
    format_pois_for_ai,
    get_ai_prompt_for_recommendation,
    search_wikivoyage
)
from services.smart_search_service import smart_search
from services.model_manager import call_extraction
from utils.poi_utils import generate_v2_cache_key

router = APIRouter(prefix="/api", tags=["poi"])

# 🆕 Phase 2 Cache (Process-level with v2 versioning)
POI_ENRICH_CACHE: Dict[str, Dict] = {}


# ═══════════════════════════════════════════════════════════════════════════════
# POI AI Enrichment
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/poi/ai-enrich")
async def ai_enrich_poi(fastapi_req: Request, request: POIAIEnrichRequest):
    """
    🤖 整合型 POI 增強端點 - 同時取得 AI 摘要與 Wikipedia/WikiVoyage 資訊
    
    具備背景並行抓取、三級保底鏈防護與 v2 版本化快取。
    """
    try:
        # 🆕 Step 3: 快取檢查 (v2 versioned)
        cache_key = generate_v2_cache_key(
            name=request.name,
            lat=request.lat,
            lng=request.lng,
            poi_id=request.poi_id,
            wikidata_id=request.wikidata_id
        )
        
        if cache_key in POI_ENRICH_CACHE:
            print(f"⚡ [Cache Hit] {cache_key}")
            return POI_ENRICH_CACHE[cache_key]

        api_key = request.api_key
        if not api_key:
            raise HTTPException(status_code=400, detail="需要 API Key")
        
        prompt = f"""
You are a travel guide assistant. Search the web for reviews and vibes for:
- Name: {request.name}
- Type: {request.type}
- Location: {request.lat}, {request.lng}

Output in this EXACT JSON format (Traditional Chinese summary):
{{
    "summary": "1-2 sentence vibe check",
    "must_try": ["Item 1", "Item 2"],
    "rating": 4.5,
    "business_status": "OPERATIONAL"
}}
"""
        # 🚀 並行執行 AI 摘要與 Wiki 豐富
        ai_task = call_extraction(api_key, prompt, "POI_ENRICH")
        wiki_task = enrich_poi_complete({
            "name": request.name,
            "wikidata_id": request.wikidata_id or ""
        }, fastapi_req.app.state.client)
        
        ai_result, wiki_result = await asyncio.gather(ai_task, wiki_task, return_exceptions=True)
        
        # 1. 處理 AI 摘要結果
        ai_data = {}
        if not isinstance(ai_result, Exception):
            json_match = re.search(r'\{[\s\S]*\}', ai_result)
            if json_match:
                try:
                    ai_data = json.loads(json_match.group())
                except:
                    ai_data = {"summary": ai_result[:200]}
            else:
                ai_data = {"summary": str(ai_result)[:200]}
        
        # 2. 處理 Wiki 結果
        if isinstance(wiki_result, Exception):
            wiki_result = {
                "status": "PARTIAL_SUCCESS",
                "warnings": ["WIKI_SYSTEM_ERROR"],
                "cultural_desc": None,
                "travel_tips": None
            }
        
        # 🆕 Phase 5.2: AI Translation Fallback
        resolved_lang = wiki_result.get("resolved_language", "zh-TW")
        cultural_desc = wiki_result.get("cultural_desc")
        
        if cultural_desc and resolved_lang != "zh-TW" and not str(resolved_lang).startswith("zh"):
            print(f"🌐 [AI Translate] Translating {resolved_lang} to zh-TW...")
            translation_prompt = f"請將以下維基百科描述翻譯為繁體中文（zh-TW），保持旅遊指南的專業語氣：\n\n{cultural_desc}"
            try:
                translated = await call_extraction(
                    client=fastapi_req.app.state.client,
                    prompt=translation_prompt,
                    intent_type="TRANSLATE"
                )
                if translated:
                    wiki_result["cultural_desc"] = translated
                    wiki_result["resolved_language"] = f"zh-TW (translated from {resolved_lang})"
            except Exception as te:
                print(f"⚠️ Translation failed: {te}")

        # 3. 數據合流與保底鏈 (Summary Fallback Chain)
        final_summary = ai_data.get("summary") or wiki_result.get("cultural_desc") or f"{request.name} 是位於當地的地點。"
        
        # 4. 狀態判定
        ai_success = bool(ai_data.get("summary"))
        wiki_status = wiki_result.get("status", "FAILED")
        
        final_status = "SUCCESS"
        if not ai_success or wiki_status != "SUCCESS":
            final_status = "PARTIAL_SUCCESS"
        if not ai_success and wiki_status == "FAILED":
            final_status = "FAILED"
            
        result_payload = {
            "summary": final_summary,
            "must_try": ai_data.get("must_try") or [],
            "rating": ai_data.get("rating") or 0,
            "business_status": ai_data.get("business_status") or "UNKNOWN",
            "cultural_desc": wiki_result.get("cultural_desc"),
            "travel_tips": wiki_result.get("travel_tips"),
            "resolved_language": wiki_result.get("resolved_language") or "zh-TW",
            "image_url": wiki_result.get("image_url"), # 🆕 Phase 5.4: Expose image
            "status": final_status,
            "warnings": (wiki_result.get("warnings") or []),
            "official_url": wiki_result.get("official_url")
        }

        # 🆕 Step 3: 快取存儲 (僅在完全成功 SUCCESS 時存儲，不快取帶有警告的 PARTIAL 狀態)
        if final_status == "SUCCESS":
            POI_ENRICH_CACHE[cache_key] = result_payload
            
        return result_payload
        
    except Exception as e:
        print(f"🔥 AI POI 整合失敗：{e}")
        raise HTTPException(status_code=500, detail=f"AI 增強失敗: {str(e)}")


@router.post("/poi/enrich")
async def enrich_poi(fastapi_req: Request, body: POIEnrichRequest):
    """
    📚 三源整合 POI 端點 - Wikipedia + WikiVoyage + Wikidata
    
    Returns:
        {
            "display_name": {"primary": "金閣寺", "secondary": "金閣寺 (Kinkaku-ji)"},
            "cultural_desc": "...",
            "travel_tips": "...",
            "official_url": "..."
        }
    """
    try:
        poi = {
            "name": body.name,
            "wikidata_id": body.wikidata_id or ""
        }
        
        enriched = await enrich_poi_complete(poi, fastapi_req.app.state.client)
        formatted = format_enriched_poi_for_ai(enriched)
        
        return {
            "success": True,
            "poi": enriched,
            "formatted": formatted
        }
        
    except Exception as e:
        print(f"🔥 POI 整合失敗：{e}")
        raise HTTPException(status_code=500, detail=f"POI 整合失敗: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# POI Search
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/poi/nearby")
async def search_nearby_poi(
    lat: float,
    lng: float,
    category: str = "restaurant",
    radius: int = 1000
):
    """
    🔍 搜索附近 POI
    
    Args:
        lat: 緯度
        lng: 經度
        category: 類別 (pharmacy, restaurant, convenience, supermarket, department_store, popular)
        radius: 搜索半徑（公尺，預設 1000）
    
    Returns:
        POI 列表（含距離、評分等）
    """
    valid_categories = ["pharmacy", "restaurant", "convenience", "supermarket", "department_store", "popular"]
    if category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid category. Valid: {valid_categories}")
    
    if radius < 100 or radius > 5000:
        raise HTTPException(status_code=400, detail="Radius must be between 100 and 5000 meters")
    
    try:
        pois = await search_poi_combined(lat, lng, category, radius)
        return {
            "count": len(pois),
            "radius": radius,
            "category": category,
            "pois": pois
        }
    except Exception as e:
        print(f"🔥 POI Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/poi/recommend")
async def ai_recommend_poi(request: POIRecommendRequest):
    """
    🤖 基於 POI 列表進行 AI 推薦
    
    Token 優化策略：
    1. POI 資料已由 /api/poi/nearby 預先查詢
    2. 只傳精簡摘要給 Gemini（~200 tokens vs ~2000 tokens）
    3. 節省 80%+ Token 消耗
    """
    if not request.pois:
        return {"recommendation": "附近沒有找到相關地點，請嘗試其他類別或擴大搜索範圍。"}
    
    if not request.api_key:
        raise HTTPException(status_code=400, detail="API key required")
    
    try:
        # Step 1: 格式化 POI 為精簡文字
        pois_text = format_pois_for_ai(request.pois, max_items=5)
        
        # Step 2: 生成精簡 prompt
        prompt = get_ai_prompt_for_recommendation(
            pois_text,
            request.user_query,
            request.user_preferences
        )
        
        # 🆕 v5.0: 使用 call_extraction 獲得 3 層降級保護
        from services.model_manager import call_extraction
        from utils.ai_config import DAILY_ROUTING
        
        recommendation_text = await call_extraction(
            request.api_key, prompt,
            intent_type="POI_ENRICH",
            routing_strategy=DAILY_ROUTING,
        )
        
        return {
            "recommendation": recommendation_text,
            "pois_count": len(request.pois),
            "token_optimized": True
        }
        
    except Exception as e:
        print(f"🔥 POI Recommend Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/poi/categories")
async def get_poi_categories():
    """📋 取得支援的 POI 類別列表"""
    return {
        "categories": [
            {"id": "department_store", "name": "百貨公司", "icon": "🏬"},
            {"id": "restaurant", "name": "美食餐廳", "icon": "🍽️"},
            {"id": "convenience", "name": "便利商店", "icon": "🏪"},
            {"id": "supermarket", "name": "超市", "icon": "🛒"},
            {"id": "pharmacy", "name": "藥局藥妝", "icon": "💊"},
            {"id": "popular", "name": "熱門景點", "icon": "🔥"}
        ]
    }


# ═══════════════════════════════════════════════════════════════════════════════
# WikiVoyage Integration
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/wikivoyage/search")
async def wikivoyage_search(place: str, lang: str = "en"):
    """
    🌍 搜索 WikiVoyage 景點描述
    
    Args:
        place: 景點名稱 (英文效果較佳)
        lang: 語言代碼 (en, ja, zh)
    
    Returns:
        WikiVoyage 頁面資訊
    """
    if not place or len(place) < 2:
        raise HTTPException(status_code=400, detail="Place name too short")
    
    result = await search_wikivoyage(place, lang)
    
    if not result:
        return {
            "found": False,
            "message": f"No WikiVoyage article found for '{place}'"
        }
    
    return {
        "found": True,
        **result
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Smart AI Search (gemma-3-27b powered)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/ai/smart-search")
async def ai_smart_search(request: SmartSearchRequest):
    """
    🧠 智能語意搜尋 - 使用 gemma-3-27b 理解用戶意圖
    
    支援查詢類型：
    - 推薦類：「好吃的拉麵」「值得去的景點」
    - 附近類：「附近有什麼」「周邊餐廳」
    - 條件類：「便宜的壽司」「24小時營業」
    
    策略：gemma-3-27b 優先（14,400 RPD），零成本
    
    Returns:
        {
            "query_type": "recommendation|nearby|specific",
            "understood_intent": "AI 理解的意圖描述",
            "recommendations": [
                {
                    "name": "地點名稱",
                    "reason": "推薦理由",
                    "highlights": ["特色1", "特色2"],
                    "lat": 35.6895,
                    "lng": 139.6917,
                    "rating": 4.5,
                    "distance": 300
                }
            ],
            "source": "gemma_poi|gemma_geocode|poi_fallback"
        }
    """
    if not request.api_key:
        raise HTTPException(status_code=400, detail="API key required")
    
    if not request.query or len(request.query) < 2:
        raise HTTPException(status_code=400, detail="Query too short")
    
    try:
        result = await smart_search(
            api_key=request.api_key,
            query=request.query,
            lat=request.lat,
            lng=request.lng,
            region=request.region,
            trip_title=request.trip_title,
            max_results=request.max_results
        )
        
        return result
        
    except Exception as e:
        print(f"🔥 Smart Search Error: {e}")
        raise HTTPException(status_code=500, detail=f"Smart search failed: {str(e)}")

# ═══════════════════════════════════════════════════════════════════════════════
# Media Proxy (Phase 5.4)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/poi/media-proxy")
async def media_proxy(url: str):
    """
    🖼️ 媒體代理端點 - 解決維基百科圖片的 CORS 與 Referrer 限制
    """
    if not url.startswith("https://upload.wikimedia.org/"):
        raise HTTPException(status_code=400, detail="Invalid media source")

    async def stream_image():
        headers = {
            "User-Agent": "RyanTravelApp/1.2 (contact@example.com)",
            "Referer": "https://www.wikipedia.org/"
        }
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", url, headers=headers) as response:
                if response.status_code != 200:
                    return
                async for chunk in response.aiter_bytes():
                    yield chunk

    # 簡單偵測 content_type (或是預設為 image/jpeg)
    content_type = "image/jpeg"
    if url.lower().endswith(".png"): content_type = "image/png"
    elif url.lower().endswith(".svg"): content_type = "image/svg+xml"
    elif url.lower().endswith(".gif"): content_type = "image/gif"

    return StreamingResponse(stream_image(), media_type=content_type)
