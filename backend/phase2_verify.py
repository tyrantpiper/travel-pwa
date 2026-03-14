import json
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch

# Mock the AI router logic
async def simulate_parse_receipt(mock_ai_output):
    # This simulates the logic now in backend/routers/ai.py
    data = json.loads(mock_ai_output)
    
    # Breakdown normalization
    breakdowns = ["subtotal_amount", "tax_amount", "tip_amount", "service_charge_amount", "discount_amount"]
    for b in breakdowns:
        if b not in data or data[b] is None:
            data[b] = 0.0
            
    if "details" in data:
        if not data.get("items"):
            data["items"] = data["details"]
        del data["details"]
        
    items_sum = sum(i.get("amount", 0.0) for i in data.get("items", []))
    total = data.get("total_amount", 0.0)
    mismatch = abs(items_sum - total)
    ratio = mismatch / total if total > 0 else 0
    
    status = "pass"
    code = None
    message = None
    
    if total > 0 and (mismatch >= 49.99 or ratio > 0.03):
        status = "warning"
        code = "amount_mismatch"
        message = f"Mismatch: Items sum ({items_sum:.1f}) != Total ({total:.1f})"
        
    data["diagnostics"] = {
        "status": status,
        "source": "ai",
        "code": code,
        "message": message,
        "mismatch_amount": round(mismatch, 2)
    }
    return data

async def run_verification():
    print("--- Phase 2: AI Logic Verification (V23.1) ---")
    
    # CASE 1: Perfect Pass
    pass_json = json.dumps({
        "title": "Starbucks",
        "date": "2026-03-12",
        "currency": "JPY",
        "subtotal_amount": 540.0,
        "tax_amount": 54.0,
        "total_amount": 594.0,
        "items": [{"original_name": "Latte", "amount": 594.0}]
    })
    res1 = await simulate_parse_receipt(pass_json)
    print(f"\n[Case 1: Pass] Status: {res1['diagnostics']['status']}")
    print(f"Diagnostics: {json.dumps(res1['diagnostics'], indent=2)}")

    # CASE 2: Warning (Lawson 50 JPY mismatch)
    warn_json = json.dumps({
        "title": "Lawson",
        "date": "2026-03-12",
        "currency": "JPY",
        "subtotal_amount": 1000.0,
        "total_amount": 1050.0,
        "items": [{"original_name": "Bento", "amount": 1000.0}]
    })
    res2 = await simulate_parse_receipt(warn_json)
    print(f"\n[Case 2: Warning] Status: {res2['diagnostics']['status']}")
    print(f"Diagnostics: {json.dumps(res2['diagnostics'], indent=2)}")

    # CASE 3: Ratio Warning (3.5% mismatch)
    ratio_json = json.dumps({
        "title": "Taxi",
        "date": "2026-03-12",
        "currency": "JPY",
        "total_amount": 1000.0,
        "items": [{"original_name": "Ride", "amount": 965.0}]
    })
    res3 = await simulate_parse_receipt(ratio_json)
    print(f"\n[Case 3: Ratio Warning] Status: {res3['diagnostics']['status']}")
    print(f"Diagnostics: {json.dumps(res3['diagnostics'], indent=2)}")

if __name__ == "__main__":
    asyncio.run(run_verification())
