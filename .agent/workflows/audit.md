---
description: Deep code audit with architecture analysis (React Compiler Enhanced)
triggers:
  - "審核"
  - "audit"
  - "分析架構"
  - "code review"
  - "深度研究"
  - "react compiler"
---

## Scope Definition
1. Ask user: "請指定審核範圍：檔案路徑、功能模組、或全專案？"

## Architecture Analysis
2. Read the target files/directories
3. Identify:
   - Component structure
   - State management patterns
   - API integration points
   - Potential performance issues

## Code Quality Check
// turbo
4. Run `npx tsc --noEmit` to check TypeScript errors

// turbo
5. Run `npm run lint` to check ESLint issues

---

## 🆕 React Compiler Compatibility Audit (2026 Deep Research)

### Phase 1: Installation Check
// turbo
6. Check React Compiler version: `npm list babel-plugin-react-compiler`

7. Verify presence in next.config.mjs:
   ```javascript
   experimental: { reactCompiler: true }
   ```

### Phase 2: Healthcheck (Official Tool)
// turbo
8. Run `npx react-compiler-healthcheck@latest` to detect:
   - Rules of React violations
   - Incompatible patterns
   - Library compatibility issues

### Phase 3: set-state-in-effect Detection
9. Search codebase for potential violations:
   ```grep
   Pattern: useEffect.*setState|useEffect.*set[A-Z]
   ```

10. Classify findings:
    | Pattern | Status |
    |:---|:---:|
    | `setMounted(true)` SSR hydration | ✅ Allowed (standard pattern) |
    | Derived state from props | ⚠️ Refactor to render-time calculation |
    | Data fetching setState | ⚠️ Consider React Query/SWR |
    | Infinite loop risk | 🔴 Critical |

### Phase 4: Memoization Analysis
11. Check for manual memoization that React Compiler handles:
    - `useMemo` usage (may be redundant with Compiler)
    - `useCallback` usage (may be redundant with Compiler)
    - `React.memo` wrappers (may be redundant with Compiler)

12. Generate optimization recommendations:
    - If Compiler enabled: Consider removing manual memos
    - If Compiler disabled: Verify memo dependencies correct

### Phase 5: SSR Hydration Patterns
13. Scan for hydration risk patterns:
    - `typeof window !== 'undefined'` checks
    - `localStorage` access in render
    - `Date.now()` or `Math.random()` in initial state
    - Third-party scripts modifying DOM
    
---

## 🖥️ System Environment Check (2026 Standards)

### Phase 6: Environment Versions
14. Check local tool versions (Non-blocking warning):
    - **Node.js**: Recommended **>= 20.9** (Next.js 15 requirement)
    - **Python**: Recommended **>= 3.9** (FastAPI async performance)
    
// turbo
15. Run `node -v` and `python --version`

---

## Risk Assessment
16. Analyze for:
   - 🔴 Critical: Security issues, data loss risks, infinite loops
   - 🟡 High: Performance bottlenecks, race conditions, Compiler violations
   - 🟢 Medium: Code smells, missing error handling
   - ⚪ Low: Style issues, minor optimizations

## Generate Report
17. Create audit report in artifacts with:
    - Executive Summary
    - React Compiler Compatibility Score
    - System Health Status
    - Detailed Findings (categorized)
    - Recommended Actions (prioritized)
    - Risk Matrix

## [NEURAL] Neural Linkage
18. **Signal Sentinel**:
    - Log audit to `.agent/telemetry/tool_usage.log`: "Audit completed (Score: {X}%)".
