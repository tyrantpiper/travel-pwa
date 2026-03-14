import asyncio
import os
import json
import time
from google import genai
from google.genai import types, errors

# 載入開發環境變數 (模擬後端環境)
from dotenv import load_dotenv
load_dotenv()

# 手動模擬後端路徑
import sys
sys.path.append(os.getcwd())

from utils.ai_config import DAILY_ROUTING, HEAVY_ROUTING
from services.model_manager import get_generation_config, sanitize_config_for_model, _build_chat_history

async def run_audit():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ 錯誤：找不到 GEMINI_API_KEY")
        return

    client = genai.Client(api_key=api_key)
    
    print("--- 🌍 v17.1 AI 全方位行為診斷 ---")
    
    # 🧪 測試 1: 驗證模型清單
    print("\n[Test 1] 正在檢查可用的模型名稱...")
    try:
        available_models = [m.name for m in client.models.list()]
        print(f"找到 {len(available_models)} 個模型")
    except Exception as e:
        print(f"❌ 無法列出模型: {e}")

    # 🧪 測試 2: 模擬 Chat 模式
    print("\n[Test 2] 模擬 Chat 模式 (aio.chats.create)...")
    try:
        model_to_test = DAILY_ROUTING[0]
        # 🆕 v21 Signature: (config, model_name, intent_type)
        config = sanitize_config_for_model(get_generation_config("CHAT"), model_to_test, "CHAT")
        
        chat = client.aio.chats.create(
            model=model_to_test,
            history=[],
            config=config,
        )
        start_time = time.time()
        response = await chat.send_message("你好，請跟我打聲招呼")
        print(f"✅ Chat 成功! 模型: {model_to_test}, 耗時: {time.time()-start_time:.2f}s")
    except Exception as e:
        print(f"❌ Chat 失敗! 模型: {DAILY_ROUTING[0]}, 錯誤: {e}")

    # 🧪 測試 3: 模擬 Extraction 模式 (PLANNING)
    print("\n[Test 3] 模擬 Extraction 模式 (PLANNING)...")
    try:
        model_to_test = HEAVY_ROUTING[0]
        config = sanitize_config_for_model(get_generation_config("PLANNING"), model_to_test, "PLANNING")
        
        start_time = time.time()
        response = await client.aio.models.generate_content(
            model=model_to_test,
            contents="請規劃一個 1 天的東京行程",
            config=config,
        )
        print(f"✅ Extraction 成功! 模型: {model_to_test}, 耗時: {time.time()-start_time:.2f}s")
    except Exception as e:
        print(f"❌ Extraction 失敗! 模型: {HEAVY_ROUTING[0]}, 錯誤: {e}")

if __name__ == "__main__":
    asyncio.run(run_audit())
