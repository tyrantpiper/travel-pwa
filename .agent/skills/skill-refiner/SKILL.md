---
name: "Skill Refiner"
description: "Meta-skill to analyze and optimize other Agent Skills"
version: "1.0.0"
parameters:
  - name: targetSkill
    type: string
    required: true
    description: "The name of the skill folder to optimize"
---

# Skill Refiner (Meta-Skill)

## Purpose
A recursive capability that allows the agent to inspect, critique, and improve its own instruction sets (`SKILL.md`). This enables "Self-Evolution".

## Quick Start
**Usage**: "幫我優化 `pwa-auditor` skill" or "Refine the `dark-mode-migrator` skill"

## Execution Steps

### Step 1: Analyze Target
1. Read the target skill's file: `.agent/skills/<targetSkill>/SKILL.md`
2. Analyze against **Agentic Design Patterns**:
   - **Clarity**: Are steps unambiguous?
   - **Progressive Disclosure**: Is complex info hidden in `references/`?
   - **Robustness**: Are there error handling or fallback instructions?
   - **Context Efficiency**: Is valid context being loaded?

### Step 2: Critique & Plan
1. Identification specific weaknesses (e.g., "Step 3 is too vague", "Missing examples").
2. Propose optimizations (e.g., "Split Step 3 into 3a/3b", "Add example block").

### Step 3: Apply Optimizations
1. Rewrite relevant sections of `SKILL.md`.
2. **Crucially**: Maintain the YAML frontmatter.
3. Add/Update `version` in frontmatter (increment patch version).

### Step 4: Verification & Neural Linkage
1. Output a diff or summary of what was improved.
2. Ask user to verify the new logic.
3. **[NEURAL] Signal Transmission**:
   - Append log entry to `.agent/telemetry/evolution_history.log`:
     ```text
     - [{YYYY-MM-DD}] Refined `{targetSkill}`: {Summary of changes} (User Approved)
     - [{YYYY-MM-DD}] Refined `{targetSkill}`: {Summary of changes} (User Approved)
     ```
4. **[NEURAL] Dynamic Discovery**:
    - Scan `.agent/AGENT_CONFIG.md`.
    - IF `{targetSkill}` is missing from "Skill Auto-Activation" table:
      - **Action**: Propose adding it to the registry.
      - **Goal**: Prevent "Ghost Skills" (capabilities that exist but the Agent doesn't know about).

## Optimization Checklist (The "Gold Standard")
- [ ] **Deterministic**: steps should yield the same result every time.
- [ ] **Atomic**: Each step should be one distinct action.
- [ ] **Context-Aware**: Instructions should reference specific files/paths.
- [ ] **User-Aligned**: Does it solve the user's problem with minimal friction?
