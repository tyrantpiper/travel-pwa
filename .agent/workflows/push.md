---
description: Smart commit and push with TypeScript quality check
triggers:
  - "push"
  - "推送"
  - "commit"
  - "提交"
  - "git push"
---

## Pre-flight Check
1. Run `git status --porcelain` to check for changes
   - If empty output → Report "沒有變更需要提交" and stop

## Quality Gate
// turbo
2. Run `npx tsc --noEmit 2>&1 | Select-Object -First 20` to verify TypeScript
   - If errors → Report errors and stop (use --force to skip)

## Commit Phase
// turbo
3. Run `git add .` to stage all changes

4. Run `git commit -m "<message>"` with the provided commit message
   - If no message provided → Suggest based on changed files

## Push Phase
5. Run `git push` to push to remote

## Post-Push
6. Report: "✅ Pushed successfully!"

## 🛡️ Safety Protocol (L1->L1 Mesh)
7. **Regression Check**: 
   - Suggest running `regression-guardian` to ensure no hidden features were broken.
   - Command: "Run regression check"

## [NEURAL] Neural Linkage
7. **Signal Sentinel**:
   - Execute: `python backend/scripts/telemetry.py --source "Push" --message "Push completed ({N} files)" --level "INFO"`
