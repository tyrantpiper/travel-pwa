"""
AI Configuration Constants (Next-Gen Architecture v5.0)
-------------------------------------------------------
Centralized AI model configuration with intelligent multi-tier routing.

Routing Strategies:
- DAILY_ROUTING:  日常對話、意圖解析、記憶萃取、POI 推薦、驗證
  → 首選 gemini-3.1-flash-lite (500 RPD) → gemini-3-flash → gemini-2.5-flash
- HEAVY_ROUTING:  行程生成、Markdown 重構、深度規劃
  → 首選 gemini-3-flash (20 RPD) → gemini-3.1-flash-lite → gemini-2.5-flash
- WORKHORSE_MODEL: 地理引擎（翻譯、國家判斷）
  → gemma-3-27b-it (14,400 RPD, 零成本)

Reference:
  https://ai.google.dev/gemini-api/docs/models?hl=zh-tw
"""

from typing import List

# ═══════════════════════════════════════════════════════════════
# 🧭 Routing Strategies (Ordered: Primary → Fallback 1 → Fallback 2)
# ═══════════════════════════════════════════════════════════════

DAILY_ROUTING: List[str] = [
    "gemini-3.1-flash-lite-preview",  # 500 RPD, 極速、支援思考/搜尋/結構化
    "gemini-3-flash-preview",          # 20 RPD, 全能型
    "gemini-2.5-flash",                # 20 RPD, 穩定版兜底
]

HEAVY_ROUTING: List[str] = [
    "gemini-3.1-flash-lite-preview",   # 500 RPD, 高額度優先 (解決部分金鑰 400 錯誤)
    "gemini-3-flash-preview",          # 20 RPD, 次選
    "gemini-2.5-flash",                # 穩定版兜底
]

# ═══════════════════════════════════════════════════════════════
# 🐴 Workhorse Model (Gemma 系列, 14,400 RPD, 零成本)
# ═══════════════════════════════════════════════════════════════

WORKHORSE_MODEL: str = "gemma-3-27b-it"

# ═══════════════════════════════════════════════════════════════
# 🔗 Backward-Compatible Aliases (Phase 3 清除後可移除)
# ═══════════════════════════════════════════════════════════════

PRIMARY_MODEL = DAILY_ROUTING[0]
CREATIVE_MODEL = HEAVY_ROUTING[0]
SEARCH_MODEL = DAILY_ROUTING[2]        # gemini-2.5-flash
LITE_MODEL = DAILY_ROUTING[0]           # 升級：原 2.5-flash-lite → 3.1-flash-lite
SMART_NO_TOOL_MODEL = DAILY_ROUTING[0]
REASONING_MODEL = WORKHORSE_MODEL
FALLBACK_MODEL = WORKHORSE_MODEL
