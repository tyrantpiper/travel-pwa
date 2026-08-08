---
name: Bug Hunter
description: AI-powered root cause analysis and anti-hallucination debugging agent. Integrates Red-Green TDD loops with systematic debugging.
---

# Bug Hunter Skill

> **架構守則**: 本地 `bug-hunter` 負責專案特化的測試迴圈 (TDD Red-Green) 與幻覺防護。高階系統性偵錯推理將委派給全域技能。

## 1. Context & Hypothesis (Anti-Hallucination)
1. Read `.agents/memory.md` to check if a similar bug occurred recently.
2. Formulate exactly ONE hypothesis before taking action.
   - ⚠️ Ensure you ONLY execute commands necessary to verify this single hypothesis.
   
## 2. Delegation to Global Brain
3. **Execute Global Skill**: Read and execute `~/.gemini/config/skills/systematic-debugging/SKILL.md`.
   - Allow the global skill to systematically reproduce and analyze the failure.

## 3. The Red-Green Loop (Local Enforcement)
4. Once the root cause is identified by the global skill, write or execute a test that FAILS (Red).
5. Apply the fix.
6. Verify the test PASSES (Green).
7. If tests fail 3 consecutive times, output `BLOCKED.md` to trigger the CI meltdown defense.
