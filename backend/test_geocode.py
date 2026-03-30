import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.append('c:/Users/Ryan Su/ryan-travel-app/backend')
load_dotenv('c:/Users/Ryan Su/ryan-travel-app/backend/.env')

from services.geocode_service import resolve_address_pipeline, geocode_with_photon

async def run_tests():
    print('='*50)
    print("🔥 測試 1: Photon WAF 偽裝突破測試 (模糊搜尋)")
    print('='*50)
    try:
        res1 = await geocode_with_photon("高雄醫學大學", limit=1)
        print("✅ Photon 成功回傳結果:")
        for r in res1:
            print(f"   Name: {r.get('name')}, Lat: {r.get('lat')}, Lng: {r.get('lng')}, Address: {r.get('address')}")
    except Exception as e:
        print("❌ Photon 失敗:", e)

    print('='*50)
    print("🛡️ 測試 2: ArcGIS 首發退避演算法測試 (ArcGIS-First 測試)")
    print("目標位址: '807高雄市三民區十全一路100號'")
    print('='*50)
    try:
        res2 = await resolve_address_pipeline("807高雄市三民區十全一路100號")
        if res2:
            print("✅ 瀑布流成功撈回最終結果:")
            print(f"   Name: {res2.get('name')}, Lat: {res2.get('lat')}, Lng: {res2.get('lng')}, Address: {res2.get('address')}")
        else:
            print("❌ 結果為 None，退避失敗")
    except Exception as e:
        print("❌ 地址解析失敗:", e)

asyncio.run(run_tests())
