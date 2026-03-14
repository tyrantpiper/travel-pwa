import sys
import os
import json
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

# Add backend to path
backend_path = r"c:\Users\Ryan Su\ryan-travel-app\backend"
sys.path.append(backend_path)

# Mock dependencies
mock_gemini_key = "fake-key"
mock_user = "test-user-123"

def get_mock_gemini_key(): return mock_gemini_key
def get_mock_verified_user(): return mock_user

with patch("utils.deps.get_gemini_key", get_mock_gemini_key), \
     patch("utils.deps.get_verified_user", get_mock_verified_user):
    from main import app

client = TestClient(app)

def run_phase2_tests():
    print("\n" + "="*50)
    print("PHASE 2: AI EXTRACTION & DIAGNOSTICS TEST")
    print("="*50)

    # --- TEST 1: SUCCESS SAMPLE (Perfect Match) ---
    print("\n[TEST 1] Success Sample (Perfect Match)")
    success_ai_output = {
        "title": "Starbucks",
        "date": "2024-03-13",
        "currency": "JPY",
        "subtotal_amount": 500,
        "tax_amount": 50,
        "tip_amount": 0,
        "service_charge_amount": 0,
        "discount_amount": 0,
        "total_amount": 550,
        "category": "food",
        "items": [{"original_name": "Latte", "amount": 500}]
    }

    with patch("routers.ai.call_extraction", return_value=json.dumps(success_ai_output)):
        response = client.post("/api/ai/parse-receipt", json={"imageUrl": "http://fake.com/img.jpg"})
        data = response.json()
        print(f"Status Code: {response.status_code}")
        print(f"Diagnostics: {data.get('diagnostics')}")
        assert data['diagnostics']['status'] == "pass"
        assert data['total_amount'] == 550

    # --- TEST 2: MISMATCH SAMPLE (Diagnostic Warning) ---
    print("\n[TEST 2] Mismatch Sample (Warning, not 400)")
    mismatch_ai_output = {
        "title": "Overpriced Ramen",
        "date": "2024-03-13",
        "currency": "JPY",
        "subtotal_amount": 1000,
        "tax_amount": 100,
        "tip_amount": 0,
        "service_charge_amount": 0,
        "discount_amount": 0,
        "total_amount": 1200, # 1000 + 100 = 1100 != 1200
        "category": "food",
        "items": [{"original_name": "Ramen", "amount": 1000}]
    }

    with patch("routers.ai.call_extraction", return_value=json.dumps(mismatch_ai_output)):
        response = client.post("/api/ai/parse-receipt", json={"imageUrl": "http://fake.com/img.jpg"})
        data = response.json()
        print(f"Status Code: {response.status_code}")
        print(f"Diagnostics: {data.get('diagnostics')}")
        
        # Verify it's NOT a 400
        assert response.status_code == 200
        assert data['diagnostics']['status'] == "warning"
        assert data['diagnostics']['mismatch_amount'] == 100.0
        assert "運算總額 (1100.0) 與收據總額 (1200.0) 不符" in data['diagnostics']['message']

    print("\n✅ Phase 2 Logic Verified: Rigid 400 is now a soft warning!")

if __name__ == "__main__":
    run_phase2_tests()
