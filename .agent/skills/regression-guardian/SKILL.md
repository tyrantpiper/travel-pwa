---
name: Regression Guardian
description: Autonomous skill to detect regressions, missing features, and structural integrity issues after code changes.
---

# Regression Guardian Skill

This skill is designed to prevent "disappearing features" or "broken builds" by enforcing a strict regression check protocol. 
It should be used **autonomously** by the agent after significant backend changes or when the user suspects a regression.

## Capabilities

1. **Backend Integrity Check**:
   - Detects `NameError`, `ImportError`, and `SyntaxError` in Python modules.
   - Verifies all routers, models, and utility modules can be imported.
2. **Frontend Build Verification**:
   - Runs TypeScript compiler (`tsc`) to catch type mismatches.
   - Ensures API client signatures match backend endpoints.

## Instructions

### When to use
- After creating or modifying backend routers (`routers/*.py`).
- After changing database models (`models/*.py`).
- When the user reports "runtime error" or "missing functionality".
- Before pushing to `main` (Pre-flight check).

### How to use

**1. Run the Automated Health Check**
Use the `run_command` tool to execute the health check script:
```bash
python backend/scripts/health_check.py
```
*If this fails, STOP and fix the reported errors immediately.*

**2. Run the Full Regression Workflow**
For a comprehensive check including frontend:
```bash
# Refer to the workflow file for steps
# .agent/workflows/regression-check.md
```

**3. Manual Audit Checklist (Agent Thought Process)**
- [ ] **Data Persistence**: Did I change how data is saved? verification: Check corresponding `INSERT/UPDATE` SQL or Supabase calls.
- [ ] **Access Control**: Did I change permission logic (e.g., `is_member`)? verification: Verify logic covers edge cases (e.g., creator vs member).
- [ ] **Legacy Compatibility**: Does the new code handle old data formats? verification: Check for `get(field, default)` usage.

## Resources
- Script: `backend/scripts/health_check.py`
- Workflow: `.agent/workflows/regression-check.md`

## [NEURAL] Neural Linkage
4. **Signal Sentinel**:
   - Log to `.agent/telemetry/tool_usage.log`: "Regression Guardian (PASS/FAIL)".
