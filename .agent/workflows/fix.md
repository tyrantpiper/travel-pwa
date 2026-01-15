---
description: Standardized bug fix workflow with verification
triggers:
  - "fix"
  - "修復"
  - "bug"
  - "錯誤"
  - "壞掉"
---

## Step 1: Issue Analysis
1. Understand the bug description
2. Search for related code using grep_search
3. Identify root cause

## Step 2: Fix Implementation
4. Apply the fix to the identified files
5. Add comments explaining the fix

## Step 3: Verification
// turbo
6. Run `npx tsc --noEmit` to verify no TypeScript errors

## Step 4: Documentation
7. Update task.md with:
   - Bug description
   - Root cause
   - Fix applied
   - Verification status

## Step 5: Commit
8. Suggest commit message based on the fix
9. Ask user if ready to push (use /push workflow)
