---
description: Automated regression check for backend integrity and frontend build
triggers:
  - "regression"
  - "回歸"
  - "backend changes"
  - "後端修改"
  - "health check"
---

This workflow performs a safety check on the codebase to catch common regression issues like missing imports, NameErrors, or build failures.

1. Install Backend Dependencies
// turbo
Run `pip install -r backend/requirements.txt`

2. Run Backend Health Check
// turbo
Run `python backend/scripts/health_check.py`

3. Verify Frontend Build (TypeScript Check)
// turbo
Run `npm run build` in `frontend/` directory (Note: this runs tsc and build)

4. Report Results
- If any step fails, stop and fix the issue.
- If all steps pass, the codebase is likely stable.

## [NEURAL] Neural Linkage
5. **Signal Sentinel**:
   - Log regression-check to `.agent/telemetry/tool_usage.log`: "Regression Check (PASS/FAIL)".
