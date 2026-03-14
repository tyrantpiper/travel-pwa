import asyncio
import httpx
import sys
import os
import json
import argparse

"""
AI Circuit Health (v23.1)
-----------------------
Permanent smoke test suite to verify the logic-to-SDK pipeline.
Supports both Dummy (Link Check) and Real (Generation Check) modes.
"""

BASE_URL = "http://127.0.0.1:8000"
# Standard testing UUID
USER_ID = "smoke-test-uuid-2026-verify"

async def test_endpoint(client, name, path, json_data, headers):
    print(f"[{name}] testing {path} ... ", end="", flush=True)
    try:
        resp = await client.post(f"{BASE_URL}{path}", json=json_data, headers=headers)
        
        # Logic check: If we get a 200, system is fully healthy.
        # If we get a 400 with "API key not valid", the internal logic-to-SDK chain is healthy but key is dummy.
        if resp.status_code == 200:
            print(" ✅ SUCCESS (AI Generated)")
            return True, resp.json()
        elif resp.status_code == 400 and "API key not valid" in resp.text:
            print(" ⚠️ CIRCUIT OK (Dummy Key recognized by SDK)")
            return True, "circuit_ok"
        elif resp.status_code == 401:
            print(" ❌ AUTH BLOCKED")
            return False, resp.text
        else:
            print(f" ❌ FAILED (HTTP {resp.status_code})")
            print(f"   Response: {resp.text}")
            return False, resp.text
    except Exception as e:
        print(f" ❌ ERROR: {e}")
        return False, str(e)

async def run_suite(api_key, is_real=False):
    print(f"\n🚀 AI Circuit Health Suite [{'REAL' if is_real else 'DUMMY'} MODE]")
    print("=" * 60)
    
    headers = {
        "X-Gemini-API-Key": api_key,
        "X-User-ID": USER_ID,
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: Chat Stream Logic (Inner Fallback tier)
        chat_payload = {
            "message": "Verify system health. Respond with 'System OK'",
            "history": []
        }
        # /api/chat uses call_with_fallback
        await test_endpoint(client, "Chat Logic", "/api/chat", chat_payload, headers)

        # Test 2: AI Actuary (Planning tier)
        actuary_payload = {
            "message": "Calculate $10 + $20",
            "history": [],
            "members": ["TestUser"]
        }
        await test_endpoint(client, "Actuary Logic", "/api/ai/actuary", actuary_payload, headers)
        
    print("=" * 60)
    print("🏁 Suite completed. Check output above.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ryan Travel AI Circuit Health Tool")
    parser.add_argument("--key", help="Gemini API Key (if omitted, uses dummy key)")
    args = parser.parse_args()

    api_key = args.key
    mode_is_real = True
    
    if not api_key:
        # Auto-generate a valid-length dummy key (40 chars)
        api_key = "AIzaSy" + "A" * 33 + "CIRCUIT"
        mode_is_real = False
        print("💡 No key provided. Using Dummy Key to verify logic path only.")
    
    asyncio.run(run_suite(api_key, is_real=mode_is_real))
