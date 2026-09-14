"""
Intent & Dynamic Tool Router (Hybrid Two-Stage)
-----------------------------------------------
Stage 1: 0ms 確定性正則快篩 (問候、記帳、新增行程、移除行程、健檢、複合)
Stage 2: 31B 工作馬極速語意前置分類 (1.0s 超時平滑降級)
"""

import re
import json
import asyncio
from typing import Tuple, List, Optional
from google.genai import types

from services.model_manager import (
    ADD_ITINERARY_TOOL,
    REMOVE_ITINERARY_TOOL,
    EXPENSE_TOOL,
    NEURAL_LINK_TOOLS,
    call_extraction_server,
    detect_diagnosis_intent,
)

# ═══════════════════════════════════════════════════════════════
# ⚡ Stage 1: Fast-Path 確定性正則規則庫 (0ms)
# ═══════════════════════════════════════════════════════════════

GREETING_PATTERN = re.compile(
    r"^[\s]*(你好|您好|哈囉|hello|hi|hey|早安|午安|晚安|嗨|嗨嗨|謝謝|感謝|多謝|thx|thanks|3q)[\s\!！\?？\.\~]*$",
    re.IGNORECASE
)

REMOVE_PATTERN = re.compile(
    r"(刪除|移除|拿掉|取消|不要去|不要排|從行程.*(刪|拿|移除)|把.*(刪掉|移除|拿掉|取消))",
    re.IGNORECASE
)

EXPENSE_PATTERN = re.compile(
    r"(\b\d+\s*(日圓|日幣|円|twd|nt\$|台幣|塊|元|usd|dollars?|jpy)\b|(記帳|花了|買了|花費|消費|付了|餐費|門票費|車資))",
    re.IGNORECASE
)

ITINERARY_PATTERN = re.compile(
    r"(排進|加到|加進|排入|加入行程|安排到|排在|加一個|Day\s*\d+|第\s*\d+\s*天|幫我排|想去|推薦.*景點.*排)",
    re.IGNORECASE
)

CHAT_INTENT_PROMPT = """分析使用者在旅遊 App 中的對話意圖，輸出純 JSON (不要任何 markdown)：
{{
  "intent": "chat|itinerary|remove_itinerary|expense|composite|diagnosis"
}}

意圖定義：
- chat: 一般諮詢、閒聊、文化景點問答、穿搭天氣
- itinerary: 要求新增、推薦並安排景點至行程
- remove_itinerary: 要求刪除、取消或拿掉行程中的景點/活動
- expense: 記錄花費、記帳、消費金額
- composite: 同時包含排程與花費記帳
- diagnosis: 詢問行程是否順暢、合理性健檢

使用者訊息：「{message}」
"""


def _fast_path_classify(message: str) -> Optional[str]:
    """0ms 確定性正則快篩"""
    trimmed = message.strip()
    if not trimmed:
        return "CHAT"

    # 1. 短問候語 (短路為 CHAT，完全卸載卡片工具)
    if len(trimmed) <= 8 and GREETING_PATTERN.match(trimmed):
        return "CHAT"

    # 2. 優先檢查移除行程 (避免「把淺草寺移除」被誤判為行程新增)
    if REMOVE_PATTERN.search(trimmed):
        return "REMOVE_ITINERARY"

    # 3. 檢查診斷意圖
    if detect_diagnosis_intent(trimmed):
        return "DIAGNOSIS"

    # 4. 檢查複合意圖 (排程 + 記帳)
    has_expense = bool(EXPENSE_PATTERN.search(trimmed))
    has_itinerary = bool(ITINERARY_PATTERN.search(trimmed))

    if has_expense and has_itinerary:
        return "COMPOSITE"
    if has_expense:
        return "EXPENSE"
    if has_itinerary:
        return "ITINERARY"

    return None


async def _workhorse_classify(message: str, api_key: Optional[str] = None) -> str:
    """Stage 2: 31B 工作馬極速語意前置分類 (帶 1.0s 硬性超時保護)"""
    prompt = CHAT_INTENT_PROMPT.format(message=message[:200])
    try:
        # 使用 1.0 秒超時保護，避免網路卡頓拖累對話首包時間
        raw_text = await asyncio.wait_for(
            call_extraction_server(prompt, intent_type="INTENT_PARSE", api_key=api_key),
            timeout=1.0
        )
        match = re.search(r'\{[\s\S]*\}', raw_text)
        if match:
            data = json.loads(match.group())
            intent = data.get("intent", "").lower()
            intent_map = {
                "chat": "CHAT",
                "itinerary": "ITINERARY",
                "remove_itinerary": "REMOVE_ITINERARY",
                "expense": "EXPENSE",
                "composite": "COMPOSITE",
                "diagnosis": "DIAGNOSIS",
            }
            if intent in intent_map:
                return intent_map[intent]
    except asyncio.TimeoutError:
        print("⏱️ [IntentRouter] 31B 工作馬分類逾時 (>1.0s)，平滑降級為 CHAT")
    except Exception as e:
        print(f"⚠️ [IntentRouter] 31B 工作馬分類失敗: {e}")

    return "CHAT"


async def classify_chat_intent(
    message: str,
    api_key: Optional[str] = None
) -> Tuple[str, List[types.Tool]]:
    """
    統一意圖分流進入點
    Returns:
        (intent_type, tools_to_mount)
    """
    # Stage 1: 0ms 正則快線
    intent = _fast_path_classify(message)

    # Stage 2: 模糊語意啟動 31B 工作馬
    if not intent:
        intent = await _workhorse_classify(message, api_key=api_key)

    # 動態工具綁定映射表
    tool_map = {
        "REMOVE_ITINERARY": [REMOVE_ITINERARY_TOOL],
        "ITINERARY": [ADD_ITINERARY_TOOL],
        "EXPENSE": [EXPENSE_TOOL],
        "COMPOSITE": [ADD_ITINERARY_TOOL, EXPENSE_TOOL],
        "DIAGNOSIS": [ADD_ITINERARY_TOOL],
        "CHAT": [],  # 🟢 純閒聊卸載卡片工具，0 幻覺
    }

    selected_tools = tool_map.get(intent, [])
    print(f"🧭 [IntentRouter] 命中意圖: {intent} (掛載工具數: {len(selected_tools)})")
    return intent, selected_tools
