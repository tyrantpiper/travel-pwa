---
description: Hybrid Agentic-E2E Logic Verification
---

# Logic Audit Workflow

> **Goal**: Verify end-to-end logic (Frontend -> API -> DB) using a hybrid of Playwright (Precision) and Agent (Visuals).

---

## Step 1: Pre-Flight Check
1. Ask user: "Is the local development environment (Frontend :3000 & Backend :8000) running?"
2. If yes, proceed. If no, ask user to start them.

## Step 2: Auto-Cleanup (Safety First)
// turbo
3. Run `python backend/scripts/cleanup_test_data.py` to ensure a clean slate.

## Step 3: Core Logic Verification (Playwright)
4. Run integration tests:
   ```bash
   cd frontend
   npx playwright test tests/verify_flow.spec.ts
   ```

## Step 4: Visual/UX Verification (Agent)
(Only proceed if Step 3 passed)

5. **Agent Action**:
   - Use `browser_subagent` to visit `http://localhost:3000`.
   - Verify specific visual elements that automation might miss (e.g., "Does the gradient look correct?", "Is the animation smooth?").

## Step 5: Teardown
// turbo
6. Run `python backend/scripts/cleanup_test_data.py` again to remove test artifacts.

## Step 6: Report
7. Generate `logic_audit_report_{date}.md` with:
   - Playwright Test Results
   - Visual Inspection Notes
   - Database Integrity Check Status

## [NEURAL] Neural Linkage
4. **Signal Sentinel**:
   - Execute: `python backend/scripts/telemetry.py --source "Logic Audit" --message "Audit completed (Status: {PASS/FAIL})" --level "INFO"`
