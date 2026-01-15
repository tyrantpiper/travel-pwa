---
description: Standardized bug fix workflow with verification
triggers:
  - "fix"
  - "修復"
  - "bug"
  - "錯誤"
  - "壞掉"
---

# /fix Workflow v2.0 (2026 Enhanced)

> **Principle:** Human-in-the-loop for critical fixes. AI assists, human decides.

---

## Step 1: Automated Diagnosis (Phase 3 Integration)
1. **Trigger Skill**: Call `debug-detective` with the bug description.
   - Command: "Analyze this bug: {description}"
   - Goal: Obtain Root Cause Analysis (RCA) and Anti-Hallucination verification.

2. **Analyze Report**: Read the `debug-detective` output.
   - If `hallucination_check` is **FAILED**: 🛑 **STOP** and query user.
   - If `confidence_score` < 0.6: ⚠️ Manual verification required.

## Step 2: Classification Strategy
Use the `debug-detective` output to classify:
- **TYPE**: Extract from report (e.g., LOGIC, SECURITY).
- **SEVERITY**: Extract from report.

## Step 2.5: 🆕 Confidence Assessment
Rate your confidence in the fix:

| Level | Threshold | Action |
|:---|:---:|:---|
| 🔴 LOW | < 60% | **Pause** - Request human review before applying |
| 🟡 MEDIUM | 60-85% | Proceed with detailed explanation |
| 🟢 HIGH | > 85% | Proceed normally |

## Step 3: Fix Implementation
4. Apply the fix to the identified files
5. Add comments explaining the fix (mandatory for SECURITY/LOGIC types)

## Step 3.5: 🆕 Human Checkpoint (Conditional)

**Trigger Conditions:**
| Condition | Action |
|:---|:---|
| ROOT_CAUSE = `SECURITY` | 🛑 **STOP** - Notify user for review |
| LINES_CHANGED > 30 | ⚠️ Request confirmation before commit |
| FILES_CHANGED > 3 | ⚠️ Generate summary and wait for approval |
| CONFIDENCE = LOW | 🛑 **STOP** - Explain uncertainty |

## Step 4: Verification (Enhanced)
// turbo
6. Run `npx tsc --noEmit` to verify no TypeScript errors
// turbo
7. Run `npx eslint <fixed-files> --quiet` to verify no lint errors

## Step 5: Documentation
8. Update task.md with:
   - Bug description
   - Root cause (TYPE + SEVERITY)
   - Confidence level
   - Fix applied
   - Verification status

## Step 6: Neural Linkage
9. **Signal Sentinel**:
    - Execute: `python backend/scripts/telemetry.py --source "Fix" --message "Fix completed: {TYPE}, {SEVERITY}, {CONFIDENCE}" --level "INFO"`

10. **Suggest (not auto-trigger)**:
    - If LOGIC/SECURITY: "建議執行 `regression-guardian` 檢查"
    - If > 20 lines changed: "建議執行 `/ai-review` 審查修復品質"

## Step 7: Commit
11. Suggest commit message format:
    ```
    fix({TYPE}): {brief description}
    
    - Root cause: {description}
    - Severity: {SEVERITY}
    - Confidence: {CONFIDENCE}%
    ```
12. Ask user if ready to push (use /push workflow)

---

## ⚠️ Critical Rules (2026 Safety)

1. **NEVER** auto-fix SECURITY bugs without user confirmation
2. **ALWAYS** verify error source is real (anti-hallucination)
3. **PAUSE** if confidence < 60%
4. **DOCUMENT** all fixes with inline comments
5. **SUGGEST** but never auto-trigger follow-up workflows

## 📊 Fix Quality Checklist
Before completing, verify:
- [ ] Fix addresses the root cause, not symptoms
- [ ] No new issues introduced
- [ ] TypeScript passes
- [ ] ESLint passes
- [ ] Comments explain the "why"
