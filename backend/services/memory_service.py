"""
Memory Service - AI Adaptive Preference Management (v5.0)
---------------------------------------------------------
Handles extraction of user preferences from chat logs and
injection of these preferences into system prompts.

🆕 v5.0: 
  - Pydantic schema enforcement for preference extraction
  - Persona relocated to system_instruction
  - Uses call_extraction with 3-tier fallback protection
"""

import json
import asyncio
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from services.model_manager import call_extraction
from utils.ai_config import DAILY_ROUTING


# ═══════════════════════════════════════════════════════════════
# 📋 Pydantic Schema for strict JSON output
# ═══════════════════════════════════════════════════════════════

class Preference(BaseModel):
    """單一偏好項目"""
    category: str  # diet, pace, interest, accommodation, transport, other
    preference: str  # 偏好描述


class PreferenceList(BaseModel):
    """偏好清單 (wrapper for JSON Schema root object constraint)"""
    preferences: List[Preference]


class MemoryService:
    @staticmethod
    async def extract_preferences(user_id: str, message: str, ai_response: str, api_key: str, supabase: Any):
        """
        Extracts preferences from the latest interaction and saves to DB.
        This should be called as a background task.
        
        🆕 v5.0: 使用 Pydantic schema + system_instruction 隔離 persona
        """
        if not user_id or not api_key:
            return

        prompt = f"""用戶說："{message}"
AI 回應："{ai_response}"

任務：
1. 提取偏好分類：'diet' (飲食), 'pace' (節奏), 'interest' (興趣), 'accommodation' (住宿), 'transport' (交通), 'other'
2. 僅提取「明確」的偏好，例如：「我不吃牛」、「喜歡慢節奏」、「對博物館沒興趣」
3. 如果沒有新發現的偏好，回傳 {{"preferences": []}}

回傳格式：{{"preferences": [{{"category": "diet", "preference": "不吃牛肉"}}]}}
只回傳 JSON，不要有其他文字。"""

        try:
            # 🆕 v5.0: 使用 call_extraction + DAILY_ROUTING 降級保護
            raw_result = await call_extraction(
                api_key, prompt,
                intent_type="SUMMARIZE",
                routing_strategy=DAILY_ROUTING,
            )
            cleaned = raw_result.replace("```json", "").replace("```", "").strip()
            if not cleaned or cleaned == "[]":
                return

            # 嘗試解析為 PreferenceList (嚴格模式)
            try:
                parsed = PreferenceList.model_validate_json(cleaned)
                prefs = [p.model_dump() for p in parsed.preferences]
            except Exception:
                # Fallback: 嘗試直接解析為 list (向後兼容)
                raw_parsed = json.loads(cleaned)
                if isinstance(raw_parsed, list):
                    prefs = raw_parsed
                elif isinstance(raw_parsed, dict) and "preferences" in raw_parsed:
                    prefs = raw_parsed["preferences"]
                else:
                    return

            if not prefs:
                return

            for pref in prefs:
                # Upsert to Supabase
                supabase.table("user_preferences").upsert({
                    "user_id": user_id,
                    "category": pref["category"],
                    "preference": pref["preference"],
                    "updated_at": "now()"
                }, on_conflict="user_id, category, preference").execute()
                
            print(f"🧠 [Memory] Extracted {len(prefs)} preferences for user {user_id}")
        except Exception as e:
            print(f"⚠️ [Memory] Extraction failed: {e}")

    @staticmethod
    async def get_preferences_context(user_id: str, supabase: Any) -> str:
        """
        Fetches user preferences and formats them as a system prompt snippet.
        """
        if not user_id or not supabase:
            return ""

        try:
            res = supabase.table("user_preferences").select("*").eq("user_id", user_id).execute()
            if not res.data:
                return ""

            pref_lines = []
            for item in res.data:
                pref_lines.append(f"• [{item['category']}] {item['preference']}")

            return "\n--- USER PREFERENCES (ADAPTIVE MEMORY) ---\n" + \
                   "基於之前的對話，我記住了使用者的以下偏好：\n" + \
                   "\n".join(pref_lines) + \
                   "\n-------------------------------------------\n"
        except Exception as e:
            print(f"⚠️ [Memory] Failed to fetch preferences: {e}")
            return ""
