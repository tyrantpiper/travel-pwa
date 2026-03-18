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

from fastapi import APIRouter, Depends, HTTPException
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

router = APIRouter(prefix="/api", tags=["poi"])


# ═══════════════════════════════════════════════════════════════════════════════
# POI AI Enrichment
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/poi/ai-enrich")
async def ai_enrich_poi(request: POIAIEnrichRequest):
    """
    🤖 AI 增強 POI 端點 - 使用 Gemini + Grounding 取得評論摘要
    
    Returns:
        {
            "summary": "AI 懶人包",
            "must_try": ["推薦 1", "推薦 2"],
            "rating": 4.5,
            "business_status": "OPERATIONAL"
        }
    """
    try:
        api_key = request.api_key
        if not api_key:
            raise HTTPException(status_code=400, detail="需要 API Key")
        
        # call_extraction is now at top level
        
        prompt = f"""
You are a travel guide assistant. Search the web for information about this place and provide a structured response.

Target:
- Name: {request.name}
- Type: {request.type}
- Location: {request.lat}, {request.lng}

Please search for reviews, ratings, and popular items (if it's a restaurant).

Output in this EXACT JSON format (no markdown, pure JSON):
{{
    "summary": "A 1-2 sentence vibe check in Traditional Chinese (e.g., 氛圍舒適的咖啡廳，適合約會或工作)",
    "must_try": ["Item 1", "Item 2", "Item 3"],
    "rating": 4.5,
    "business_status": "OPERATIONAL"
}}

If it's not a restaurant, put relevant highlights in must_try field (e.g., ["夜景絕美", "拍照聖地"]).
Rating should be a number from 1-5 based on general web sentiment.
"""
        
        result = await call_extraction(api_key, prompt, "POI_ENRICH")
        
        # 解析 JSON
        json_match = re.search(r'\{[\s\S]*\}', result)
        if json_match:
            data = json.loads(json_match.group())
            return data
        else:
            return {
                "summary": result[:200],
                "must_try": [],
                "rating": 0,
                "business_status": "UNKNOWN"
            }
        
    except Exception as e:
        print(f"🔥 AI POI 增強失敗：{e}")
        raise HTTPException(status_code=500, detail=f"AI 增強失敗: {str(e)}")


@router.post("/poi/enrich")
async def enrich_poi(request: POIEnrichRequest):
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
            "name": request.name,
            "wikidata_id": request.wikidata_id or ""
        }
        
        enriched = await enrich_poi_complete(poi)
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
