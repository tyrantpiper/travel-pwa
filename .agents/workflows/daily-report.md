---
name: Daily Report
description: Generates a master-level daily report using deterministic data gathering and tiered memory consolidation.
---

# Daily Report Workflow (/daily-report)

> **架構守則 (Master-Level Doctrine)**: 
> 真正的 Master 級別報告絕對不是「流水帳」，而是「文件即程式碼 (Documentation-as-Code)」。
> 本工作流嚴格遵守「確定性資料獲取 (Deterministic Data)」與「記憶分層 (Tiered Memory)」原則。

---

## 1. 確定性資料採集 (Hard Data Ingestion)
**禁止憑空想像。Agent 必須嚴格執行以下指令獲取真實數據：**
1. 讀取 Git 變更: `git log --since="1am" --oneline` 與 `git diff HEAD~1` (若有必要)。
2. 掃描今日終端機與 Agent 對話日誌 (透過讀取 `transcript` 或 `.agents/session_history.log`)。
3. 檢查 CI/CD 狀態與測試結果 (確認是否為綠燈)。

## 2. 多維度知識提煉 (Multi-Dimensional Synthesis)
**請以資深架構師 (@architect) 的視角，將採集到的資料分類為以下四個維度：**
- 🟢 **Features & Fixes**: 今日實際交付的價值 (例如修復了 Python 3.11 f-string 相容性)。
- 🏛️ **Architecture Decisions**: 今日做出的架構級決策 (例如允許 `testserver` 通過 `TrustedHostMiddleware`)。
- 🔴 **Technical Debt**: 為了追求速度而留下的技術債 (例如使用了 `@pytest.mark.skip` 略過未實作的 Metrics 測試)，必須明確記錄並留下待辦事項。
- 🛡️ **Failed Paths**: 今日踩過的坑與失敗的嘗試 (例如發現 `pytest` 會與 `sys.stdout` UTF-8 覆寫衝突)。

## 3. 持久化日誌產出 (Immutable Journaling)
**將提煉出的報告實體化，供人類與 RAG 系統未來檢索：**
1. 生成格式化報告：包含日期、執行摘要、上述四個維度，以及 Next Steps。
2. 存檔至：`docs/journals/YYYY-MM-DD-daily-report.md`。
   *(這保證了專案擁有完整的歷史上下文，新人 onboarding 或是未來的 Agent 都能藉此了解架構演進)*。

## 4. 潛意識記憶壓縮 (Neural Memory Consolidation)
**更新核心大腦，確保 Agent 不會失憶：**
1. 萃取報告中最核心的「Architecture Decisions」與「Failed Paths」。
2. 執行：`python scripts/auto_dream.py --trigger "Daily Wrap-up"` 
   *(若腳本支援，請將精華摘要直接寫入 `.agents/memory.md` 中的對應區塊)*。
3. 輸出：向使用者回報報告已生成並成功寫入大腦。
