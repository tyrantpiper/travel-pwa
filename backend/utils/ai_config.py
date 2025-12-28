"""
AI Configuration Constants (Optimized 2025)
--------------------------------------------
Centralized AI model configuration with intelligent routing.

Model Hierarchy:
- CREATIVE: gemini-3-flash (20 RPD) - 創意規劃、對話
- SEARCH: gemini-2.5-flash (20 RPD) - 網路搜尋驗證  
- LITE: gemini-2.5-flash-lite (20 RPD) - 輕量備用
- WORKHORSE: gemma-3-27b-it (14,400 RPD) - 大量任務、翻譯、摘要
"""

# ═══════════════════════════════════════════════════════════════
# Gemini 系列 (Premium, 20 RPD each)
# ═══════════════════════════════════════════════════════════════

# 1. 創意模型 - 最聰明，用於規劃和對話
CREATIVE_MODEL = "gemini-3-flash-preview"

# 2. 搜尋模型 - 有 Google Search grounding
SEARCH_MODEL = "gemini-2.5-flash"

# 3. 輕量模型 - Gemini 系最後防線
LITE_MODEL = "gemini-2.5-flash-lite"

# ═══════════════════════════════════════════════════════════════
# Gemma 系列 (Workhorse, 14,400 RPD)
# ═══════════════════════════════════════════════════════════════

# 4. 工作馬模型 - 大量任務、翻譯、摘要、POI
WORKHORSE_MODEL = "gemma-3-27b-it"

# ═══════════════════════════════════════════════════════════════
# 向後兼容別名 (for existing code)
# ═══════════════════════════════════════════════════════════════

PRIMARY_MODEL = CREATIVE_MODEL          # 向後兼容
SMART_NO_TOOL_MODEL = CREATIVE_MODEL    # 向後兼容
REASONING_MODEL = WORKHORSE_MODEL       # gemini-2.5-pro 不可用，用 gemma 替代
FALLBACK_MODEL = WORKHORSE_MODEL        # 最終 fallback
