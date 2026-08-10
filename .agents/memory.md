## [Decisions]
- **Tiered Memory 架構與原生 CLI 轉移**: 放棄外部 MCP CLI 依賴，全面改用原生 Antigravity CLI (`agy`) 作為神經壓縮引擎。在非同步 Daemon 中採用非阻塞 `asyncio.create_subprocess_exec` 呼叫 `agy` (包含 `%LOCALAPPDATA%\agy\bin\agy.exe` 動態尋址)，防止 Event Loop 阻塞。
- **AI Recombination 神經融合機制**: 記憶壓縮採用 AI 重組融合模式取代傳統覆寫 (Overwrite)，無縫整合新舊日誌並確保 `[Technical Debt]` 區塊持續累積追蹤。
- **神經注入與跨平台極限防呆**: 實作 `argparse` 支援高層級工作流實體報告注入；使用 `safe_print` 包裹 `sys.stdout` 避免 Windows 背景服務崩潰；修復 Python 3.11 f-string 語法相容性與 `TrustedHostMiddleware` 白名單 (加入 `testserver`)。

## [Failed Paths]
- **外部 CLI 依賴**: 嘗試依賴 `mcp invoke mcp_notebooklm_notebook_query` 導致大腦無法在純淨環境中啟動。
- **非同步函式中的同步阻塞**: 在 `async def` 內部呼叫同步 `subprocess.Popen.communicate()` 會卡死整個 Event Loop，非同步 Daemon 中嚴禁使用。
- **Windows 終端機編碼地雷**: 在 cp950 環境下直接 `print` 含 Emoji 字串會引發 `UnicodeEncodeError`，必須透過 UTF-8 重置或 `safe_print` 包裹。

## [Technical Debt]
- **Metrics/Timeout 測試跳過**: `test_poi_lifespan.py` 使用 `@pytest.mark.skip` 暫時略過了未實作的 Metrics 與 Timeout 測試案例，待後續 Sprint 補齊。
- **Dependabot 漏洞修補**: Default branch 存在 1 個 Low severity 安全漏洞，需排程升級相依性。

## [Vocabulary]
- **Auto Dream**: 負責在背景自動壓縮或手動融合記憶的神經網路服務腳本。
- **AI Recombination**: 大腦記憶壓縮重組模式，使新舊日誌無縫融合並保留歷史脈絡與技術債。