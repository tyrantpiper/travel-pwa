import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.append('c:/Users/Ryan Su/ryan-travel-app/backend')
load_dotenv('c:/Users/Ryan Su/ryan-travel-app/backend/.env')

from services.geocode_service import geocode_with_photon

async def run_photon_test():
    address = "807高雄市三民區十全一路100號"
    print(f"🔥 正在使用 Photon 引擎單獨測試: '{address}'")
    print('='*50)
    try:
        res1 = await geocode_with_photon(address, limit=3)
        if res1:
            print(f"✅ Photon 成功回傳 {len(res1)} 筆結果:")
            for idx, r in enumerate(res1, 1):
                print(f"   [{idx}] 名稱: {r.get('name')}")
                print(f"       地址: {r.get('address')}")
                print(f"       座標: ({r.get('lat')}, {r.get('lng')})")
                print(f"       類型: {r.get('type')}")
        else:
            print("❌ Photon 回傳 None。這代表這串文字對開源庫來說太混亂了，無法找到匹配點。")
    except Exception as e:
        print("❌ Photon 發生例外錯誤:", e)

asyncio.run(run_photon_test())
