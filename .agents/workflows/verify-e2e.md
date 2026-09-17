---
name: "verify-e2e"
description: "End-to-End full stack integration testing, Chrome DevTools interactive telemetry, and Core Web Vitals profiling"
triggers:
  - "/verify-e2e"
  - "e2e"
  - "端到端測試"
  - "lighthouse"
  - "效能測試"
  - "整合驗證"
---

# End-to-End & Performance Verification Workflow (/verify-e2e v2.0)

> **Goal**: Verify end-to-end full stack logic (Frontend ⇄ API ⇄ Database) using Playwright, and execute deep interactive telemetry (Core Web Vitals, Memory Leak Audit, Console/Network inspection) via `@mcp:chrome-devtools-mcp`.

---

## Phase 1: Pre-Flight & Test Environment Reset

1. **Environment Check**:
   - Verify Frontend (`http://localhost:3000`) and Backend (`http://localhost:8008`) are accessible.
   - Verify Chrome DevTools MCP connection readiness:
     ```json
     call_mcp_tool("chrome-devtools-mcp", "list_pages", {})
     ```
2. **Auto-Cleanup (Clean Slate)**:
   ```bash
   python backend/scripts/cleanup_test_data.py
   ```

---

## Phase 2: Core Logic & Interactive Telemetry

### Part A: Playwright Integration Regression
3. **Execute E2E Integration Suite**:
   ```bash
   cd frontend
   npx playwright test tests/verify_flow.spec.ts
   cd ..
   ```

### Part B: Deep Interactive Telemetry (via @mcp:chrome-devtools-mcp)
> *Replaces the black-box `browser_subagent` with first-party CDP instrumentation.*

4. **Page Initialization & PageId Binding**:
   - Open target page and extract `targetPageId`:
     ```json
     call_mcp_tool("chrome-devtools-mcp", "new_page", { "url": "http://localhost:3000" })
     ```
5. **Attach Real-Time Observers & Start Trace**:
   - Monitor runtime errors and network anomalies:
     ```json
     call_mcp_tool("chrome-devtools-mcp", "list_console_messages", { "pageId": targetPageId })
     call_mcp_tool("chrome-devtools-mcp", "list_network_requests", { "pageId": targetPageId })
     ```
   - Start manual performance trace (disable autoStop and reload to capture live interactions):
     ```json
     call_mcp_tool("chrome-devtools-mcp", "performance_start_trace", {
       "pageId": targetPageId,
       "autoStop": false,
       "reload": false
     })
     ```
6. **Execute Critical User Journey Interactions**:
   - Perform user interactions directly using CDP:
     ```json
     call_mcp_tool("chrome-devtools-mcp", "click", { "pageId": targetPageId, ... })
     call_mcp_tool("chrome-devtools-mcp", "wait_for", { "pageId": targetPageId, ... })
     ```
7. **Stop Trace & Extract Performance Insights**:
   - Stop trace recording:
     ```json
     call_mcp_tool("chrome-devtools-mcp", "performance_stop_trace", { "pageId": targetPageId })
     ```
   - Query detailed breakdown for INP, LCP, and Long Tasks:
     ```json
     call_mcp_tool("chrome-devtools-mcp", "performance_analyze_insight", {
       "pageId": targetPageId,
       "insightName": "LCPBreakdown",
       "insightSetId": "..."
     })
     ```

---

## Phase 3: Performance, Memory & Quality Gate Audit

8. **Production Build & Bundle Size Check**:
   ```bash
   cd frontend
   npm run build
   cd ..
   ```
   - Check total bundle size and top 5 largest chunks.

9. **Tiered Memory Leak Inspection**:
   - **Step A (JSHeap Delta)**: Read memory consumption before and after interactions via `evaluate_script`:
     ```javascript
     window.performance.memory ? window.performance.memory.usedJSHeapSize : null
     ```
   - **Step B (Heap Snapshot)**: If `--deep` is specified or JSHeap increases by > 15MB:
     ```json
     call_mcp_tool("chrome-devtools-mcp", "take_heapsnapshot", {
       "pageId": targetPageId,
       "filePath": "C:\\Users\\Ryan su\\.gemini\\antigravity-ide\\brain\\a652e647-ca3a-473e-9f2b-9d8d5e5b51eb\\scratch\\heap_check.heapsnapshot"
     })
     ```
     Inspect for detached DOM elements and dangling closures.

10. **Lighthouse Audit (Macro-Health)**:
    - Audit accessibility, SEO, best practices:
      ```json
      call_mcp_tool("chrome-devtools-mcp", "lighthouse_audit", {
        "pageId": targetPageId,
        "mode": "snapshot"
      })
      ```
    - Optional CLI benchmark for overall 0-100 Performance Score:
      ```bash
      npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json --chrome-flags="--headless" --only-categories=performance
      ```

11. **Adaptive Quality Gate Policy (2026 Standards)**:
    | Metric | Target | Dev Server Mode | Production Preview Mode |
    |:---|:---:|:---:|:---:|
    | **Performance Score** | ≥ 90 | Warning | **Fail-Fast Block** |
    | **Interaction to Next Paint (INP)** | < 200ms | Warning | **Fail-Fast Block** |
    | **Largest Contentful Paint (LCP)** | < 2.5s | Warning | **Fail-Fast Block** |
    | **Cumulative Layout Shift (CLS)** | < 0.1 | Warning | **Fail-Fast Block** |
    | **Main Thread Long Tasks (>50ms)** | 0 | Warning | **Fail-Fast Block** |
    | **Unhandled Console Errors** | 0 | **Fail-Fast Block** | **Fail-Fast Block** |

---

## Phase 4: Teardown & Reporting

12. **Teardown Test Artifacts & Disk Cleanup**:
    ```bash
    python backend/scripts/cleanup_test_data.py
    ```
    - Remove temporary `.heapsnapshot` files from scratch directory to prevent disk bloat.

13. **Generate Consolidated Report**:
    - Create artifact `e2e_perf_report_{date}.md` with Playwright results, Console/Network log audit, Memory Delta / Detached DOM findings, and Core Web Vitals score card.

---

## [NEURAL] Neural Linkage
Execute telemetry signal:
```bash
python backend/scripts/telemetry.py --source "Verify E2E" --message "E2E and Chrome DevTools Profiling completed" --level "INFO"
```
