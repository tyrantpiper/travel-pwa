"""
AI Configuration Constants
--------------------------
Centralized AI model configuration for use across all AI-related endpoints.
"""

# 1. 主力模型 (2025年最新, 速度快)
PRIMARY_MODEL = "gemini-2.5-flash"

# 2. 備用模型 (輕量, 最低成本)
LITE_MODEL = "gemini-2.0-flash-lite"

# 3. 智力模型 (無工具, 無 RPD 限制, 速度快)
SMART_NO_TOOL_MODEL = "gemini-3-flash-preview"

# 4. 推理模型 (免費無限, 複雜推理, 行程診斷)
REASONING_MODEL = "gemini-2.5-pro"
