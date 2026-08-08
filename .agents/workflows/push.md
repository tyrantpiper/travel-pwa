---
description: Smart commit and push with TypeScript quality check
triggers:
  - "push"
  - "推送"
  - "commit"
  - "提交"
  - "git push"
---

> **架構守則**: 本地 `/push` 是負責 Quality Gate 與 Neural Linkage 的外殼。高智商的 Commit Message 生成將委派給全域技能。

## 1. Quality Gate (Pre-flight)
1. Run `npx tsc --noEmit` to verify TypeScript.
   - If errors → Report errors and stop (leave fixes to human confirmation).

## 2. Delegation to Global Brain
2. **Execute Global Skill**: Read and execute `~/.gemini/config/skills/git-pushing/SKILL.md`.
   - Allow the global skill to generate the Conventional Commit message, commit, and push.

## 3. 🛡️ Safety Protocol (L1->L1 Mesh)
3. **Regression Check**: 
   - Suggest running `.agents/skills/regression-guardian/SKILL.md` to ensure no hidden features were broken.

## 4. [NEURAL] Neural Linkage (Post-Flight)
4. **Signal Sentinel**:
   - Execute: `python backend/scripts/telemetry.py --source "Push" --message "Push completed" --level "INFO"`
