---
description: Run all code quality checks (TypeScript + ESLint)
triggers:
  - "測試"
  - "test"
  - "驗證"
  - "verify"
  - "檢查"
---

## TypeScript Check
// turbo
1. Run `npx tsc --noEmit 2>&1 | Select-Object -First 30` for TypeScript compilation check

## ESLint Check (Optional)
// turbo
2. Run `npx eslint . --ext .ts,.tsx --quiet 2>&1 | Select-Object -First 20` for linting

## Report Results
3. Summarize:
   - ✅ TypeScript: PASS/FAIL
   - ✅ ESLint: PASS/FAIL (with error count if any)
