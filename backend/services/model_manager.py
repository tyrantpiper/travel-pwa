"""
Model Manager Service - Next-Gen Architecture v23.1
===================================================

Intelligent multi-tier routing with:
- Capability Registry: Chart-based enforcement (supports_schema, property_ordering)
- V23.1 Financial Nomenclature: subtotal_amount, total_amount, items
- Fail-Fast Policy: Immediate rejection of 401/403 errors
- Explicit Fallback: Seamless transition to Gemma 3 for non-strict tasks
- Async Lifecycle: Formal aclose() path for resource management
- Temperature Guard: Enforced 1.0 for Gemini 3
"""

import copy
import time
import os
import asyncio
import json
from dataclasses import dataclass
from google import genai
from google.genai import types, errors
from typing import Optional, List, Dict, Any, Union, Tuple

# --- 路由策略 (從 ai_config 導入) ---
from utils.ai_config import (
    DAILY_ROUTING,
    HEAVY_ROUTING,
    WORKHORSE_MODEL,
)


# ═══════════════════════════════════════════════════════════════
# 🧩 Capability Registry (查表執法)
# ═══════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class ModelCaps:
    supports_schema: bool
    supports_tools: bool
    supports_media_resolution: bool
    supports_thinking: bool  # 🚀 v21.2: 只有 Gemini 3.x 支援
    requires_property_ordering: bool
    allow_extraction_fallback: bool
    family: str  # "gemini" / "gemma"


MODEL_CAPS: Dict[str, ModelCaps] = {
    "gemini-3.1-flash-lite-preview": ModelCaps(
        supports_schema=True,
        supports_tools=False,      # 🛡️ 暫時禁用以防 429
        supports_media_resolution=False,
        supports_thinking=True,
        requires_property_ordering=False,
        allow_extraction_fallback=True,
        family="gemini",
    ),
    "gemini-3-flash-preview": ModelCaps(
        supports_schema=True,
        supports_tools=False,      # 🛡️ 暫時禁用以防 429
        supports_media_resolution=True,
        supports_thinking=True,
        requires_property_ordering=False,
        allow_extraction_fallback=True,
        family="gemini",
    ),
    "gemini-2.5-flash": ModelCaps(
        supports_schema=True,
        supports_tools=True,
        supports_media_resolution=False,
        supports_thinking=False,
        requires_property_ordering=False,
        allow_extraction_fallback=True,
        family="gemini",
    ),
    "gemma-3-27b-it": ModelCaps(
        supports_schema=True,
        supports_tools=True,
        supports_media_resolution=False,
        supports_thinking=False,
        requires_property_ordering=False,
        allow_extraction_fallback=False,
        family="gemma",
    ),
}

# 意圖分群
INTENTS_REQUIRING_JSON = {"EXTRACTION", "PLANNING"}
INTENTS_ALLOW_GEMMA_LAST_RESORT = {"PLANNING", "SUMMARIZE", "POI_ENRICH", "DIAGNOSIS"}


# ═══════════════════════════════════════════════════════════════
# 🔄 Client Lifecycle (以 api_key 為隔離鍵)
# ═══════════════════════════════════════════════════════════════

_client_cache: Dict[str, genai.Client] = {}


def get_cached_client(api_key: str) -> genai.Client:
    """取得或建立 genai.Client（以 api_key 為隔離鍵）"""
    client = _client_cache.get(api_key)
    if client is None:
        client = genai.Client(api_key=api_key)
        _client_cache[api_key] = client
    return client


async def close_all_cached_clients() -> None:
    """正式回收所有非同步連線資源 (v21 核心)"""
    clients = list(_client_cache.values())
    _client_cache.clear()
    if clients:
        print(f"🧹 Closing {len(clients)} AI clients...")
        # 並發關閉，忽略已失效連線的報錯
        await asyncio.gather(*(c.aio.aclose() for c in clients), return_exceptions=True)
        print("✅ AI Clients shutdown complete")





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


# ═══════════════════════════════════════════════════════════════
# 🏭 Config Factory (主線化 JSON Schema)
# ═══════════════════════════════════════════════════════════════

def build_json_schema_for_intent(intent_type: str) -> Optional[Dict[str, Any]]:
    """意圖對應的結構化定義"""
    if intent_type == "EXTRACTION":
        return {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "date": {"type": "string"},
                "currency": {"type": "string"},
                "subtotal_amount": {"type": "number"},
                "tax_amount": {"type": "number"},
                "tip_amount": {"type": "number"},
                "service_charge_amount": {"type": "number"},
                "discount_amount": {"type": "number"},
                "total_amount": {"type": "number"},
                "category": {"type": "string"},
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "original_name": {"type": "string"},
                            "translated_name": {"type": "string"},
                            "amount": {"type": "number"}
                        },
                        "required": ["original_name", "amount"]
                    }
                }
            },
            "required": ["title", "date", "currency", "total_amount", "items"]
        }
    if intent_type == "PLANNING":
        # 行程生成專用 Schema (Synced with v27.1 Prompt)
        return {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "start_date": {"type": "string", "description": "ISO date string (YYYY-MM-DD)"},
                "end_date": {"type": "string", "description": "ISO date string (YYYY-MM-DD)"},
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "day_number": {"type": "integer"},
                            "time_slot": {"type": "string"},
                            "place_name": {"type": "string"},
                            "category": {"type": "string"},
                            "desc": {"type": "string"},
                            "lat": {"type": "number"},
                            "lng": {"type": "number"},
                            "tags": {"type": "array", "items": {"type": "string"}},
                            "is_highlight": {"type": "boolean"},
                            "sub_items": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "checked": {"type": "boolean"},
                                        "desc": {"type": "string"},
                                        "link": {"type": "string", "description": "Optional URL for this sub-item"}
                                    },
                                    "required": ["name"]
                                }
                            },
                            "link_url": {"type": "string", "description": "URL link (e.g. Google Maps)"}
                        },
                        "required": ["day_number", "place_name", "category"],
                    },
                },
                "ai_review": {"type": "string"},
                "day_metadata": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "day_number": {"type": "integer"},
                            "notes": {"type": "array", "items": {"type": "object", "properties": {"item": {"type": "string"}, "content": {"type": "string"}}}},
                            "costs": {"type": "array", "items": {"type": "object", "properties": {"item": {"type": "string"}, "amount": {"type": "string"}}}},
                            "tickets": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "price": {"type": "string"}}}}
                        },
                        "required": ["day_number"]
                    }
                }
            },
            "required": ["items"],
        }
    return None


def get_generation_config(intent_type: str) -> types.GenerateContentConfig:
    """Config 工廠 — 根據意圖類型生成對應配置"""
    base_configs = {
        "PLANNING": types.GenerateContentConfig(
            temperature=1.0,
            max_output_tokens=8192,  # 🚀 Maximize for 14-day+ itineraries
            media_resolution="media_resolution_high",
            response_mime_type="application/json",
            response_schema=build_json_schema_for_intent("PLANNING")
        ),
        "VERIFY": types.GenerateContentConfig(
            temperature=1.0,
            max_output_tokens=1024,
            media_resolution="media_resolution_high",
        ),
        "DIAGNOSIS": types.GenerateContentConfig(
            temperature=1.0,
            max_output_tokens=8192,  # 🚀 Maximize for deep analysis
            media_resolution="media_resolution_high",
        ),
        "EXTRACTION": types.GenerateContentConfig(
            temperature=1.0,
            max_output_tokens=8192,  # 🚀 Maximize for large receipt/text imports
            response_mime_type="application/json",
            response_schema=build_json_schema_for_intent("EXTRACTION")
        ),
        "SUMMARIZE": types.GenerateContentConfig(
            temperature=1.0,
            max_output_tokens=1024,
        ),
        "GEOCODE": types.GenerateContentConfig(
            temperature=0,
            max_output_tokens=150,
        ),
    }

    config = base_configs.get(intent_type, types.GenerateContentConfig(temperature=1.0, max_output_tokens=1024))

    # 🚀 主線化 Structured Output
    if intent_type in INTENTS_REQUIRING_JSON and intent_type != "CHAT":
        schema = build_json_schema_for_intent(intent_type)
        if schema:
            config.response_mime_type = "application/json"
            config.response_json_schema = schema

    return config


# ═══════════════════════════════════════════════════════════════
# 🛡️ Core: Sanitizer (查表執行配置淨化)
# ═══════════════════════════════════════════════════════════════

def sanitize_config_for_model(
    config: types.GenerateContentConfig,
    model_name: str,
    intent_type: str,
) -> types.GenerateContentConfig:
    """根據模型能力表 (MODEL_CAPS) 淨化配置"""
    safe = copy.deepcopy(config)
    caps = MODEL_CAPS.get(model_name)
    if not caps:
        return safe

    # 1. 移除不支援的工具
    if hasattr(safe, 'tools') and not caps.supports_tools:
        safe.tools = None

    # 2. 移除不支援的解析度
    if hasattr(safe, 'media_resolution') and not caps.supports_media_resolution:
        safe.media_resolution = None

    # 3. 思想配置限制 (v21.2: 查表確定是否支援 thinking)
    if hasattr(safe, 'thinking_config') and not caps.supports_thinking:
        safe.thinking_config = None

    # 4. Gemini 3 溫度限制
    if caps.family == "gemini" and model_name.startswith("gemini-3"):
        if hasattr(safe, 'temperature') and safe.temperature is not None:
            if safe.temperature < 1.0:
                safe.temperature = 1.0

    # 5. Schema 降級與隱式修正 (關鍵核心)
    require_json = intent_type in INTENTS_REQUIRING_JSON
    if require_json:
        if not caps.supports_schema:
            # 模型不支援 Schema，將 MIME 設回 text 並移除 schema
            safe.response_mime_type = None
            safe.response_json_schema = None
        elif caps.requires_property_ordering and safe.response_json_schema:
            # 對於需要 propertyOrdering 的模型 (如 Gemini 2.0)，執行注入
            safe.response_json_schema = inject_property_ordering(safe.response_json_schema)

    return safe


def inject_property_ordering(schema: Dict[str, Any]) -> Dict[str, Any]:
    """遞歸注入 propertyOrdering 以確保 Schema 嚴格相容性 (v21)"""
    out = copy.deepcopy(schema)

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            props = node.get("properties")
            if isinstance(props, dict) and "propertyOrdering" not in node:
                node["propertyOrdering"] = list(props.keys())
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(out)
    return out


# ═══════════════════════════════════════════════════════════════
# ═══════════════════════════════════════════════════════════════
# 🚦 Routing Hub & Error Classifier (法典級)
# ═══════════════════════════════════════════════════════════════

class AIProtocolError(Exception):
    """AI 協議層異常基類"""
    pass

class NonRetryableAuthError(AIProtocolError):
    """401/403 認證失敗，立即終止 Fallback"""
    pass

class NonRetryableRequestError(AIProtocolError):
    """400 壞請求（非 Config 問題），立即終止"""
    pass

class AllModelsFailedError(AIProtocolError):
    """所有 Fallback 路徑均告失敗"""
    def __init__(self, attempts: List[Dict]):
        self.attempts = attempts
        super().__init__(f"All candidate models failed. Trace: {attempts}")


def classify_api_error(err: errors.APIError) -> str:
    """法典化錯誤分類規範"""
    code = getattr(err, "code", None)
    msg = (getattr(err, "message", "") or "").lower()

    if code in (401, 403):
        return "auth_fail"
    if code in (429, 500, 502, 503, 504):
        return "retryable"
    if code == 400:
        # 偵測是否為「參數不相容」導致的 400
        schemaish = any(k in msg for k in [
            "response_json_schema", "response_schema", "response schema", "response_mime_type",
            "invalid argument", "unsupported", "propertyordering", "tools"
        ])
        return "config_unsupported" if schemaish else "bad_request"
    return "unknown"


def build_effective_routing(
    intent_type: str,
    routing_strategy: Optional[List[str]] = None,
) -> List[str]:
    """實體化 Gemma 備援路徑 (v21.2 修正：預設改為 HEAVY)"""
    # 對於提取/生成類任務，預設應使用穩定度較高的 HEAVY_ROUTING
    routing = list(routing_strategy or HEAVY_ROUTING)
    # 若意圖允許且尚未包含，則在末尾掛載 Gemma
    if WORKHORSE_MODEL not in routing:
        if intent_type in INTENTS_ALLOW_GEMMA_LAST_RESORT:
            routing.append(WORKHORSE_MODEL)
    return routing


async def call_with_fallback(
    api_key: str,
    history: List[Dict],
    message: str,
    thought_signatures: Optional[List[Dict]] = None,
    intent_type: str = "CHAT",
    routing_strategy: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """智能對話式呼叫 (v21 版)"""
    client = get_cached_client(api_key)
    chat_history = _build_chat_history(history)
    base_config = get_generation_config(intent_type)
    routing = build_effective_routing(intent_type, routing_strategy)
    require_json = intent_type in INTENTS_REQUIRING_JSON

    attempts = []
    
    for i, model_name in enumerate(routing):
        caps = MODEL_CAPS.get(model_name)
        if not caps: continue

        # 能力守門 (Capability Gate)
        if require_json and not caps.supports_schema:
            attempts.append({"model": model_name, "decision": "skip_no_schema"})
            continue

        try:
            config = sanitize_config_for_model(base_config, model_name, intent_type)
            label = "Primary" if i == 0 else f"Fallback#{i}"
            print(f"[{label}] {model_name} (intent={intent_type})...")

            chat = client.aio.chats.create(
                model=model_name,
                history=chat_history,
                config=config,
            )
            response = await chat.send_message(message)

            print(f"✅ {model_name} 成功回應")
            return _extract_response(response, model_name)

        except errors.APIError as e:
            kind = classify_api_error(e)
            attempts.append({"model": model_name, "decision": kind, "code": e.code})

            if kind == "auth_fail":
                raise NonRetryableAuthError(f"{model_name} Auth Failed: {e.message}")
            if kind == "bad_request":
                raise NonRetryableRequestError(f"{model_name} Bad Request: {e.message}")
            # retryable, config_unsupported, unknown -> continue
            continue
        except Exception as e:
            attempts.append({"model": model_name, "decision": "unexpected", "msg": str(e)})
            continue

    raise AllModelsFailedError(attempts)


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
            config = sanitize_config_for_model(base_config, model_name, "VERIFY")
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
# 🤖 call_extraction — 統一調度核心 (v21)
# ═══════════════════════════════════════════════════════════════

async def call_extraction(
    api_key: str,
    prompt: Union[str, List[Any]],
    intent_type: str = "CHAT",
    routing_strategy: Optional[List[str]] = None,
) -> str:
    """
    統一的 AI 提取/生成函數 (v21 版)
    
    具備 Fail-Fast, Capability Gating, 以及實體化 Gemma 備援。
    """
    client = get_cached_client(api_key)
    base_config = get_generation_config(intent_type)
    routing = build_effective_routing(intent_type, routing_strategy)
    require_json = intent_type in INTENTS_REQUIRING_JSON

    attempts = []

    for i, model_name in enumerate(routing):
        caps = MODEL_CAPS.get(model_name)
        if not caps: continue

        # 能力與任務匹配
        if require_json and not caps.supports_schema:
            attempts.append({"model": model_name, "decision": "skip_no_schema"})
            continue
        
        # Gemma 准入檢查 (v21.2 精確分類)
        if model_name == WORKHORSE_MODEL:
            # 對於 EXTRACTION (收據圖片解析)，目前仍嚴格禁止 fallback
            # 但對於 PLANNING (行程生成)，Gemma 3 具備處理結構化數據的能力，允許作為末位備援
            if intent_type == "EXTRACTION" and not caps.allow_extraction_fallback:
                attempts.append({"model": model_name, "decision": "skip_strict_extraction_prevention"})
                continue
            
            # 對於其餘任務，遵循 INTENTS_ALLOW_GEMMA_LAST_RESORT 白名單
            if intent_type not in INTENTS_ALLOW_GEMMA_LAST_RESORT:
                attempts.append({"model": model_name, "decision": "skip_intent_not_allowed_for_gemma"})
                continue

        try:
            config = sanitize_config_for_model(base_config, model_name, intent_type)
            label = "Primary" if i == 0 else f"Fallback#{i}"
            print(f"[{label}] {model_name} (intent={intent_type})...")

            response = await client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )

            text = response.text or ""
            if require_json:
                text = _clean_json_text(text)
                # 確保 JSON 可解析
                json.loads(text)

            print(f"✅ {model_name} 成功回應")
            return text

        except errors.APIError as e:
            kind = classify_api_error(e)
            attempts.append({"model": model_name, "decision": kind, "code": e.code})

            if kind == "auth_fail":
                raise NonRetryableAuthError(f"Auth Failed: {e.message}")
            if kind == "bad_request":
                raise NonRetryableRequestError(f"Bad Request: {e.message}")
            continue

        except json.JSONDecodeError as e:
            attempts.append({"model": model_name, "decision": "json_parse_fail"})
            continue
        except Exception as e:
            attempts.append({"model": model_name, "decision": "exception", "msg": str(e)})
            continue

    raise AllModelsFailedError(attempts)


def _clean_json_text(text: str) -> str:
    """清理 Markdown 標籤"""
    if not text: return ""
    return text.replace("```json", "").replace("```", "").strip()


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
