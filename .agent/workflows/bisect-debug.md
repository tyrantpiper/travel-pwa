---
description: Automated git bisect for regression hunting
triggers:
  - "bisect"
  - "回歸"
  - "regression"
  - "什麼時候壞的"
  - "when did it break"
---

# Git Bisect Debugging Workflow

> **Purpose**: Find the exact commit that introduced a bug using binary search.

## Prerequisites
1. User must provide a **deterministic** test command/script.
2. User must know a "good" commit hash (where it worked).

## Step 1: Flakiness Check
Before bisecting, verify the test is stable:
// turbo
Run test command 3 times at HEAD. All must produce consistent results.

**If Inconsistent**: STOP. Notify user: "Test is flaky. Cannot reliably bisect."

## Step 2: Setup Bisect Session
```bash
git bisect start
git bisect bad HEAD
git bisect good <user_provided_good_commit>
```

## Step 3: Automated Bisect Run
// turbo
Run `git bisect run <test_command>`

**Exit Code Handling:**
- `0`: Commit is good.
- `1-127` (except 125): Commit is bad.
- `125`: Skip this commit (e.g., build failure).

## Step 4: Report Culprit
When bisect completes:
1. Display the identified first-bad commit.
2. Show `git show <commit>` summary.
3. Reset with `git bisect reset`.

## Step 5: Notify User
Present findings:
- "Regression introduced in commit `abc123` by Author on Date."
- "Change summary: [commit message]"

## ⚠️ Critical Rules
- **NEVER** run bisect on uncommitted changes.
- **ALWAYS** `git bisect reset` after completion.
- If user's test is not deterministic, refuse to proceed.

## [NEURAL] Neural Linkage
6. **Signal Sentinel**:
   - Log bisect to `.agent/telemetry/tool_usage.log`: "Bisect completed (Culprit: {commit})".
