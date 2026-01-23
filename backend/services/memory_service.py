"""
Memory Service - AI Adaptive Preference Management
--------------------------------------------------
Handles extraction of user preferences from chat logs and 
injection of these preferences into system prompts.
"""

import json
import asyncio
from typing import List, Dict, Any, Optional
from services.model_manager import call_extraction
from utils.ai_config import LITE_MODEL

class MemoryService:
    @staticmethod
    async def extract_preferences(user_id: str, message: str, ai_response: str, api_key: str, supabase: Any):
        """
        Extracts preferences from the latest interaction and saves to DB.
        This should be called as a background task.
        """
        if not user_id or not api_key:
            return

        prompt = f"""
        作為旅遊心理學家，請分析以下對話，提取使用者的「長期旅遊偏好」。
        
        用戶說："{message}"
        AI 回應："{ai_response}"
        
        任務：
        1. 提取偏好分類：'diet' (飲食), 'pace' (節奏), 'interest' (興趣), 'accommodation' (住宿), 'transport' (交通), 'other'
        2. 僅提取「明確」的偏好，例如：「我不吃牛」、「喜歡慢節奏」、「對博物館沒興趣」。
        3. 如果沒有新發現的偏好，請回傳空陣列 []。
        
        回傳格式 (JSON array):
        [
            {{"category": "diet", "preference": "不吃牛肉"}},
            {{"category": "pace", "preference": "偏好慢節奏行程"}}
        ]
        
        只回傳 JSON 陣列，不要有其他文字。
        """
        
        try:
            # 使用 Lite 模型進行快速提取，節省成本
            raw_result = await call_extraction(api_key, prompt, intent_type="SUMMARIZE")
            cleaned = raw_result.replace("```json", "").replace("```", "").strip()
            if not cleaned or cleaned == "[]":
                return

            prefs = json.loads(cleaned)
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
