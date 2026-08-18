# -*- coding: utf-8 -*-
"""
Antigravity Agent Router Test Suite
===================================
Tests for asynchronous research tasks, automated Flash fallback,
status polling, task cancellation, and Travelpayouts pricing injection.
"""

import pytest
import sys
import os
from unittest.mock import patch, MagicMock, AsyncMock

# 確保 backend 目錄在 sys.path 中
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app
from routers.agents import _FALLBACK_TASKS, _fetch_live_pricing_context

client = TestClient(app)

HEADERS = {
    "X-Gemini-API-Key": "AIzaSy" + "A" * 34,
    "Content-Type": "application/json"
}


def test_agents_research_antigravity_success():
    """測試正常啟動 Antigravity 沙盒 Interactions API"""
    mock_interaction = MagicMock()
    mock_interaction.id = "interaction_test_999"

    with patch("google.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.interactions.create.return_value = mock_interaction
        mock_client_cls.return_value = mock_instance

        resp = client.post(
            "/api/agents/research",
            json={
                "prompt": "精算北海道 5 天自駕油資與最佳路線",
                "destination": "CTS",
                "environment": "remote"
            },
            headers=HEADERS
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "started"
        assert data["interaction_id"] == "interaction_test_999"
        assert data["engine"] == "antigravity"


def test_agents_research_flash_fallback_on_error():
    """測試當 Antigravity 沙盒不可用時，自動無縫熔斷降級至 Gemini 3.7 Flash"""
    with patch("google.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        # 模擬 Antigravity 503 錯誤
        mock_instance.interactions.create.side_effect = Exception("503 Service Unavailable: Sandbox queue full")
        mock_client_cls.return_value = mock_instance

        resp = client.post(
            "/api/agents/research",
            json={
                "prompt": "分析東京下北澤古著店清單",
                "destination": "TYO"
            },
            headers=HEADERS
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "started"
        assert data["interaction_id"].startswith("fallback_")
        assert data["engine"] == "gemini-3.7-flash-fallback"


def test_agents_interaction_status_polling():
    """測試獲取與輪詢任務狀態"""
    # 1. 測試 Fallback 任務查詢
    test_id = "fallback_mock_status_id"
    _FALLBACK_TASKS[test_id] = {
        "status": "completed",
        "output_text": "# 北海道自駕深度精算報告\n過路費約 NT$3,500",
        "engine": "gemini-3.7-flash-fallback"
    }

    resp = client.get(f"/api/agents/interactions/{test_id}", headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert "北海道" in data["output_text"]

    # 2. 測試正常 Antigravity 任務查詢
    with patch("google.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_interaction = MagicMock()
        mock_interaction.id = "interaction_real_123"
        mock_interaction.status = "completed"
        mock_interaction.output_text = "沙盒運算完成成果"
        mock_instance.interactions.get.return_value = mock_interaction
        mock_client_cls.return_value = mock_instance

        resp2 = client.get("/api/agents/interactions/interaction_real_123", headers=HEADERS)
        assert resp2.status_code == 200
        assert resp2.json()["output_text"] == "沙盒運算完成成果"


def test_agents_interaction_cancel():
    """測試主動中斷與取消任務"""
    # 1. 取消 Fallback 任務
    test_id = "fallback_cancel_id"
    _FALLBACK_TASKS[test_id] = {"status": "running"}
    resp = client.post(f"/api/agents/interactions/{test_id}/cancel", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert _FALLBACK_TASKS[test_id]["status"] == "cancelled"

    # 2. 取消 Antigravity 沙盒任務
    with patch("google.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_client_cls.return_value = mock_instance

        resp2 = client.post("/api/agents/interactions/interaction_cancel_999/cancel", headers=HEADERS)
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "cancelled"
        mock_instance.interactions.cancel.assert_called_once_with(id="interaction_cancel_999")


@pytest.mark.asyncio
async def test_live_pricing_context_builder():
    """測試 Travelpayouts 即時票價數據封裝與分潤標記"""
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": [
                {"price": 12500, "airline": "長榮航空", "departure_at": "2026-09-15"},
                {"price": 9800, "airline": "樂桃航空", "departure_at": "2026-09-16"}
            ]
        }
        mock_get.return_value = mock_resp

        with patch("routers.agents.TP_TOKEN", "mock_token"):
            context = await _fetch_live_pricing_context("TPE", "NRT")
            assert "Travelpayouts 即時票價參考" in context
            assert "長榮航空" in context
            assert "NT$12,500" in context
            assert "分潤標記追蹤碼" in context
