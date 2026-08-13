# Daily Report: 2026-08-12

## 📝 Executive Summary
今日的核心任務是進行「系統排毒」與「CI 修復」。透過調查與實體驗證，我們確認了上一位 Agent 所建立的 `thought_signature` 相關程式碼純屬幻覺，且引發了不必要的 CI 崩潰。我們選擇以最簡潔的方式清理戰場，將系統恢復至穩定的 `321e042` 版本，並確保單元測試 100% 通過。

---

## 🟢 Features & Fixes
- **清理廢棄測試**：刪除了會導致 GitHub Actions CI 失敗的 `backend/test_dup.py`，解決了 No API Key 的報錯。
- **修正單元測試**：對齊了 `tests/test_model_manager.py` 的測試斷言，將預期使用的模型從 `DAILY_ROUTING[1]` 修正為與生產端邏輯一致的 `HEAVY_ROUTING[1]`，使 `pytest` 測試完美達到綠燈。
- **乾淨的 Push**：透過 `/push` 工作流順利完成了 TypeScript 靜態檢查與 pytest 的雙重 Quality Gate，並已同步至遠端 `main` 分支 (Commit: `5e4df96`)。

## 🏛️ Architecture Decisions
- **放棄無效的簽名保留 (Abandon thought_signature hack)**：經查證官方文件與實機驗證，雖然 Gemini 3 系列模型在 Function Calling 時強烈建議保留 `thought_signature` 以維持上下文，但我們現有的架構 (Frontend 保存狀態 + Backend 重組歷史) 已被證實在使用 `gemini-3.6-flash` 時能完美運作。因此，我們決策：**不為了未發生的潛在錯誤而增加過度複雜的後端序列化邏輯**。
- **維持重裝路由 (Heavy Routing Default)**：為了保證穩定，捨棄了上一位 Agent 試圖將聊天意圖降級至 `DAILY_ROUTING` 的優化，接受現階段所有請求預設走 `HEAVY_ROUTING` 的事實。

## 🔴 Technical Debt
- **成本優化待辦 (Cost Inefficiency)**：目前的路由策略使得連簡單的 `intent_type="CHAT"` 也會消耗高成本的 `gemini-3.6-flash` 額度。未來需謹慎重構，將簡單意圖導流回 `gemini-3.1-flash-lite`。
- **本地端 API 頻率限制 (Local 429 Errors)**：捨棄 Agent 的改動同時也移除了對維基百科 API 的 `Semaphore(3)` 限制。本地開發者在測試時，仍可能遭遇 `429 Too Many Requests`。
- **未完成的 Agent API 深度研究 (Agent API Research Gap)**：雖然我們移除了導致報錯的 `thought_signature` 幻覺補丁，但 Gemini 3 官方文件確實提及該屬性在 Function Calling 的進階 Agent 狀態機中扮演關鍵角色。我們目前繞過了這個問題，但尚未對最新的 Google GenAI Agent API 進行完整的架構評估與重構研究。

## 🛡️ Failed Paths
- **「看見黑影就開槍」的幻覺陷阱**：上一位 Agent 看到了 `Warning: there are non-text parts in the response` 就過度恐慌，將其歸咎於 `thought_signature` 遺失，並擅自寫了龐大的補丁。
- **教訓**：在進行架構修改前，必須先進行「活體實驗 (Live Probing)」。今天透過撰寫腳本直接對 API 發出請求，才拆穿了這個系統幻覺。

---
**Next Steps**:
1. 持續監控生產端的 Token 消耗，評估是否需要重啟路由優化。
2. 將 429 防護網 (Semaphore) 獨立為一個 Pull Request 或小規模更新進行修復，不與其他邏輯混雜。
