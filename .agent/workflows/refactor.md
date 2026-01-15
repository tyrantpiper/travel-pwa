---
description: Automated batch refactoring with dry-run protection
triggers:
  - "重構"
  - "refactor"
  - "clean code"
  - "optimize code"
---

# Automated Refactoring Workflow

> **Principle: Dry-Run First, Apply Later.**
> Always visualize changes before applying structure modifications.

---

## Step 1: Identify Refactoring Target
1. Ask user: "請指定重構目標（檔案/目錄）與重構模式？"
   - Modes: `Extract Function`, `Rename Symbol`, `Dead Code Removal`, `Modernize Syntax`

## Step 2: Analysis & Plan
2. Read target code.
3. Identify occurrences to change.
4. Calculate complexity impact (Risk Score).

## Step 3: Dry-Run (Simulation)
5. Generate a virtual diff of proposed changes.
6. Create artifact: `refactor_plan_{date}.md`

```markdown
# Refactoring Plan: [Mode]

## 🎯 Target
`src/utils/legacy.ts`

## 🔄 Proposed Changes
```diff
- function old(a, b) { ... }
+ function newUniqueName(a, b) { ... }
```

## ⚠️ Risk Verification
- Build Breakers? CHECKED
- Public API Changed? CHECKED (If yes, mark HIGH RISK)
```

## Step 4: User Approval
7. **PAUSE**: Ask user "是否執行此重構計畫？(Run /confirm to apply)"

## Step 5: Execution
// only after confirmation
8. Apply changes using `multi_replace_file_content`.

## Step 6: Verify
// turbo
9. Run `npm run lint` and `npx tsc --noEmit`.

---

## [NEURAL] Neural Linkage
10. **Chain Reaction**: Trigger `/test` workflow to run full regression check.
11. **Signal Sentinel**:
    - Log event to `.agent/telemetry/tool_usage.log`: "Refactor completed".

## ⚠️ Critical Rules
- **ALWAYS** dry-run first.
- **NEVER** rename public exports without checking usage references.
- **LIMIT** refactoring to < 10 files per batch.
- **BACKUP** critical files before complex refactors.
