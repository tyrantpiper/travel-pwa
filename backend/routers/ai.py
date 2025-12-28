"""
AI Router
---------
Handles AI-related API endpoints for trip generation and markdown parsing.
Note: Chat endpoints remain in main.py due to complex dependencies.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from google import genai
from google.genai import types

from models.base import (
    MarkdownImportRequest, 
    GenerateTripRequest, 
    SimplePromptRequest
)
from utils.deps import get_gemini_key
from utils.ai_config import PRIMARY_MODEL
from services.geocode_service import geocode_place

router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/parse-md")
async def parse_markdown(
    request: MarkdownImportRequest,
    api_key: str = Depends(get_gemini_key)
):
    """📝 解析 Markdown 行程表
    
    使用 AI 將 Markdown 格式的行程表轉換為結構化 JSON。
    支援解析：行程項目、每日注意事項、預估花費、交通票券。
    """
    print("📝 收到 Markdown 匯入請求...")
    
    try:
        prompt = f"""
        你是一個專業的旅遊資料分析師。請「完整」分析 Markdown 行程表，轉換為結構化 JSON。
        ⚠️ 重要：請勿遺漏任何表格、注意事項、花費、票券資訊！
        
        Markdown 內容：
        {request.markdown_text}

        任務：
        1. **解析詳細行程 (items)**
           - 每個時間點的活動都要抓取
           - **desc (短備註)**: 簡短說明 (< 30 字)，如「民宿 Check-in」「必吃拉麵」
           - **memo (詳細備忘)**: 較長的地點指引或說明，如「從 B3 出口走 2 分鐘」「需提前 30 分預約」「營業至 22:00」
        
        2. **關鍵：連結優先 (Link Priority)**
           - 如果 Markdown 中的地點有超連結 (例如 `[地點名](https://maps...)`)，請務必將該網址提取到 `link_url` 欄位
           - 這是最高優先級的導航依據
        
        3. **關鍵：地理資訊 (Location)**
           - 即使有連結，還是請提供 `lat`, `lng` 作為地圖標記備用
           - 如果是「飛機上」、「家中」，lat/lng 請給 null
           - `place_name` 請使用「Google Maps 上的正式店名」
        
        4. **關鍵：附屬表格 (Sub Items)**
           - 請精準抓取行程下方的表格 (如超市排名)，解析為 `sub_items`
           - `sub_items` 格式: {{ "name": "店名", "desc": "特色/說明", "link": "連結" }}
        
        5. **🆕 關鍵：每日注意事項 (Day Notes)**
           - 抓取「注意事項」表格，包含重點提醒如入境時間、交通轉乘、出站指引等
           - 格式: `day_notes`: {{ "day_number": [ {{ "icon": "⚠️", "title": "標題", "content": "內容" }} ] }}
        
        6. **🆕 關鍵：每日預估花費 (Day Costs)**
           - 抓取「預估花費」表格的每個項目和金額
           - 格式: `day_costs`: {{ "day_number": [ {{ "item": "交通", "amount": "¥1,200", "note": "備註" }} ] }}
        
        7. **🆕 關鍵：交通票券 (Day Tickets)**
           - 抓取「交通票券」區塊的票券資訊
           - 格式: `day_tickets`: {{ "day_number": [ {{ "name": "京成 ACCESS特急", "price": "¥1,200", "note": "單程，刷 IC" }} ] }}
        
        8. 每日主要城市 (daily_locations): 判斷每一天的主要城市中心點
        
        9. 分類 category 請用小寫英文:
           - 'transport': 機場、車站、租車、搭車移動
           - 'food': 餐廳、咖啡廳、超商、小吃
           - 'hotel': 住宿、飯店、民宿
           - 'shopping': 購物中心、商店街、藥妝店
           - 'sightseeing': 景點、神社、公園
        
        10. 如果有 "必吃"、"預約"、"推薦" 等關鍵字，放入 tags 陣列
        
        11. **日期解析**
            - 從 Markdown 中找出開始日期和結束日期
            - 「Day 1 (2/2)」→ start_date: "2026-02-02"
            - 沒有年份則預設 2026 年
        
        12. **行程標題**
            - 從 Markdown 標題推斷行程名稱

        回傳 JSON 格式範例:
        {{
            "title": "2026 東京×橫濱 15日遊",
            "start_date": "2026-02-02",
            "end_date": "2026-02-16",
            "items": [
                {{ 
                    "day_number": 1, 
                    "time_slot": "10:00", 
                    "place_name": "三谷ビル", 
                    "category": "hotel",
                    "desc": "民宿 Check-in",
                    "memo": "從押上站 B3 出口出來右轉直走約 2 分鐘",
                    "lat": 35.123, 
                    "lng": 139.123,
                    "original_name": "", 
                    "tags": ["預約"], 
                    "cost_amount": 0, 
                    "reservation_code": "",
                    "link_url": "https://maps.google.com/...",
                    "sub_items": []
                }}
            ],
            "daily_locations": {{
                "1": {{ "name": "東京", "lat": 35.6895, "lng": 139.6917 }}
            }},
            "day_notes": {{
                "1": [
                    {{ "icon": "✈️", "title": "機場入境", "content": "成田機場入境約需 1.5-2 小時" }},
                    {{ "icon": "🚇", "title": "ACCESS特急", "content": "搭 ACCESS特急直達押上，車程 58 分" }}
                ]
            }},
            "day_costs": {{
                "1": [
                    {{ "item": "交通", "amount": "¥1,200", "note": "" }},
                    {{ "item": "宵夜", "amount": "¥1,000-2,000", "note": "" }}
                ]
            }},
            "day_tickets": {{
                "1": [
                    {{ "name": "京成 ACCESS特急", "price": "¥1,200", "note": "單程，刷 IC" }}
                ]
            }}
        }}
        
        只回傳 JSON，不要 Markdown 標記。請確保所有表格資訊都被解析到！
        """
        
        # 使用統一的 Model Manager
        from services.model_manager import call_extraction
        raw_text = await call_extraction(api_key, prompt, intent_type="EXTRACTION")
        
        # 清理回傳的文字 (去除 ```json 等標記)
        cleaned_text = raw_text.replace("```json", "").replace("```", "").strip()
        parsed_data = json.loads(cleaned_text)
        
        items = parsed_data.get("items", [])
        
        # 🌍 自動為沒有座標的地點做地理編碼
        if items:
            print(f"🌍 開始地理編碼 {len(items)} 個地點...")
            geocoded_count = 0
            for item in items:
                place = item.get("place_name", "")
                if place and not item.get("lat"):
                    coords = await geocode_place(place)
                    if coords:
                        item["lat"] = coords["lat"]
                        item["lng"] = coords["lng"]
                        geocoded_count += 1
            print(f"✅ 成功地理編碼 {geocoded_count} 個地點")
        
        return {
            "status": "success",
            "title": parsed_data.get("title", "New Trip"),
            "start_date": parsed_data.get("start_date"),
            "end_date": parsed_data.get("end_date"),
            "items": items,
            "daily_locations": parsed_data.get("daily_locations", {}),
            "day_notes": parsed_data.get("day_notes", {}),
            "day_costs": parsed_data.get("day_costs", {}),
            "day_tickets": parsed_data.get("day_tickets", {})
        }
        
    except Exception as e:
        print(f"🔥 Parsing Error: {e}")
        raise HTTPException(status_code=400, detail=f"AI Parse Error: {str(e)}")


@router.post("/generate-trip")
async def generate_trip(
    request: GenerateTripRequest,
    api_key: str = Depends(get_gemini_key)
):
    """🤖 AI 生成行程
    
    根據用戶指定的目的地、天數、興趣生成行程規劃。
    """
    print(f"🤖 AI 生成請求: {request.destination} ({request.days}天)")
    
    try:
        prompt = f"""
        你是專業導遊。請為我規劃一個從 {request.origin} 出發，前往 {request.destination} 的 {request.days} 天行程。
        
        我的興趣重點：{request.interests}
        
        任務：
        1. 規劃每日行程 (09:00 - 21:00)，路線要順暢。
        2. **關鍵：地理資訊**
           - 請使用 Google Maps 工具查詢每個地點的精準經緯度 (lat, lng)。
           - 請提供地點的日文原名 (original_name)。
        3. 詳細說明 (desc)：包含推薦理由、必吃必買。
        4. 每日主要城市 (daily_locations)：判斷每天的住宿城市中心點。
        5. 分類 (category)：務必使用 transport, food, sightseeing, shopping, hotel。

        回傳 JSON 格式 (與 parse-md 格式一致):
        {{
            "items": [
                {{ "day_number": 1, "time_slot": "10:00", "place_name": "...", "original_name": "...", "lat": ..., "lng": ..., "category": "sightseeing", "desc": "..." }}
            ],
            "daily_locations": {{
                "1": {{ "name": "東京", "lat": 35.6895, "lng": 139.6917 }}
            }}
        }}
        """
        
        # 使用統一的 Model Manager
        from services.model_manager import call_extraction
        raw_text = await call_extraction(api_key, prompt, intent_type="PLANNING")
        
        cleaned_text = raw_text.replace("```json", "").replace("```", "").strip()
        parsed_data = json.loads(cleaned_text)
        
        return {"status": "success", "data": parsed_data}
        
    except Exception as e:
        print(f"🔥 Gen Error: {e}")
        raise HTTPException(status_code=400, detail=f"生成失敗: {str(e)}")


@router.post("/ai-generate")
async def ai_generate(
    request: SimplePromptRequest,
    api_key: str = Depends(get_gemini_key)
):
    """🤖 簡化版 AI 生成 (接受自由 prompt)
    
    用戶可以自由輸入 prompt，AI 會規劃一個驚艷的行程。
    """
    print(f"🤖 AI 簡易生成請求: {request.prompt[:50]}...")
    
    try:
        prompt = f"""
        你是「Ryan 旅遊達人」👋 一位熱愛探索當地美食和秘境的資深玩家！
        
        用戶跟你說：{request.prompt}
        
        請發揮你的專業，規劃一個讓用戶驚艷的行程！
        每個地點的 desc 請寫得有溫度，像跟朋友分享私房景點一樣 ❤️
        
        【必須遵守的技術規則】
        1. 如果使用者指定了天數（如"5天"、"五日"），你必須**嚴格遵守**，不可多也不可少
        2. day_number 從 1 開始，最大值等於使用者指定的天數
        3. 如果使用者沒有指定天數，預設規劃 3 天
        4. 每日行程時間 (09:00 - 21:00)，路線要順暢
        5. 分類 (category)：務必使用 transport, food, sightseeing, shopping, hotel
        
        回傳 JSON 格式：
        {{
            "title": "行程標題",
            "start_date": "2025-01-01",
            "end_date": "2025-01-05",
            "items": [
                {{ "day_number": 1, "time_slot": "10:00", "place_name": "...", "category": "sightseeing", "desc": "..." }}
            ]
        }}
        
        ⚠️ 再次提醒：day_number 不可超過使用者指定的天數！
        """
        
        # 直接使用 Client + JSON Mode
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=PRIMARY_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                max_output_tokens=8192
            )
        )
        raw_text = response.text
        
        cleaned_text = raw_text.replace("```json", "").replace("```", "").strip()
        parsed_data = json.loads(cleaned_text)
        
        # 🌍 自動為每個地點查詢經緯度
        if "items" in parsed_data:
            print(f"🌍 開始地理編碼 {len(parsed_data['items'])} 個地點...")
            geocoded_count = 0
            for item in parsed_data["items"]:
                place = item.get("place_name", "")
                if place and not item.get("lat"):
                    coords = await geocode_place(place)
                    if coords:
                        item["lat"] = coords["lat"]
                        item["lng"] = coords["lng"]
                        geocoded_count += 1
            print(f"✅ 成功地理編碼 {geocoded_count} 個地點")
        
        return parsed_data
        
    except Exception as e:
        print(f"🔥 AI Gen Error: {e}")
        raise HTTPException(status_code=400, detail=f"生成失敗: {str(e)}")
