
import asyncio
import os
from google import genai
from google.genai import types

# 模擬後端的 COUNTRY_BOUNDS
COUNTRY_BOUNDS = {
    "JP": {"name": "日本"},
    "KR": {"name": "韓國"},
    "TW": {"name": "台灣"},
    "CN": {"name": "中國"},
}

async def detect_country(trip_title, api_key):
    if not trip_title or not api_key:
        print(f"❌ Missing title or key")
        return None
    
    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""判斷這個旅遊行程的目的地國家。

行程標題：「{trip_title}」

請只回覆國家代碼（如 JP、KR、TW...）。
如果無法判斷，回覆 NONE。
只輸出代碼，不要其他文字。"""

        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0, max_output_tokens=10)
        )
        
        result = response.text.strip().upper()
        if result in COUNTRY_BOUNDS:
            print(f"✅ '{trip_title}' -> {result}")
            return result
        print(f"⚠️ '{trip_title}' -> {result} (Not in bounds)")
        return None
    except Exception as e:
        print(f"🔥 Error: {e}")
        return None

async def main():
    # 嘗試從環境變數獲取 Key
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ No GEMINI_API_KEY found in env")
        return

    test_titles = [
        "2026 Japan Trip",
        "東京五日遊",
        "Tokyo Adventure",
        "大阪京都",
        "My Summer Vacation", # 應該是 NONE
        "Seoul Food Trip"
    ]
    
    print("--- Testing Country Detection ---")
    for title in test_titles:
        await detect_country(title, api_key)

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(main())
