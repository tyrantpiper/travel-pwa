# 🤖 旅遊 App AI 模型使用策略概要

**版本：** v1.0  
**更新日期：** 2025-12-19  
**適用範圍：** Ryan Travel App

---

## 📋 目錄
1. [模型選擇策略](#模型選擇策略)
2. [功能場景對應](#功能場景對應)
3. [降級與替代方案](#降級與替代方案)
4. [實作架構](#實作架構)
5. [監控與限流](#監控與限流)
6. [成本預估](#成本預估)

---

## 🎯 模型選擇策略

### **主力模型矩陣**

| 模型 | 特性 | 免費額度 | 適用場景 |
|------|------|---------|---------|
| **Gemini 2.5 Flash** | 平衡性能、支援 Search + Maps | 無限制 | 80% 主力任務 |
| **Gemini 2.5 Flash Lite** | 高吞吐量、低延遲 | 無限制 | 15% 輕量任務 |
| **Gemini 2.5 Pro** | 最強推理能力 | 無限制 | 5% 複雜任務 |

**重要限制：**
- **Google Search：** 500 RPD（每日請求數）- Flash 和 Flash Lite 共用
- **Google Maps：** 500 RPD - Flash 和 Flash Lite 共用

---

## 🎬 功能場景對應

### **1. Markdown 行程解析**
```
優先級：P0（核心功能）
主模型：Gemini 2.5 Flash
調用位置：後端
頻率估計：每用戶 1-5 次/天

理由：
✓ 需要精確的結構化輸出
✓ 可以啟用 Google Maps 獲取座標
✓ 100萬 token 上下文（支援超長行程）
```

**Prompt 範例：**
```python
model = genai.GenerativeModel(
    "gemini-2.5-flash",
    tools=['google_maps_data_tool']  # 啟用 Maps
)
```

---

### **2. 智能路線優化**
```
優先級：P1（重要功能）
主模型：Gemini 2.5 Flash + Google Maps
調用位置：後端
頻率估計：每用戶 3-10 次/天

理由：
✓ 需要 Google Maps 計算距離和交通時間
✓ 中等複雜度推理（排序、優化）
✓ 結果可快取（相同順序可重複使用）
```

---

### **3. 地點推薦與搜尋**
```
優先級：P1（重要功能）
主模型：Gemini 2.5 Flash + Google Search
調用位置：後端
頻率估計：每用戶 5-15 次/天

理由：
✓ 需要 Google Search 獲取最新資訊
✓ 即時性要求高（開放時間、評價）
✓ 結果可快取 1-24 小時
```

---

### **4. 快速翻譯**
```
優先級：P2（輔助功能）
主模型：Gemini 2.5 Flash Lite
調用位置：後端（可快取）
頻率估計：每用戶 10-30 次/天

理由：
✓ 簡單任務，不需要 Search/Maps
✓ 高頻使用，需要低延遲
✓ 結果可永久快取
```

---

### **5. 聊天機器人**
```
優先級：P2（輔助功能）
主模型：Gemini 2.5 Flash Lite（簡單問答）
        Gemini 2.5 Flash（需要搜尋）
調用位置：後端
頻率估計：活躍用戶 20-50 次/天

理由：
✓ 大部分問答簡單（Flash Lite）
✓ 需要即時資訊時切換 Flash + Search
✓ 需要上下文記憶
```

---

### **6. 複雜行程規劃**
```
優先級：P3（進階功能）
主模型：Gemini 2.5 Pro
調用位置：後端
頻率估計：每用戶 1-3 次/周

理由：
✓ 需要深度推理（預算、偏好、天氣、時間）
✓ 生成完整行程方案
✓ 低頻使用，可接受較長延遲
```

---

## ⚡ 降級與替代方案

### **策略 1：模型降級鏈**

```
功能請求
    ↓
【第1階段】嘗試主模型
    ↓ 失敗/限流
【第2階段】切換備用模型
    ↓ 失敗
【第3階段】使用快取/靜態結果
    ↓ 失敗
【第4階段】返回友善錯誤訊息
```

---

### **降級矩陣**

| 原始模型 | 額度耗盡原因 | 第1備選 | 第2備選 | 第3備選 |
|---------|-------------|---------|---------|---------|
| **Flash (Search)** | Search RPD 超限 | Flash (無 Search) | Flash Lite | 快取結果 |
| **Flash (Maps)** | Maps RPD 超限 | Flash (無 Maps) | 使用已知座標 | 用戶手動輸入 |
| **Flash** | API 錯誤 | Flash Lite | Pro | 快取/靜態 |
| **Flash Lite** | API 錯誤 | Flash | - | 快取/靜態 |
| **Pro** | API 錯誤 | Flash | Flash Lite | 快取/靜態 |

---

### **具體實作範例**

#### **場景 1：Markdown 解析（Maps 額度耗盡）**

```python
async def parse_markdown_with_fallback(text: str):
    try:
        # 嘗試 1：Flash + Google Maps
        return await parse_with_maps(text, model="flash")
    except QuotaExceededError as e:
        if "maps" in str(e).lower():
            # 嘗試 2：Flash 無 Maps（使用 Geocoding API）
            logger.warning("Maps quota exceeded, using Geocoding API")
            return await parse_with_geocoding(text, model="flash")
    except Exception as e:
        # 嘗試 3：Flash Lite + Geocoding
        logger.error(f"Flash failed: {e}, falling back to Flash Lite")
        return await parse_with_geocoding(text, model="flash-lite")
```

---

#### **場景 2：地點推薦（Search 額度耗盡）**

```python
async def recommend_places_with_fallback(location: str, category: str):
    try:
        # 嘗試 1：Flash + Google Search
        return await recommend_with_search(location, category)
    except QuotaExceededError as e:
        if "search" in str(e).lower():
            # 嘗試 2：使用快取的熱門地點列表
            logger.warning("Search quota exceeded, using cached data")
            return await get_cached_recommendations(location, category)
    except Exception as e:
        # 嘗試 3：返回靜態的熱門地點
        logger.error(f"Recommendation failed: {e}, using static data")
        return get_static_popular_places(location, category)
```

---

#### **場景 3：聊天機器人（智能切換）**

```python
async def chat_with_smart_routing(message: str, context: list):
    # 判斷是否需要搜尋
    needs_search = any(keyword in message.lower() 
                      for keyword in ["最新", "現在", "今天", "評價", "推薦"])
    
    if needs_search:
        try:
            # 使用 Flash + Search
            return await chat_with_search(message, context)
        except QuotaExceededError:
            # 降級到 Flash 無 Search
            logger.warning("Search quota exceeded, using Flash without Search")
            return await chat_without_search(message, context)
    else:
        # 簡單問答，使用 Flash Lite
        return await chat_lite(message, context)
```

---

## 🏗️ 實作架構

### **AI Service 類別設計**

```python
# backend/services/ai_service.py

from enum import Enum
from typing import Optional, Dict, Any
import google.generativeai as genai
from functools import wraps
import time

class ModelType(Enum):
    FLASH = "gemini-2.5-flash"
    FLASH_LITE = "gemini-2.5-flash-lite"
    PRO = "gemini-2.5-pro"
    FLASH_PREVIEW = "gemini-2.5-flash-preview-09-2025"  # 備用

class ToolType(Enum):
    NONE = None
    SEARCH = "google_search_tool"
    MAPS = "google_maps_data_tool"
    BOTH = ["google_search_tool", "google_maps_data_tool"]

class QuotaManager:
    """管理 API 配額"""
    def __init__(self):
        self.daily_limits = {
            "search": 500,
            "maps": 500
        }
        self.counters = {
            "search": 0,
            "maps": 0
        }
        self.reset_time = time.time() + 86400  # 24小時後重置
    
    def check_quota(self, tool: str) -> bool:
        """檢查是否還有配額"""
        if time.time() > self.reset_time:
            self.reset_counters()
        
        if tool in self.counters:
            return self.counters[tool] < self.daily_limits[tool]
        return True
    
    def increment(self, tool: str):
        """增加計數器"""
        if tool in self.counters:
            self.counters[tool] += 1
    
    def reset_counters(self):
        """重置計數器"""
        self.counters = {key: 0 for key in self.counters}
        self.reset_time = time.time() + 86400

class AIService:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.quota_manager = QuotaManager()
        self.cache = {}  # 簡單記憶體快取
    
    def _get_model(self, model_type: ModelType, tools: ToolType = ToolType.NONE):
        """獲取配置好的模型"""
        config = {"model_name": model_type.value}
        
        if tools != ToolType.NONE:
            config["tools"] = tools.value if tools.value else None
        
        return genai.GenerativeModel(**config)
    
    async def generate_with_fallback(
        self, 
        prompt: str,
        primary_model: ModelType = ModelType.FLASH,
        tools: ToolType = ToolType.NONE,
        fallback_chain: list = None
    ) -> Dict[str, Any]:
        """
        使用降級鏈生成內容
        
        Args:
            prompt: 提示詞
            primary_model: 主要模型
            tools: 需要的工具
            fallback_chain: 降級鏈 [(model, tools), ...]
        """
        # 檢查配額
        if tools in [ToolType.SEARCH, ToolType.BOTH]:
            if not self.quota_manager.check_quota("search"):
                logger.warning("Search quota exceeded, removing search tool")
                tools = ToolType.MAPS if tools == ToolType.BOTH else ToolType.NONE
        
        if tools in [ToolType.MAPS, ToolType.BOTH]:
            if not self.quota_manager.check_quota("maps"):
                logger.warning("Maps quota exceeded, removing maps tool")
                tools = ToolType.SEARCH if tools == ToolType.BOTH else ToolType.NONE
        
        # 定義默認降級鏈
        if fallback_chain is None:
            fallback_chain = [
                (ModelType.FLASH_LITE, ToolType.NONE),
                (ModelType.FLASH_PREVIEW, ToolType.NONE)
            ]
        
        # 嘗試主模型
        try:
            model = self._get_model(primary_model, tools)
            response = model.generate_content(prompt)
            
            # 記錄使用的工具
            if tools in [ToolType.SEARCH, ToolType.BOTH]:
                self.quota_manager.increment("search")
            if tools in [ToolType.MAPS, ToolType.BOTH]:
                self.quota_manager.increment("maps")
            
            return {
                "status": "success",
                "data": response.text,
                "model_used": primary_model.value,
                "tools_used": tools.value
            }
        except Exception as e:
            logger.error(f"Primary model {primary_model.value} failed: {e}")
            
            # 嘗試降級鏈
            for fallback_model, fallback_tools in fallback_chain:
                try:
                    logger.info(f"Trying fallback: {fallback_model.value}")
                    model = self._get_model(fallback_model, fallback_tools)
                    response = model.generate_content(prompt)
                    
                    return {
                        "status": "fallback",
                        "data": response.text,
                        "model_used": fallback_model.value,
                        "tools_used": fallback_tools.value,
                        "fallback_reason": str(e)
                    }
                except Exception as fallback_error:
                    logger.error(f"Fallback {fallback_model.value} failed: {fallback_error}")
                    continue
            
            # 所有模型都失敗
            raise Exception("All models failed")

# 使用範例
ai_service = AIService(api_key=os.getenv("GEMINI_API_KEY"))

# Markdown 解析
result = await ai_service.generate_with_fallback(
    prompt=markdown_prompt,
    primary_model=ModelType.FLASH,
    tools=ToolType.MAPS,
    fallback_chain=[
        (ModelType.FLASH, ToolType.NONE),  # 移除 Maps
        (ModelType.FLASH_LITE, ToolType.NONE)
    ]
)
```

---

## 📊 監控與限流

### **需要監控的指標**

```python
class UsageMetrics:
    """使用指標追蹤"""
    def __init__(self):
        self.metrics = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "fallback_used": 0,
            "model_usage": {
                "flash": 0,
                "flash_lite": 0,
                "pro": 0
            },
            "tool_usage": {
                "search": 0,
                "maps": 0
            },
            "quota_exceeded": {
                "search": 0,
                "maps": 0
            }
        }
    
    def log_request(self, result: Dict[str, Any]):
        """記錄請求結果"""
        self.metrics["total_requests"] += 1
        
        if result["status"] == "success":
            self.metrics["successful_requests"] += 1
        elif result["status"] == "fallback":
            self.metrics["fallback_used"] += 1
        
        # 記錄使用的模型
        model_name = result["model_used"].split("-")[-1]  # flash, pro, etc.
        if model_name in self.metrics["model_usage"]:
            self.metrics["model_usage"][model_name] += 1
    
    def get_summary(self) -> Dict:
        """獲取使用摘要"""
        return {
            "success_rate": self.metrics["successful_requests"] / max(self.metrics["total_requests"], 1),
            "fallback_rate": self.metrics["fallback_used"] / max(self.metrics["total_requests"], 1),
            "model_distribution": self.metrics["model_usage"],
            "tool_usage": self.metrics["tool_usage"],
            "quota_status": self.metrics["quota_exceeded"]
        }
```

---

## 💰 成本預估（免費版）

### **每日請求預估**

假設 100 活躍用戶：

| 功能 | 單用戶/日 | 總請求/日 | 使用模型 | Search RPD | Maps RPD |
|------|----------|----------|---------|-----------|---------|
| Markdown 解析 | 2 | 200 | Flash + Maps | 0 | 200 |
| 路線優化 | 5 | 500 | Flash + Maps | 0 | 300* |
| 地點推薦 | 10 | 1000 | Flash + Search | 400* | 0 |
| 翻譯 | 15 | 1500 | Flash Lite | 0 | 0 |
| 聊天機器人 | 25 | 2500 | Flash Lite/Flash | 100* | 0 |
| **總計** | - | **5700** | - | **500** | **500** |

**⚠️ 注意：剛好達到免費額度上限！**

### **優化建議**

1. **啟用快取**
   - 地點推薦快取 24 小時
   - 翻譯永久快取
   - 減少 60% 重複請求

2. **智能路由**
   - 只在必要時啟用 Search
   - Maps 優先使用已知座標

3. **用戶限流**
   - 每用戶每日限制
   - 付費用戶提高額度

---

## 🎯 實作優先級

### **Phase 1：基礎架構（本周）**
- [x] 創建 AIService 類別
- [ ] 實作 QuotaManager
- [ ] 實作基本降級邏輯
- [ ] 添加日誌記錄

### **Phase 2：優化與快取（下周）**
- [ ] Redis 快取層
- [ ] 智能路由邏輯
- [ ] 使用指標儀表板

### **Phase 3：進階功能（2周後）**
- [ ] A/B 測試不同模型
- [ ] 自動調整降級策略
- [ ] 成本預測與警報

---

## 📝 總結

### **核心原則**
1. ✅ **後端為主** - 所有 AI 調用都在後端
2. ✅ **智能降級** - 自動切換模型避免服務中斷
3. ✅ **積極快取** - 減少重複請求
4. ✅ **監控先行** - 即時掌握配額使用情況

### **風險管理**
- **Search/Maps 額度耗盡** → 切換到無工具模式或使用快取
- **模型 API 失敗** → 降級鏈確保服務可用
- **成本超支** → 免費版本無此風險，但需監控品質

### **擴展計劃**
- 用戶量增長 → 考慮付費版或多 API Key 輪詢
- 功能複雜度提升 → 增加 Pro 模型使用比例
- 全球化 → 考慮多語言模型選擇

---

**文檔維護：** 每月更新配額使用情況和優化建議
**責任人：** Backend Team
**審核週期：** 每季度
