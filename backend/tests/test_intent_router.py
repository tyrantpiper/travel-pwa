"""
Tests for intent_router.py
"""

import pytest
import asyncio
from unittest.mock import patch, AsyncMock

from services.intent_router import (
    classify_chat_intent,
    _fast_path_classify,
    _workhorse_classify
)
from services.model_manager import (
    ADD_ITINERARY_TOOL,
    REMOVE_ITINERARY_TOOL,
    EXPENSE_TOOL
)


def test_fast_path_greetings():
    for text in ["你好", "早安", "hello", "hi", "嗨！", "謝謝~"]:
        assert _fast_path_classify(text) == "CHAT"


def test_fast_path_remove_itinerary():
    for text in [
        "幫我刪除淺草寺",
        "把晴空塔行程移除",
        "取消去東京鐵塔",
        "把 Day 2 的拉麵拿掉",
        "不要去築地市場了"
    ]:
        assert _fast_path_classify(text) == "REMOVE_ITINERARY"


def test_fast_path_expense():
    for text in [
        "中午吃壽司花了 2400 日幣",
        "記帳 1500 円",
        "伴手禮買了 3000 元",
        "剛剛付了門票費 800 TWD"
    ]:
        assert _fast_path_classify(text) == "EXPENSE"


def test_fast_path_itinerary():
    for text in [
        "幫我把淺草寺排進 Day 2",
        "加到第 3 天下午",
        "排入東京鐵塔",
        "推薦晴空塔附近景點並排進去"
    ]:
        assert _fast_path_classify(text) == "ITINERARY"


def test_fast_path_composite():
    text = "把居酒屋排進 Day 3 晚餐，並記一筆 3000 日圓餐費"
    assert _fast_path_classify(text) == "COMPOSITE"


def test_fast_path_diagnosis():
    text = "幫我看這樣排行程順不順？會不會太趕？"
    assert _fast_path_classify(text) == "DIAGNOSIS"


@pytest.mark.asyncio
async def test_classify_chat_intent_fast_path():
    # 1. 閒聊短路
    intent, tools = await classify_chat_intent("早安")
    assert intent == "CHAT"
    assert len(tools) == 0

    # 2. 移除行程
    intent, tools = await classify_chat_intent("把淺草寺刪除")
    assert intent == "REMOVE_ITINERARY"
    assert tools == [REMOVE_ITINERARY_TOOL]

    # 3. 新增行程
    intent, tools = await classify_chat_intent("把晴空塔加到 Day 1")
    assert intent == "ITINERARY"
    assert tools == [ADD_ITINERARY_TOOL]

    # 4. 記帳
    intent, tools = await classify_chat_intent("吃了拉麵花了 1000 日圓")
    assert intent == "EXPENSE"
    assert tools == [EXPENSE_TOOL]

    # 5. 複合
    intent, tools = await classify_chat_intent("把一蘭排進 Day 2 並記帳 1200 円")
    assert intent == "COMPOSITE"
    assert tools == [ADD_ITINERARY_TOOL, EXPENSE_TOOL]


@pytest.mark.asyncio
async def test_workhorse_classify_success():
    with patch("services.intent_router.call_extraction_server", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = '{"intent": "itinerary"}'
        intent = await _workhorse_classify("我想去看看有什麼好逛的地方")
        assert intent == "ITINERARY"


@pytest.mark.asyncio
async def test_workhorse_classify_timeout():
    async def slow_mock(*args, **kwargs):
        await asyncio.sleep(2.0)
        return '{"intent": "itinerary"}'

    with patch("services.intent_router.call_extraction_server", side_effect=slow_mock):
        intent = await _workhorse_classify("這是一句極度複雜且難以辨識的自然語言提問")
        # 應於 1.0s 超時後降級為 CHAT
        assert intent == "CHAT"
