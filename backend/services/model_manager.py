"""
Model Manager Service - Next-Gen Architecture v5.0
===================================================

Intelligent multi-tier routing with:
- Dynamic config sanitization for cross-generation model compatibility
- Precise error handling via google.genai.errors.APIError
- Temperature guard for Gemini 3 (must stay at 1.0)
- Shared retry loop for both chat-style and extraction-style calls

Uses google-genai SDK (1.56.0+)
"""

import copy
import time
import os
from google import genai
from google.genai import types, errors
from typing import Optional, List, Dict, Any

# --- 路由策略 (從 ai_config 導入) ---
from utils.ai_config import (
    DAILY_ROUTING,
    HEAVY_ROUTING,
    WORKHORSE_MODEL,
)


# ═══════════════════════════════════════════════════════════════
# 🔄 Client 快取（以 api_key 為隔離鍵，TTL 5 分鐘）
# ═══════════════════════════════════════════════════════════════

_client_cache: dict[int, tuple[genai.Client, float]] = {}
_CLIENT_TTL = 300  # 5 分鐘


def get_cached_client(api_key: str) -> genai.Client:
    """取得或建立 genai.Client（帶 TTL 快取，以 api_key hash 為隔離鍵）"""
    now = time.time()
    cache_key = hash(api_key)
    if cache_key in _client_cache:
        client, created_at = _client_cache[cache_key]
        if now - created_at < _CLIENT_TTL:
            return client
    client = genai.Client(api_key=api_key)
    _client_cache[cache_key] = (client, now)
    return client


# ═══════════════════════════════════════════════════════════════
# 🛡️ Core: Config Sanitizer (防止跨世代模型參數衝突)
# ═══════════════════════════════════════════════════════════════

def sanitize_config_for_model(
    config: types.GenerateContentConfig,
    model_name: str
) -> types.GenerateContentConfig:
    """
    防禦型 Config 淨化器 — 確保降級時不會因不支援的參數導致 400 錯誤。

    Rules:
      1. 非 Gemini 3.x 模型 → 移除 thinking_config
      2. 非 Gemini 系列 (Gemma) → 額外移除 tools (不支持 google_search)
      3. Gemini 3.x 模型 → temperature 強制 1.0 (官方建議)
    """
    safe = copy.deepcopy(config)

    is_gemini_3 = model_name.startswith("gemini-3")

    # Rule 1: Gemini 2.x 和 Gemma 不認得 thinking_config
    if not is_gemini_3:
        if hasattr(safe, 'thinking_config'):
            safe.thinking_config = None

    # Rule 2: Gemma 不支援 google_search 等工具, Gemini 3 preveiw 版由於搜尋配額限制(429 Error)，暫時禁用 tools
    if not model_name.startswith("gemini-") or is_gemini_3:
        if hasattr(safe, 'tools'):
            safe.tools = None

    # Rule 3: Gemini 3 系列 temperature 建議維持 1.0，調低會導致迴圈
    if is_gemini_3:
        if hasattr(safe, 'temperature') and safe.temperature is not None:
            if safe.temperature < 1.0:
                safe.temperature = 1.0

    return safe


# ═══════════════════════════════════════════════════════════════
# 🏭 Config Factory (根據意圖生成 GenerateContentConfig)
# ═══════════════════════════════════════════════════════════════

# --- 診斷意圖偵測關鍵字 ---
DIAGNOSIS_KEYWORDS = [
    "行程建議", "好不好", "順不順", "會不會太趕", "來得及嗎",
    "這樣排", "幫我看", "診斷", "健檢", "評估", "分析這個行程",
    "路線順嗎", "時間夠嗎", "會太累嗎", "能遍完嗎",
    "有什麼建議", "要調整嗎", "怎麼樣"
]


def detect_diagnosis_intent(message: str) -> bool:
    """偵測是否為行程診斷請求"""
    message_lower = message.lower()
    return any(kw in message_lower for kw in DIAGNOSIS_KEYWORDS)


def get_generation_config(intent_type: str) -> types.GenerateContentConfig:
    """
    Config 工廠 — 根據意圖類型生成對應配置。

    Note: temperature 設為 1.0 是 Gemini 3 的官方建議。
    淨化器會在降級到 2.5 時自動保留原值。
    """
    configs = {
        "PLANNING": types.GenerateContentConfig(
            temperature=1.0,
            max_output_tokens=2048,
            media_resolution="media_resolution_high",
        ),
        "VERIFY": types.GenerateContentConfig(
            temperature=1.0,
            max_output_tokens=1024,
            media_resolution="media_resolution_high",
        ),
        "DIAGNOSIS": types.GenerateContentConfig(
            temperature=1.0,
            max_output_tokens=4096,
            media_resolution="media_resolution_high",
        ),
        "EXTRACTION": types.GenerateContentConfig(
            temperature=1.0,
            max_output_tokens=8192,
        ),
        "SUMMARIZE": types.GenerateContentConfig(
            temperature=1.0,
            max_output_tokens=500,
        ),
        "POI_ENRICH": types.GenerateContentConfig(
            temperature=1.0,
            max_output_tokens=1024,
        ),
        "GEOCODE": types.GenerateContentConfig(
            temperature=0,
            max_output_tokens=150,
        ),
    }
    return configs.get(intent_type, types.GenerateContentConfig(
        temperature=1.0,
        max_output_tokens=1024,
        media_resolution="media_resolution_high",
    ))


# ═══════════════════════════════════════════════════════════════
# 🧠 call_with_fallback — 對話式 AI 呼叫 (chat history)
# ═══════════════════════════════════════════════════════════════

async def call_with_fallback(
    api_key: str,
    history: List[Dict],
    message: str,
    thought_signatures: Optional[List[Dict]] = None,
    intent_type: str = "PLANNING",
    routing_strategy: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    智能對話式呼叫 — 依照路由陣列自動降級。

    Args:
        api_key: Gemini API Key (BYOK)
        history: 對話歷史
        message: 當前訊息
        thought_signatures: 上一輪的思想簽名
        intent_type: 意圖類型
        routing_strategy: 覆寫路由策略（預設 DAILY_ROUTING）

    Returns:
        {"text": str, "raw_parts": list, "model_used": str, "grounding_metadata": dict}
    """
    client = get_cached_client(api_key)
    chat_history = _build_chat_history(history)
    base_config = get_generation_config(intent_type)
    routing = routing_strategy or DAILY_ROUTING

    last_error = None

    for i, model_name in enumerate(routing):
        try:
            config = sanitize_config_for_model(base_config, model_name)
            label = "🧠 Primary" if i == 0 else f"🔄 Fallback #{i}"
            print(f"{label}: {model_name} (intent={intent_type})...")

            chat = client.aio.chats.create(
                model=model_name,
                history=chat_history,
                config=config,
            )
            response = await chat.send_message(message)

            print(f"✅ {model_name} 成功回應")
            return _extract_response(response, model_name)

        except errors.APIError as e:
            last_error = e
            if e.code in (429, 503):
                print(f"⚠️ {model_name} 額度耗盡或服務不可用 (HTTP {e.code})")
            elif e.code == 400:
                print(f"⚠️ {model_name} 參數不支援 (HTTP 400): {e.message}")
            else:
                print(f"⚠️ {model_name} API 錯誤 (HTTP {e.code}): {e.message}")
        except Exception as e:
            last_error = e
            print(f"⚠️ {model_name} 未預期錯誤: {e}")

    # 所有路由都失敗
    print(f"❌ 所有模型均不可用，最後錯誤: {last_error}")
    raise last_error


# ═══════════════════════════════════════════════════════════════
# 🔍 call_verifier — POI 驗證
# ═══════════════════════════════════════════════════════════════

async def call_verifier(
    api_key: str,
    poi_data: Dict,
    query: str,
    routing_strategy: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Verifier — 驗證 POI 資訊，自動降級。
    """
    client = get_cached_client(api_key)
    base_config = get_generation_config("VERIFY")
    routing = routing_strategy or DAILY_ROUTING

    prompt = f"""請驗證以下地點的資訊：
地點：{poi_data.get('place_name', '未知')}

需要確認：{query}

請根據你的知識回答，如果不確定請說明。"""

    last_error = None

    for i, model_name in enumerate(routing):
        try:
            config = sanitize_config_for_model(base_config, model_name)
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            return {
                "verified_data": response.text,
                "grounding_metadata": _extract_grounding_metadata(response),
            }
        except errors.APIError as e:
            last_error = e
            print(f"⚠️ [Verifier] {model_name} 失敗 (HTTP {e.code})")
        except Exception as e:
            last_error = e
            print(f"⚠️ [Verifier] {model_name} 未預期錯誤: {e}")

    print(f"❌ [Verifier] 所有模型均不可用")
    raise last_error


# ═══════════════════════════════════════════════════════════════
# 🤖 call_extraction — 單次式 AI 呼叫 (Parser / Planner)
# ═══════════════════════════════════════════════════════════════

async def call_extraction(
    api_key: str,
    prompt: str,
    intent_type: str = "EXTRACTION",
    routing_strategy: Optional[List[str]] = None,
) -> str:
    """
    統一的 AI 提取/生成函數 — 依照路由陣列自動降級。

    Args:
        api_key: Gemini API Key (BYOK)
        prompt: 完整的提示詞
        intent_type: 意圖類型 ("EXTRACTION" / "PLANNING" / "SUMMARIZE" / "DIAGNOSIS")
        routing_strategy: 覆寫路由策略（預設 HEAVY_ROUTING）

    Returns:
        str: AI 生成的文本
    """
    client = get_cached_client(api_key)
    base_config = get_generation_config(intent_type)
    routing = routing_strategy or HEAVY_ROUTING

    last_error = None

    for i, model_name in enumerate(routing):
        try:
            config = sanitize_config_for_model(base_config, model_name)
            label = "🤖 Primary" if i == 0 else f"🔄 Fallback #{i}"
            print(f"{label} [Extraction]: {model_name} (intent={intent_type})...")

            response = await client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            print(f"✅ {model_name} 成功回應")
            return response.text

        except errors.APIError as e:
            last_error = e
            if e.code in (429, 503):
                print(f"⚠️ {model_name} 額度耗盡 (HTTP {e.code})")
            elif e.code == 400:
                print(f"⚠️ {model_name} 參數不支援 (HTTP 400): {e.message}")
            else:
                print(f"⚠️ {model_name} 失敗 (HTTP {e.code}): {e.message}")
        except Exception as e:
            last_error = e
            print(f"⚠️ {model_name} 未預期錯誤: {e}")

    print(f"❌ [Extraction] 所有模型均不可用")
    raise last_error


async def call_extraction_server(
    prompt: str,
    intent_type: str = "GEOCODE",
    routing_strategy: Optional[List[str]] = None,
) -> str:
    """Server-side key 版本的 call_extraction（給 geocode_service 等使用）"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY 環境變數未設定")
    return await call_extraction(api_key, prompt, intent_type, routing_strategy)


# ═══════════════════════════════════════════════════════════════
# 🔧 Internal Helpers
# ═══════════════════════════════════════════════════════════════

def _build_chat_history(history: List[Dict]) -> List[types.Content]:
    """建構對話歷史 — 轉換為新 SDK 格式"""
    chat_history = []

    for msg in history:
        role = "user" if msg.get("role") == "user" else "model"

        # 提取文字內容 (多源兼容)
        text_content = ""
        if "rawParts" in msg and msg["rawParts"]:
            for part in msg["rawParts"]:
                if isinstance(part, dict) and "text" in part:
                    text_content += part["text"]
        elif "parts" in msg and msg["parts"]:
            for part in msg["parts"]:
                if isinstance(part, dict) and "text" in part:
                    text_content += part["text"]
                elif isinstance(part, str):
                    text_content += part
        else:
            text_content = msg.get("content") or msg.get("displayContent") or ""

        if text_content:
            chat_history.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=text_content)]
            ))

    return chat_history


def _extract_response(response, model_used: str) -> Dict[str, Any]:
    """從 Response 中提取完整資訊"""
    text = response.text if hasattr(response, 'text') else ""
    raw_parts = []

    if hasattr(response, 'candidates') and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, 'content') and candidate.content:
            for part in candidate.content.parts:
                raw_parts.append(_serialize_part(part))

    if not raw_parts:
        raw_parts = [{"text": text}]

    return {
        "text": text,
        "raw_parts": raw_parts,
        "model_used": model_used,
        "grounding_metadata": _extract_grounding_metadata(response),
    }


def _serialize_part(part) -> Dict:
    """序列化 Part 物件"""
    serialized = {}

    if hasattr(part, 'text') and part.text:
        serialized["text"] = part.text

    if hasattr(part, 'function_call') and part.function_call:
        serialized["function_call"] = {
            "name": part.function_call.name,
            "args": dict(part.function_call.args) if part.function_call.args else {}
        }

    # 思想簽名 (Thought Signatures)
    if hasattr(part, 'thought') and part.thought:
        serialized["thought"] = part.thought

    return serialized


def _extract_grounding_metadata(response) -> Optional[Dict]:
    """提取 Grounding Metadata（Google Search 來源引文）"""
    if not hasattr(response, 'candidates') or not response.candidates:
        return None

    candidate = response.candidates[0]

    if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
        gm = candidate.grounding_metadata
        sources = []

        if hasattr(gm, 'grounding_chunks'):
            for chunk in gm.grounding_chunks:
                if hasattr(chunk, 'web') and chunk.web:
                    sources.append({
                        "title": chunk.web.title if hasattr(chunk.web, 'title') else "Unknown",
                        "uri": chunk.web.uri if hasattr(chunk.web, 'uri') else ""
                    })

        return {"sources": sources} if sources else None

    return None
