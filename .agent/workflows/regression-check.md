---
description: Automated regression check for backend integrity and frontend build
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
