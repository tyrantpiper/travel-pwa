import pytest
import sys
import os
from unittest.mock import AsyncMock, patch, MagicMock

# 確保 backend 目錄在 sys.path 中，這樣才能 import services
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.model_manager import (
    call_with_fallback,
    call_extraction,
    WORKHORSE_MODEL,
    LITE_MODEL,
    GEMINI_3_FLASH
)

# --- Fake Response Objects for Mocking ---

class FakePart:
    def __init__(self, text):
        self.text = text

class FakeContent:
    def __init__(self, text):
        self.parts = [FakePart(text)]

class FakeCandidate:
    def __init__(self, text):
        self.content = FakeContent(text)
        self.grounding_metadata = None

class FakeResponse:
    def __init__(self, text="Fake response text"):
        self.text = text
        self.candidates = [FakeCandidate(text)]

# --- Tests ---

@pytest.mark.asyncio
@patch('services.model_manager.genai.Client')
async def test_call_with_fallback_success_after_failure(mock_genai_client_class):
    """
    測試: 當主模型 (GEMINI_3_FLASH) 拋出錯誤時，系統是否能無縫切換至備用模型 (WORKHORSE_MODEL)。
    這不會消耗真實 Token 額度。
    """
    # 建立一個 Mock 的 client 實例
    mock_client = MagicMock()
    mock_genai_client_class.return_value = mock_client
    
    # Mock chats.create() 回傳一個 Mock chat
    mock_chat = MagicMock()
    mock_client.chats.create.return_value = mock_chat
    
    # 模擬第一次呼叫送出 Exception，第二次呼叫送出 FakeResponse
    # 注意: send_message 是同步呼叫 (Synchronous)
    mock_chat.send_message.side_effect = [
        Exception("429 Quota Exceeded"),          # 第一次呼叫: 爆炸
        FakeResponse("我是降級後的備用模型回覆！") # 第二次呼叫: 成功
    ]
    
    # 執行函數
    result = await call_with_fallback(
        api_key="fake_key",
        history=[{"role": "user", "content": "你好"}],
        message="測試"
    )
    
    # 斷言 1: 結果文本是否正確提取自第二次呼叫
    assert result["text"] == "我是降級後的備用模型回覆！"
    
    # 斷言 2: 確認模型標籤被正確更新為降級模型
    assert result["model_used"] == WORKHORSE_MODEL
    
    # 斷言 3: 確認 chats.create 被呼叫了剛好兩次 (第一次是主要，第二次是備用)
    assert mock_client.chats.create.call_count == 2
    
    # 檢查調用參數，第二次呼叫必須使用的是 WORKHORSE_MODEL
    second_call_kwargs = mock_client.chats.create.call_args_list[1].kwargs
    assert second_call_kwargs['model'] == WORKHORSE_MODEL


@pytest.mark.asyncio
@patch('services.model_manager.genai.Client')
async def test_call_extraction_double_fallback(mock_genai_client_class):
    """
    測試雙重降級防禦網:
    Flash 失敗 -> Gemma 失敗 -> Lite 救場成功
    """
    mock_client = MagicMock()
    mock_genai_client_class.return_value = mock_client
    
    # 模擬 generate_content 的三次呼叫狀態
    # (Flash掛, Gemma掛, Lite成)
    mock_client.models.generate_content.side_effect = [
        Exception("503 Service Unavailable"),
        Exception("Model Overloaded - Context too large"),
        FakeResponse("我是最後一道防線 Lite 跑出來的資料！")
    ]
    
    # 執行函數 (預期不會拋出錯誤，並且拿到 Lite 的字串)
    result_text = await call_extraction(
        api_key="fake_key",
        prompt="請解析這些資料..."
    )
    
    # 斷言 1: 最終拿到成功字串
    assert result_text == "我是最後一道防線 Lite 跑出來的資料！"
    
    # 斷言 2: 確認 generate_content 確實被重試了總共三次
    assert mock_client.models.generate_content.call_count == 3
    
    # 斷言 3: 驗證模型切換順序是否精準
    calls = mock_client.models.generate_content.call_args_list
    assert calls[0].kwargs['model'] == GEMINI_3_FLASH
    assert calls[1].kwargs['model'] == WORKHORSE_MODEL
    assert calls[2].kwargs['model'] == LITE_MODEL


@pytest.mark.asyncio
@patch('services.model_manager.genai.Client')
async def test_call_with_fallback_total_collapse(mock_genai_client_class):
    """
    測試末日劇本 (Doomsday Scenario):
    所有模型都失效時，系統必須拋出 Exception 給外層處理，而非靜默失敗。
    """
    mock_client = MagicMock()
    mock_genai_client_class.return_value = mock_client
    mock_chat = MagicMock()
    mock_client.chats.create.return_value = mock_chat
    
    # 主力跟備用全部都拋出 Exception
    mock_chat.send_message.side_effect = [
        Exception("API 網路斷線"),
        Exception("備用機房也斷線")
    ]
    
    # 執行並斷言會拋出 Error
    with pytest.raises(Exception, match="備用機房也斷線"):
        await call_with_fallback(
            api_key="fake_key",
            history=[],
            message="幫我生資料"
        )
    
    # 確認呼叫了兩次後拋錯
    assert mock_client.chats.create.call_count == 2
