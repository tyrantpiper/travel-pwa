## Tabidachi 核心記憶中樞 (Neural Memory)

### [Decisions]
- **Tiered Memory 架構建立**: 放棄 MCP CLI，全面改用原生 Antigravity CLI (agy) 作為神經壓縮引擎，確保高可用性與極簡架構。
- **神經注入機制**: 實作了 `argparse`，支援由 `/daily-report` 等高層級工作流手動注入實體報告至深層記憶。

### [Failed Paths]
- 嘗試依賴外部的 `mcp invoke mcp_notebooklm_notebook_query` 導致大腦無法在純淨環境中啟動。結論：不再使用此依賴。

### [Technical Debt]
- (目前暫無)

### [Vocabulary]
- **Auto Dream**: 負責在背景壓縮或手動融合記憶的神經網路服務腳本。