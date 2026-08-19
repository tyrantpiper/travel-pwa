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

## Phase 3: React Compiler Compatibility Audit

5. **Healthcheck & Rule Violations**:
   - Run: `npx react-compiler-healthcheck@latest` in `frontend` directory.
   - Detect `useEffect` setState anti-patterns and hydration risks (`typeof window`, SSR mismatch).
6. **Memoization Analysis**:
   - Identify redundant `useMemo` / `useCallback` when React Compiler is active.

---

## Phase 4: Risk Matrix & Actionable Report

7. **Generate Report Artifact**: Create `audit_report_{date}.md` with:
   - Executive Summary & System Health Status
   - React Compiler Compatibility Score
   - Categorized Findings (🔴 Critical, 🟡 High, 🟢 Medium, ⚪ Low)
   - Prioritized Action Plan

---

## [NEURAL] Neural Linkage
Execute telemetry signal:
```bash
python backend/scripts/telemetry.py --source "Audit" --message "Audit completed" --level "INFO"
```
