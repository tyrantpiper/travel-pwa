---
description: AI-powered deep code review with actionable insights
triggers:
  - "AI審查"
  - "ai review"
  - "code review"
  - "深度審查"
  - "代碼審查"
---

# AI Deep Code Review Workflow

> **架構守則**: 本地 `/ai-review` 是負責 Domain Context 載入與 Neural Linkage 的外殼。核心的跨語言弱點掃描架構將委派給全域技能。

---

## 1. Domain Context Loading
1. **Read `CONTEXT.md`**: Understand the Tabidachi domain models and terminology.

## 2. Delegation to Global Brain
2. **Execute Global Skill**: Read and execute `~/.gemini/config/skills/code-reviewer/SKILL.md`.
   - Allow the global skill to perform multi-dimensional review (Security, Performance, React Compiler compatibility, etc.) using the knowledge from `CONTEXT.md`.

## 3. [NEURAL] Neural Linkage (Post-Flight)
3. **Signal Sentinel**:
   - Execute: `python backend/scripts/telemetry.py --source "AI Review" --message "Review completed via Global Skill" --level "INFO"`
