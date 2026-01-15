---
description: Automated large-scale code migration with incremental safety checks
triggers:
  - "migration"
  - "migrate"
  - "升級框架"
  - "大規模重構"
  - "move to new architecture"
---

# Migration Wizard (Hacker-Grade Safety)

> **Principle: Canary First, Then Flock.**
> Never migrate everything at once. Migrate one file, verify, then batch.

## 🛡️ Safety Architecture
- **Dry-Run Mode**: Mandatory 100% simulation before file IO.
- **Canary Strategy**: Migrate 1 non-critical file first.
- **Rollback Snapshot**: Detailed valid backup of state.

## Step 1: Migration Strategy (System 2)
1. User defines goal: E.g., "Migrate all `<img>` to `next/image`" or "Move from `pages` to `app`".
2. **Analysis**:
   - Count affected files: `N`
   - Calculate Complexity Score: `N * AVG_LINES`
3. **Strategy Selection**:
   - If N < 5: **Batch Mode**
   - If N > 5: **Incremental Mode** (Batch size: 5)

## Step 2: The Canary (First Blood)
4. Select 1 low-risk file (e.g., a utility or leaf component).
5. Apply migration logic solely to this file.
6. **Verify**:
   - Run linter/compiler.
   - **AST Verification**: Ensure structural integrity (no broken syntax trees).
   - Run Neural Linkage (`/test`).
7. **Pause**: If Canary dies, migration ABORTS.

## Step 3: Batch Execution (The Flock)
8. If Canary lives:
   - Create Batch 1 (5 files).
   - Generate Diff Artifact.
   - **User Check**: "Batch 1 Ready. Proceed?"
9. Apply Batch 1.
10. Verify.
11. Repeat until queue empty.

## [NEURAL] Neural Linkage
12. **Signal Sentinel**:
    - Log success/fail per batch to `.agent/telemetry/tool_usage.log`.
    - If error rate > 0%, **Circuit Breaker** trips and stops migration.

## ⚠️ Critical Rules
- **NEVER** migrate `package.json` and code in parallel.
- **ALWAYS** run strict tests between batches.
- **STOP** immediately on first failure.
