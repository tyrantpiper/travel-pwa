# -*- coding: utf-8 -*-
"""
Receipt Parsing Diagnostics Test Suite
======================================
Tests for AI extraction result diagnostics, ensuring mathematical mismatch
triggers soft diagnostic warnings rather than hard 400 rejections.
"""

import os
import sys
import json
import pytest
from unittest.mock import patch

# 確保 backend 目錄在 sys.path 中
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

HEADERS = {
    "X-Gemini-API-Key": "AIzaSy" + "A" * 34,
    "Content-Type": "application/json"
}

TINY_PIXEL_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


def test_parse_receipt_success_perfect_match():
    """測試收據解析完全匹配場景 (Status: Pass)"""
    success_ai_output = {
        "title": "Starbucks",
        "date": "2024-03-13",
        "currency": "JPY",
        "subtotal_amount": 500,
        "tax_amount": 0,
        "tip_amount": 0,
        "service_charge_amount": 0,
        "discount_amount": 0,
        "total_amount": 550,
        "category": "food",
        "items": [
            {"original_name": "Latte", "translated_name": "拿鐵", "amount": 500},
            {"original_name": "TAX", "translated_name": "[稅額]", "amount": 50}
        ]
    }

    with patch("routers.ai.call_extraction", return_value=json.dumps(success_ai_output)):
        response = client.post("/api/ai/parse-receipt", json={"image": TINY_PIXEL_BASE64}, headers=HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data.get('diagnostics', {}).get('status') == "pass"
        assert data.get('total_amount') == 550


def test_parse_receipt_mismatch_warning():
    """測試收據金額不符時回傳軟警告 (Warning, not 400)"""
    mismatch_ai_output = {
        "title": "Overpriced Ramen",
        "date": "2024-03-13",
        "currency": "JPY",
        "subtotal_amount": 1000,
        "tax_amount": 0,
        "tip_amount": 0,
        "service_charge_amount": 0,
        "discount_amount": 0,
        "total_amount": 1200,
        "category": "food",
        "items": [
            {"original_name": "Ramen", "translated_name": "拉麵", "amount": 1000},
            {"original_name": "TAX", "translated_name": "[稅額]", "amount": 100}
        ]  # items sum = 1100 != 1200 (mismatch = 100)
    }

    with patch("routers.ai.call_extraction", return_value=json.dumps(mismatch_ai_output)):
        response = client.post("/api/ai/parse-receipt", json={"image": TINY_PIXEL_BASE64}, headers=HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data.get('diagnostics', {}).get('status') == "warning"
        assert data.get('diagnostics', {}).get('mismatch_amount') == 100.0
        assert "Mismatch" in data.get('diagnostics', {}).get('message', '')
