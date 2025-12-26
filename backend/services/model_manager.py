"""
Model Manager Service - Intelligent Hybrid Architecture v3.5

使用新版 google-genai SDK (1.56.0+)
Gemini 3 Flash Preview 優先策略 + 自動降級機制
支援 GenerateContentConfig 完整配置

🆕 v3.5: 新增 DIAGNOSIS 和 EXTRACTION 意圖
"""

from google import genai
from google.genai import types
from typing import Optional, List, Dict, Any

# --- 模型常數 ---
GEMINI_3_FLASH = "gemini-3-flash-preview"  # Primary (免費脈絡快取)
GEMINI_25_PRO = "gemini-2.5-pro"            # Fallback (複雜推理)
GEMINI_25_FLASH = "gemini-2.5-flash"        # Verifier (快速驗證)

# --- 🆕 v3.5: 診斷意圖偵測 ---
DIAGNOSIS_KEYWORDS = [
    "行程建議", "好不好", "順不順", "會不會太趕", "來得及嗎",
    "這樣排", "幫我看", "診斷", "健檢", "評估", "分析這個行程",
    "路線順嗎", "時間夠嗎", "會太累嗎", "能遍完嗎",
    "有什麼建議", "要調整嗎", "怎麼樣"
]

def detect_diagnosis_intent(message: str) -> bool:
    """
    偵測是否為行程診斷請求
    
    Args:
        message: 用戶訊息
    
    Returns:
        bool: 是否為診斷意圖
    """
    message_lower = message.lower()
    return any(kw in message_lower for kw in DIAGNOSIS_KEYWORDS)


def get_generation_config(intent_type: str) -> types.GenerateContentConfig:
    """
    配置工廠函數 - 根據意圖類型生成對應 Config
    
    Args:
        intent_type: 意圖類型 (PLANNING, VERIFY, CHAT, DIAGNOSIS, EXTRACTION)
    
    Returns:
        GenerateContentConfig with appropriate settings
    """
    if intent_type == "PLANNING":
        # 規劃模式：更詳細的回應
        return types.GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=2048,
        )
    elif intent_type == "VERIFY":
        # 驗證模式：更精確
        return types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=1024,
        )
    elif intent_type == "DIAGNOSIS":
        # 🆕 v3.5: 診斷模式：深度推理，長輸出
        return types.GenerateContentConfig(
            temperature=0.4,
            max_output_tokens=4096,
        )
    elif intent_type == "EXTRACTION":
        # 🆕 v3.5: 提取模式：Parser 用，需要精確
        return types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=8192,
        )
    elif intent_type == "SUMMARIZE":
        # 🆕 v3.6: 記憶摘要模式：精準提取，短輸出，省 Token
        return types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=500,
        )
    elif intent_type == "POI_ENRICH":
        # 🆕 v4.0: POI 增強模式：快速摘要，JSON 輸出
        return types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=1024,
        )
    else:
        # 一般聊天
        return types.GenerateContentConfig(
            temperature=0.9,
            max_output_tokens=1024,
        )


async def call_with_fallback(
    api_key: str,
    history: List[Dict],
    message: str,
    thought_signatures: Optional[List[Dict]] = None,
    intent_type: str = "PLANNING"
) -> Dict[str, Any]:
    """
    智能調用函數 - Gemini 3 優先，自動降級到 2.5 Pro
    
    Args:
        api_key: Gemini API Key (BYOK)
        history: 對話歷史
        message: 當前訊息
        thought_signatures: 上一輪的思想簽名
        intent_type: 意圖類型
    
    Returns:
        {
            "text": str,
            "raw_parts": list,
            "model_used": str,
            "grounding_metadata": dict
        }
    """
    # 🆕 使用新版 Client API (BYOK)
    client = genai.Client(api_key=api_key)
    
    # 建構對話歷史
    chat_history = _build_chat_history(history)
    
    # 取得配置
    config = get_generation_config(intent_type)
    
    # 嘗試 Primary Model (Gemini 3 Flash Preview)
    primary_model = GEMINI_3_FLASH
    try:
        print(f"🧠 嘗試使用 {primary_model} (intent={intent_type})...")
        
        # 使用 chats.create() 建立對話
        chat = client.chats.create(
            model=primary_model,
            history=chat_history,
            config=config
        )
        response = chat.send_message(message)
        
        print(f"✅ {primary_model} 成功回應")
        return _extract_response(response, primary_model)
        
    except Exception as e:
        error_msg = str(e).lower()
        
        # 檢查是否為額度或服務相關錯誤
        if "quota" in error_msg or "429" in error_msg or "503" in error_msg or "resource" in error_msg:
            print(f"⚠️ {primary_model} 額度耗盡或服務不可用: {e}")
        else:
            print(f"⚠️ {primary_model} 錯誤 (可能模型不存在或其他): {e}")
        
        print(f"🔄 自動降級至 {GEMINI_25_PRO}...")
        
        # Fallback to Gemini 2.5 Pro
        try:
            fallback_model = GEMINI_25_PRO
            chat = client.chats.create(
                model=fallback_model,
                history=chat_history,
                config=config
            )
            response = chat.send_message(message)
            
            print(f"✅ {fallback_model} 降級成功")
            return _extract_response(response, fallback_model)
            
        except Exception as fallback_error:
            print(f"❌ 降級也失敗: {fallback_error}")
            raise fallback_error


async def call_verifier(
    api_key: str,
    poi_data: Dict,
    query: str
) -> Dict[str, Any]:
    """
    Verifier 階段 - 驗證 POI 資訊
    """
    client = genai.Client(api_key=api_key)
    
    verifier_model = GEMINI_25_FLASH
    config = get_generation_config("VERIFY")
    
    prompt = f"""
    請驗證以下地點的資訊：
    地點：{poi_data.get('place_name', '未知')}
    
    需要確認：{query}
    
    請根據你的知識回答，如果不確定請說明。
    """
    
    response = client.models.generate_content(
        model=verifier_model,
        contents=prompt,
        config=config
    )
    
    return {
        "verified_data": response.text,
        "grounding_metadata": None
    }


# 🆕 v3.5: 統一的提取/生成函數 (替代 call_ai_parser)
async def call_extraction(
    api_key: str,
    prompt: str,
    intent_type: str = "EXTRACTION"
) -> str:
    """
    統一的 AI 調用函數，用於 Parser 和 Planner
    
    Args:
        api_key: Gemini API Key (BYOK)
        prompt: 完整的提示詞
        intent_type: 意圖類型 ("EXTRACTION" 或 "PLANNING")
    
    Returns:
        str: AI 生成的文本
    """
    client = genai.Client(api_key=api_key)
    config = get_generation_config(intent_type)
    
    primary_model = GEMINI_3_FLASH
    
    try:
        print(f"🤖 [Extraction] 嘗試 {primary_model} (intent={intent_type})...")
        response = client.models.generate_content(
            model=primary_model,
            contents=prompt,
            config=config
        )
        print(f"✅ {primary_model} 成功回應")
        return response.text
        
    except Exception as e:
        print(f"⚠️ {primary_model} 失敗: {e}")
        
        # Fallback to Gemini 2.5 Pro
        try:
            fallback_model = GEMINI_25_PRO
            print(f"🔄 降級至 {fallback_model}...")
            response = client.models.generate_content(
                model=fallback_model,
                contents=prompt,
                config=config
            )
            print(f"✅ {fallback_model} 降級成功")
            return response.text
            
        except Exception as e2:
            print(f"⚠️ {fallback_model} 也失敗: {e2}")
            
            # 最後嘗試 Flash
            last_model = GEMINI_25_FLASH
            print(f"🔄 最後嘗試 {last_model}...")
            response = client.models.generate_content(
                model=last_model,
                contents=prompt,
                config=config
            )
            print(f"✅ {last_model} 成功")
            return response.text


def _build_chat_history(history: List[Dict]) -> List[types.Content]:
    """
    建構對話歷史 - 轉換為新 SDK 格式
    """
    chat_history = []
    
    for msg in history:
        role = "user" if msg.get("role") == "user" else "model"
        
        # 提取文字內容
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
    """
    從 Response 中提取完整資訊
    """
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
        "grounding_metadata": _extract_grounding_metadata(response)
    }


def _serialize_part(part) -> Dict:
    """
    序列化 Part 物件
    """
    serialized = {}
    
    if hasattr(part, 'text') and part.text:
        serialized["text"] = part.text
    
    if hasattr(part, 'function_call') and part.function_call:
        serialized["function_call"] = {
            "name": part.function_call.name,
            "args": dict(part.function_call.args) if part.function_call.args else {}
        }
    
    # 思想簽名 (如果存在)
    if hasattr(part, 'thought') and part.thought:
        serialized["thought"] = part.thought
    
    return serialized


def _extract_grounding_metadata(response) -> Optional[Dict]:
    """
    提取 Grounding Metadata
    """
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
