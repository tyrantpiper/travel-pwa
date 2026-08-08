---
description: Run all code quality checks (TypeScript + ESLint)
triggers:
  - "測試"
  - "test"
  - "驗證"
  - "verify"
  - "檢查"
---

> **架構守則**: 本地 `/test` 是負責 Neural Linkage 的外殼。核心的跨語言品質掃描邏輯將委派給全域技能。

## 1. Delegation to Global Brain
1. **Execute Global Skill**: Read and execute `~/.gemini/config/skills/lint-and-validate/SKILL.md`.
   - Allow the global skill to run TypeScript, ESLint, Python, or other validation tools and parse their results.

## 2. [NEURAL] Neural Linkage (Post-Flight)
2. **Signal Sentinel**:
   - Log test to `.agents/telemetry/tool_usage.log`: "Test Executed via Global Skill".
