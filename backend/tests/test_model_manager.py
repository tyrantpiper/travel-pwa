"""
Test Suite for Model Manager v5.0
==================================

Tests the new routing-array based fallback, config sanitizer,
and multi-tier degradation logic.
"""

import pytest
import sys
import os
from unittest.mock import AsyncMock, patch, MagicMock

# 確保 backend 目錄在 sys.path 中
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.model_manager import (
    call_with_fallback,
    call_extraction,
    call_verifier,
    sanitize_config_for_model,
    get_generation_config,
    build_effective_routing
)
from utils.ai_config import DAILY_ROUTING, HEAVY_ROUTING, WORKHORSE_MODEL
from google.genai import types


# --- Fake Response Objects for Mocking ---

class FakePart:
    def __init__(self, text):
        self.text = text
        self.thought = None
        self.function_call = None

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


# ═══════════════════════════════════════════════════════════════
# 🧪 Config Sanitizer Tests
# ═══════════════════════════════════════════════════════════════

def test_sanitize_removes_thinking_for_gemini_25():
    """Gemini 2.5 不支援 thinking_config，必須被移除"""
    config = types.GenerateContentConfig(
        temperature=1.0,
        max_output_tokens=1024,
    )
    # 手動設定 thinking_config (模擬 Gemini 3 配置)
    config.thinking_config = types.ThinkingConfig(thinking_budget=1024)
    
    safe = sanitize_config_for_model(config, "gemini-2.5-flash", "CHAT")
    assert safe.thinking_config is None


def test_sanitize_removes_tools_for_gemma():
    """Gemma 不支援 google_search 等工具，必須被移除"""
    config = types.GenerateContentConfig(
        temperature=1.0,
        tools=[{"google_search": {}}],
    )
    
    safe = sanitize_config_for_model(config, "gemma-3-27b-it", "SUMMARIZE")
    assert safe.tools is None
    assert safe.thinking_config is None  # 同時應被移除


def test_sanitize_keeps_config_for_gemini_3():
    """Gemini 3 應被強制移除 google_search 以防止 429 Error"""
    config = types.GenerateContentConfig(
        temperature=0.5,  # 會被移除
        tools=[{"google_search": {}}],
    )
    
    safe = sanitize_config_for_model(config, "gemini-3-flash-preview", "HEAVY")
    assert safe.tools is None
    assert safe.temperature is None  # 2026 最佳實踐：重設為 None


def test_sanitize_enforces_temperature_for_gemini_3():
    """Gemini 3.x 家族應被直接移除自訂 temperature"""
    config = types.GenerateContentConfig(temperature=0.3)
    safe = sanitize_config_for_model(config, "gemini-3.1-flash-lite", "LITE")
    assert safe.temperature is None


# ═══════════════════════════════════════════════════════════════
# 🧪 call_with_fallback Tests
# ═══════════════════════════════════════════════════════════════

@pytest.mark.asyncio
@patch('services.model_manager.get_cached_client')
async def test_call_with_fallback_routing_array(mock_get_client):
    """
    測試: 路由陣列降級 — 第一個模型失敗，自動嘗試第二個。
    """
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_chat = MagicMock()
    mock_client.aio.chats.create.return_value = mock_chat
    
    # 模擬：第一次失敗，第二次成功
    mock_chat.send_message = AsyncMock()
    mock_chat.send_message.side_effect = [
        Exception("429 Quota Exceeded"),
        FakeResponse("降級成功！")
    ]
    
    result = await call_with_fallback(
        api_key="fake_key",
        history=[{"role": "user", "content": "你好"}],
        message="測試"
    )
    
    # 結果來自第二個模型
    assert result["text"] == "降級成功！"
    assert result["model_used"] == HEAVY_ROUTING[1]
    assert mock_client.aio.chats.create.call_count == 2


@pytest.mark.asyncio
@patch('services.model_manager.get_cached_client')
async def test_call_with_fallback_total_collapse(mock_get_client):
    """
    測試末日劇本: 路由陣列中所有模型都失效 → 拋出 Exception。
    """
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_chat = MagicMock()
    mock_client.aio.chats.create.return_value = mock_chat
    
    # 所有模型全部失敗 (Gemini + Gemma 救援層)
    effective_routing = build_effective_routing("CHAT")
    mock_chat.send_message = AsyncMock()
    mock_chat.send_message.side_effect = [
        Exception(f"Model {i+1} 也掛了") for i in range(len(effective_routing))
    ]
    
    with pytest.raises(Exception, match=f"Model {len(effective_routing)} 也掛了"):
        await call_with_fallback(
            api_key="fake_key",
            history=[],
            message="幫我生資料"
        )
    
    # 確認嘗試了所有候選模型 (含救援層)
    effective_routing = build_effective_routing("CHAT")
    assert mock_client.aio.chats.create.call_count == len(effective_routing)


# ═══════════════════════════════════════════════════════════════
# 🧪 call_extraction Tests
# ═══════════════════════════════════════════════════════════════

@pytest.mark.asyncio
@patch('services.model_manager.get_cached_client')
async def test_call_extraction_triple_fallback(mock_get_client):
    """
    測試三重降級: HEAVY_ROUTING[0] → [1] → [2]
    """
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    
    mock_client.aio.models.generate_content = AsyncMock()
    mock_client.aio.models.generate_content.side_effect = [
        Exception("503 Service Unavailable"),
        Exception("Model Overloaded"),
        FakeResponse("最後一道防線成功！")
    ]
    
    result_text = await call_extraction(
        api_key="fake_key",
        prompt="請解析這些資料..."
    )
    
    assert result_text == "最後一道防線成功！"
    assert mock_client.aio.models.generate_content.call_count == 3
    
    # 驗證模型切換順序
    calls = mock_client.aio.models.generate_content.call_args_list
    assert calls[0].kwargs['model'] == HEAVY_ROUTING[0]
    assert calls[1].kwargs['model'] == HEAVY_ROUTING[1]
    assert calls[2].kwargs['model'] == HEAVY_ROUTING[2]


@pytest.mark.asyncio
@patch('services.model_manager.get_cached_client')
async def test_call_extraction_custom_routing(mock_get_client):
    """
    測試自定義路由策略覆寫。
    """
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    
    mock_client.aio.models.generate_content = AsyncMock()
    mock_client.aio.models.generate_content.return_value = FakeResponse("OK")
    
    await call_extraction(
        api_key="fake_key",
        prompt="test",
        routing_strategy=DAILY_ROUTING  # 覆寫為 DAILY_ROUTING
    )
    
    # 應使用 DAILY_ROUTING[0] 而非預設的 HEAVY_ROUTING[0]
    call_kwargs = mock_client.aio.models.generate_content.call_args.kwargs
    assert call_kwargs['model'] == DAILY_ROUTING[0]


# ═══════════════════════════════════════════════════════════════
# 🧪 Thought Signature End-to-End Tests
# ═══════════════════════════════════════════════════════════════

def test_thought_signature_end_to_end():
    """
    測試: 原生思想簽名端到端『二進位 ➔ Base64 ➔ 原生二進位』無損閉環。
    """
    import base64
    from services.model_manager import _serialize_part, build_chat_history

    sample_sig_bytes = b"\x00\x01\x02\x03\x04\x05_gemini_thought_save_state_token_xyz"
    part_with_sig = types.Part(
        text="規劃東京拉麵行程中...",
        thought=True,
        thought_signature=sample_sig_bytes
    )

    # 1. 序列化測試
    serialized = _serialize_part(part_with_sig)
    assert serialized.get("thought_signature") == base64.b64encode(sample_sig_bytes).decode("utf-8")
    assert serialized.get("thoughtSignature") == serialized.get("thought_signature")

    # 2. 文字 Part 還原測試
    mock_client_history = [{"role": "model", "rawParts": [serialized]}]
    reconstructed = build_chat_history(mock_client_history)
    reconstructed_part = reconstructed[0].parts[0]
    assert reconstructed_part.thought_signature == sample_sig_bytes
    assert isinstance(reconstructed_part.thought_signature, bytes)

    # 3. Function Call Part 還原測試
    fc_part = types.Part(
        function_call=types.FunctionCall(name="add_itinerary_item", args={"place": "Tokyo Tower"}),
        thought_signature=sample_sig_bytes
    )
    fc_serialized = _serialize_part(fc_part)
    fc_reconstructed = build_chat_history([{"role": "model", "rawParts": [fc_serialized]}])[0].parts[0]
    assert fc_reconstructed.thought_signature == sample_sig_bytes
    assert fc_reconstructed.function_call.name == "add_itinerary_item"


# ═══════════════════════════════════════════════════════════════
# 🧪 Google Maps & Search Grounding Tests
# ═══════════════════════════════════════════════════════════════

def test_google_maps_grounding_sanitization():
    """
    測試: 支援 Grounding 的模型自動注入 Google Search 與 Google Maps 工具；
    不支援 Grounding 的模型自動淨化移除。
    """
    from services.model_manager import sanitize_config_for_model

    # 1. 測試 Grounding 支援模型 (Gemini 3.7 Flash)
    config_in = types.GenerateContentConfig()
    safe_config = sanitize_config_for_model(config_in, "gemini-3.7-flash", "CHAT")
    assert safe_config.tools is not None
    assert len(safe_config.tools) == 1
    tool = safe_config.tools[0]
    assert tool.google_search is not None
    assert tool.google_maps is not None
    assert tool.google_maps.enable_widget is True

    # 2. 測試非 Grounding 支援模型 (Gemma 3)
    gemma_config = sanitize_config_for_model(safe_config, "gemma-3-27b-it", "CHAT")
    if gemma_config.tools:
        for t in gemma_config.tools:
            assert getattr(t, 'google_search', None) is None
            assert getattr(t, 'google_maps', None) is None


