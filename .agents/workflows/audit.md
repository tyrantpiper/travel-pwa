---
name: "audit"
description: "Comprehensive code audit, architecture analysis, and React Compiler compatibility check"
triggers:
  - "/audit"
  - "審核"
  - "audit"
  - "分析架構"
  - "code review"
  - "深度審查"
  - "react compiler"
---

# Architecture & Code Quality Audit Workflow (/audit)

> **Role**: Master Architectural Auditor.
> **Standard**: Multi-dimensional review (Architecture, React Compiler, Security, Performance).

---

## Phase 1: Domain Context & Scope Definition

1. **Load Domain Context**: Read `CONTEXT.md` to ground domain terminology (`TripPlan`, `Destination`, `ExpenseRequest`).
2. **Determine Scope**: Ask user if not specified: "請指定審核範圍：特定檔案、模組路徑、或全專案？"

---

## Phase 2: Architecture & Code Review (Delegation to Global Brain)

3. **Execute Global Reviewer**: Read and apply `~/.gemini/config/skills/code-reviewer/SKILL.md`.
4. **Static Quality Check**:
   ```bash
   cd frontend
   npx tsc --noEmit
   npm run lint
   cd ..
   ```

---

## Phase 2.5: AST Semantic & Anti-Pattern Audit (tools-hub)

5. **AST Pattern Inspections (`ast_grep_search`)**:
   - **Frontend DOM Rules**:
     - `RULE-TS-01` (Decoupled Button DOM): 檢測 `<button>` 嵌套 `<button>`。
       `ast_grep_search(lang="typescript", path="frontend", pattern="<button $$$PRE><button $$$INNER>$$$CONTENT</button>$$$POST</button>")`
     - `RULE-TS-02` (Radix a11y): 檢測 `DialogContent` 缺少 `DialogDescription`。
     - `RULE-TS-03` (Zero-Remount): 檢測常駐視圖容器是否誤用動態 `key={$KEY}`。
   - **Backend High-Concurrency Rules**:
     - `RULE-PY-01` (Async Blocking Trap): 檢測 `async def` 路由內直接調用 `time.sleep` 或同步 blocking I/O。
       `ast_grep_search(lang="python", path="backend", pattern="async def $FUNC($$$ARGS): $$$BODY time.sleep($SEC) $$$TAIL")`
     - `RULE-PY-02` (Supabase Thread-Safe Guard): 檢測線程池中執行非安全 Supabase Client。
       `ast_grep_search(lang="python", path="backend", pattern="asyncio.to_thread($CLIENT.$$$METHOD, $$$ARGS)")`
     - `RULE-PY-03` (Zero-Blocking Health Probe): 檢測 `/health` 內包含任何 I/O 或 DB 操作。

---

## Phase 3: React Compiler & Performance Profiling

6. **Healthcheck & Rule Violations**:
   - Run: `npx react-compiler-healthcheck@latest` in `frontend` directory.
   - Detect `useEffect` setState anti-patterns and hydration risks (`typeof window`, SSR mismatch).
7. **Memoization Analysis**:
   - Identify redundant `useMemo` / `useCallback` when React Compiler is active.
8. **Benchmark Analysis (`hyperfine_benchmark`)**:
   - 針對重大重構前後進行嚴謹基準測試：
     `hyperfine_benchmark(commands=["cd frontend && npx tsc --noEmit", "cd backend && pytest backend/tests/"])`

---

## Phase 3.5: Live Endpoint & Contract Probing (`xh_http_request`)

9. **Zero-Blocking Health Probe Validation**:
   - 探測本地或遠端健康端點，驗證延遲與 200 OK 純內存狀態：
     `xh_http_request(url="http://localhost:8000/health", method="GET")`
   - 探測深度健康端點：
     `xh_http_request(url="http://localhost:8000/health/deep", method="GET")`

---

## Phase 4: Risk Matrix & Actionable Report

10. **Generate Report Artifact**: Create `audit_report_{date}.md` with:
    - Executive Summary & System Health Status
    - AST Semantic Guard Checklist (TS & Python)
    - React Compiler Compatibility Score
    - Live Endpoint Probe Status (Latency & Status)
    - Categorized Findings (🔴 Critical, 🟡 High, 🟢 Medium, ⚪ Low)
    - Prioritized Action Plan

---

## [NEURAL] Neural Linkage
Execute telemetry signal:
```bash
python backend/scripts/telemetry.py --source "Audit" --message "Audit completed" --level "INFO"
```
