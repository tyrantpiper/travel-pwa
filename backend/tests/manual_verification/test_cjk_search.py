"""
快速測試腳本：直接呼叫 smart_geocode_logic 測試「台中一中」
繞過 Windows cp950 emoji 編碼問題
"""
import asyncio
import sys
import os
import json
import io

# 強制 UTF-8 輸出
if sys.stdout and hasattr(sys.stdout, 'buffer') and 'pytest' not in sys.modules:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 確保能 import backend modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from services.geocode_service import smart_geocode_logic, expand_cjk_variants

async def main():
    test_query = "台中一中"
    
    print("=" * 60)
    print(f"TEST QUERY: {test_query}")
    print("=" * 60)
    
    # 1. 先測試 expand_cjk_variants
    variants = expand_cjk_variants(test_query)
    print(f"\n[P1-B] CJK variants: {variants}")
    
    # 2. 呼叫 smart_geocode_logic
    print(f"\n[Pipeline] Starting search pipeline...")
    result = await smart_geocode_logic(
        query=test_query,
        limit=5,
        trip_title="台中自由行",
        country=None,
        region=None,
        lat=24.15,
        lng=120.68,
        zoom=12
    )
    
    print(f"\n[Result] Source: {result.get('source', 'unknown')}")
    print(f"[Result] Count: {len(result.get('results', []))}")
    print(f"\n[JSON Output]:")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    # 3. 驗證
    results = result.get("results", [])
    if results:
        first = results[0]
        print(f"\n{'=' * 60}")
        print(f"TOP RESULT:")
        print(f"  Name:    {first.get('name')}")
        print(f"  Lat:     {first.get('lat')}")
        print(f"  Lng:     {first.get('lng')}")
        print(f"  Source:  {first.get('source')}")
        print(f"  Address: {first.get('address')}")
        
        # 台中一中的座標應在 24.14-24.15, 120.68-120.69
        lat = first.get('lat', 0)
        lng = first.get('lng', 0)
        if 24.13 <= lat <= 24.16 and 120.67 <= lng <= 120.70:
            print(f"\n  >>> PASS: Coordinates within Taichung First Senior High School range")
        else:
            print(f"\n  >>> WARN: Coordinates may not be in expected range (24.14, 120.68)")
    else:
        print("\n  >>> FAIL: No results returned")

if __name__ == "__main__":
    asyncio.run(main())
