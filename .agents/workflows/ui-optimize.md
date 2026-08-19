---
name: "ui-optimize"
description: "Comprehensive UI optimization, accessibility audit, and safe structural refactoring"
triggers:
  - "/ui-optimize"
  - "UI 優化"
  - "樣式優化"
  - "重構"
  - "refactor"
  - "dark mode"
---

# UI Optimization & Refactoring Workflow (/ui-optimize)

> **Principle**: Dry-Run First, Apply Later. Zero CSS & Accessibility Regression.

---

## Phase 1: Audit & Scope Identification

1. **Audit Accessibility & PWA**:
   - Read and apply `.agents/skills/pwa-auditor/SKILL.md`.
2. **Identify Refactoring Target**:
   - Determine mode: `Component Extraction`, `Dark Mode Migration`, `Tailwind v4 Tokenization`, `Dead Code Removal`.

---

## Phase 2: Dry-Run & Simulation (Absorbed Refactor Protection)

3. **Generate Virtual Diff**:
   - Create refactor plan showing proposed before/after diff.
   - Calculate Complexity & Breaking Risk.
4. **Obtain User Approval**:
   - If refactor touches > 3 files or changes public props, request explicit user confirmation.

---

## Phase 3: Execution via UI Component Architect

5. **Apply Changes**:
   - Read `.agents/skills/ui-component-architect/SKILL.md`.
   - Enforce Tailwind CSS v4 `@theme` tokens, Radix UI accessibility, Framer Motion, and i18n dictionaries.

---

## Phase 4: Quality & Verification Gate

6. **Static Checks**:
   ```bash
   cd frontend
   npx tsc --noEmit --skipLibCheck
   npx eslint . --ext .ts,.tsx --quiet
   cd ..
   ```

---

## [NEURAL] Neural Linkage
Execute telemetry signal:
```bash
python backend/scripts/telemetry.py --source "UI Optimize" --message "UI optimization and refactor completed" --level "INFO"
```
