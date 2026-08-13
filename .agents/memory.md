## [Decisions]
- **Tiered Memory 架構與原生 CLI 轉移**: 放棄外部 MCP CLI 依賴，全面改用原生 Antigravity CLI (`agy`) 作為神經壓縮引擎。在非同步 Daemon 中採用非阻塞 `asyncio.create_subprocess_exec` 呼叫 `agy` (包含 `%LOCALAPPDATA%\agy\bin\agy.exe` 動態尋址)，防止 Event Loop 阻塞。
- **AI Recombination 神經融合機制**: 記憶壓縮採用 AI 重組融合模式取代傳統覆寫 (Overwrite)，無縫整合新舊日誌並確保 `[Technical Debt]` 區塊持續累積追蹤。
- **神經注入與跨平台極限防呆**: 實作 `argparse` 支援高層級工作流實體報告注入；使用 `safe_print` 包裹 `sys.stdout` 避免 Windows 背景服務崩潰；修復 Python 3.11 f-string 語法相容性與 `TrustedHostMiddleware` 白名單 (加入 `testserver`)。
- **放棄無效的簽名保留 (Abandon thought_signature hack)**: 經實體驗證，Gemini 3.6 的 Function Calling 在現有架構下即使拋棄 `thought_signature` 也能完美接續上下文。決策為放棄增加過度複雜且無效的後端序列化邏輯，以乾淨的原始碼與穩定性為絕對優先。
- **維持重裝路由 (Heavy Routing Default)**: 為保證系統純淨與 CI 穩定，捨棄了「將簡單意圖導流至 `DAILY_ROUTING`」的優化邏輯，決策為接受所有請求預設走 `HEAVY_ROUTING`，以成本換取架構單純。

## [Failed Paths]
- **外部 CLI 依賴**: 嘗試依賴 `mcp invoke mcp_notebooklm_notebook_query` 導致大腦無法在純淨環境中啟動。
- **非同步函式中的同步阻塞**: 在 `async def` 內部呼叫同步 `subprocess.Popen.communicate()` 會卡死整個 Event Loop，非同步 Daemon 中嚴禁使用。
- **Windows 終端機編碼地雷**: 在 cp950 環境下直接 `print` 含 Emoji 字串會引發 `UnicodeEncodeError`，必須透過 UTF-8 重置或 `safe_print` 包裹。
- **「看見黑影就開槍」的過度工程陷阱**: AI 代理看見 SDK 回傳 `FunctionCall` 警告訊息，未經驗證便誤判為 `thought_signature` 遺失所致，進而撰寫龐大無效的序列化補丁導致 CI 崩潰。核心教訓：架構修改前必須利用小腳本執行「活體實驗 (Live Probing)」，禁止憑空想像。

## [Technical Debt]
- **Metrics/Timeout 測試跳過**: `test_poi_lifespan.py` 使用 `@pytest.mark.skip` 暫時略過了未實作的 Metrics 與 Timeout 測試案例，待後續 Sprint 補齊。
- **Dependabot 漏洞修補**: Default branch 存在 1 個 Low severity 安全漏洞，需排程升級相依性。
- **Token 成本未優化**: 目前所有 `intent_type="CHAT"` 皆消耗 `gemini-3.6-flash` 額度，未來需重構路由系統將簡單意圖導流回 `gemini-3.1-flash-lite` 以節省成本。
- **本地端 API 限流**: 移除幻覺代碼同時也移除了 `poi_service` 中的 Wikipedia API `Semaphore(3)` 限制，本地開發極易遇到 `429 Too Many Requests`。
- **未完成的 Agent API 深度研究**: 目前僅繞過了 `thought_signature` 的報錯，但尚未對 Google 官方文件中提及的 Gemini 3 完整 Agent API 與狀態機保持機制進行深度架構研究，留待未來再議。

## [Vocabulary]
- **Auto Dream**: 負責在背景自動壓縮或手動融合記憶的神經網路服務腳本。
- **AI Recombination**: 大腦記憶壓縮重組模式，使新舊日誌無縫融合並保留歷史脈絡與技術債。