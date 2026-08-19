---
name: "verify-e2e"
description: "End-to-End full stack integration testing and Core Web Vitals performance profiling"
triggers:
  - "/verify-e2e"
  - "e2e"
  - "端到端測試"
  - "lighthouse"
  - "效能測試"
  - "整合驗證"
---

# End-to-End & Performance Verification Workflow (/verify-e2e)

> **Goal**: Verify end-to-end full stack logic (Frontend ⇄ API ⇄ Database) using Playwright and evaluate production Core Web Vitals (INP, LCP, CLS) using Lighthouse.

---

## Phase 1: Pre-Flight & Test Environment Reset

1. **Environment Check**:
   - Verify Frontend (`http://localhost:3000`) and Backend (`http://localhost:8000`) are accessible.
2. **Auto-Cleanup (Clean Slate)**:
   ```bash
   python backend/scripts/cleanup_test_data.py
   ```

---

## Phase 2: Core Logic & Integration Verification (Playwright)

3. **Execute E2E Integration Suite**:
   ```bash
   cd frontend
   npx playwright test tests/verify_flow.spec.ts
   cd ..
   ```
4. **Visual & UX Inspection**:
   - For visual transitions and responsive layout, execute `browser_subagent` to visit `http://localhost:3000`.
   - Validate component hydration and animations.

---

## Phase 3: Performance & Core Web Vitals Audit (Lighthouse)

5. **Production Build & Bundle Size Check**:
   ```bash
   cd frontend
   npm run build
   cd ..
   ```
   - Check total bundle size and top 5 largest chunks.

6. **Lighthouse Audit**:
   ```bash
   npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json --chrome-flags="--headless" --only-categories=performance
   ```

7. **Key Thresholds (2026 Standards)**:
   | Metric | Target | Status |
   |:---|:---:|:---:|
   | **Performance Score** | ≥ 90 | Pass |
   | **Interaction to Next Paint (INP)** | < 200ms | Pass |
   | **Largest Contentful Paint (LCP)** | < 2.5s | Pass |
   | **Cumulative Layout Shift (CLS)** | < 0.1 | Pass |

---

## Phase 4: Teardown & Reporting

8. **Teardown Test Artifacts**:
   ```bash
   python backend/scripts/cleanup_test_data.py
   ```

9. **Generate Consolidated Report**:
   - Create artifact `e2e_perf_report_{date}.md` with Playwright test results, Core Web Vitals delta, and memory leak audit.

---

## [NEURAL] Neural Linkage
Execute telemetry signal:
```bash
python backend/scripts/telemetry.py --source "Verify E2E" --message "E2E and Performance Audit completed" --level "INFO"
```
