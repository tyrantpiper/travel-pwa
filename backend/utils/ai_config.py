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
    "gemini-3.1-flash-lite",          # 500 RPD, GA — 極速、支援思考/地圖/結構化
    "gemini-3.5-flash-lite",          # 🆕 v3.5-flash-lite: 地圖增強快速備援 (500 RPD Map Grounding)
    "gemini-3.7-flash",               # 🚀 v3.7-flash: 次世代 SOTA 推論旗艦 (64K 輸出)
    "gemini-3.6-flash",               # 具備 Grounding 的備援
    "gemini-3.5-flash",                # 頂級 Agentic 模型
    "gemini-3-flash-preview",          # 20 RPD, 全能型
    "gemini-2.5-flash",                # 20 RPD, 穩定版兜底
]

HEAVY_ROUTING: List[str] = [
    "gemini-3.7-flash",               # 🚀 3.7 首選：超長多天複雜行程規劃 (64K 輸出)
    "gemini-3.6-flash",               # 3.6 穩定次選
    "gemini-3.5-flash-lite",          # 🆕 3.5 Lite: 快速低延遲備援
    "gemini-3.1-flash-lite",           # 500 RPD, 高額度優先
    "gemini-3.5-flash",                # 頂級 Agentic 模型
    "gemini-3-flash-preview",          # 20 RPD, 次選
    "gemini-2.5-flash",                # 穩定版兜底
]

# ═══════════════════════════════════════════════════════════════
# 🐴 Workhorse Model (Gemma 系列, 14,400 RPD, 零成本)
# ═══════════════════════════════════════════════════════════════

WORKHORSE_ULTIMATE: str = "gemma-3-27b-it"        # 終極救援 (L3)
WORKHORSE_PENULTIMATE: str = "gemma-4-31b-it"     # 倒數第二救援 (L2)
WORKHORSE_MOE: str = "gemma-4-26b-a4b-it"         # 高效多模態專家

WORKHORSE_MODEL: str = WORKHORSE_ULTIMATE

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
