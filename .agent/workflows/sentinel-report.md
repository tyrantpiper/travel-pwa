---
description: L3 Governor workflow for system evolution analysis and reporting
triggers:
  - "sentinel report"
  - "meta audit"
  - "檢查進化"
  - "governance check"
---

# Sentinel Report Workflow (Integrated Governor L3)

> **Role**: The Meta-Observer.
> **Metric**: Evidence-Based Evolution.
> **Constraint**: Must adhere to `.agent/CONSTITUTION.md`.

---

## Step 0: Constitutional Alignment
1. **Read**: `.agent/CONSTITUTION.md`
2. **Verify**: Ensure all optimization proposals align with "Safety First".
3. **Drift Check**: If any proposal suggests lower security for higher speed -> **AUTO-REJECT**.
1. Read `.agent/telemetry/tool_usage.log` (if exists)
2. Read `.agent/telemetry/error_events.log` (if exists)
3. Analyze for patterns:
   - **High Failure Rate**: Is a specific workflow failing > 20%?
   - **Inefficiency**: Is a workflow taking > 5 attempts to complete?
   - **Staleness**: Has a skill not been used/updated in > 30 days?
   - **Resonance Risk**: Is the same error appearing > 3 times in 24h? (Circuit Breaker Trigger)

## Step 1.5: Circuit Breaker Check
*Objective: Prevent Infinite Feedback Loops.*
- **IF** Resonance Risk detected:
  - **Action**: Mark workflow as **QUARANTINED**.
  - **Output**: "⚠️ CRITICAL: Workflow X is in a failure loop. Optimization paused. Human intervention required."
  - **STOP** (Do not proceed to Shadow Mode for this workflow).

## Step 2: Shadow Mode Simulation (Conceptual)
4. If "High Failure Rate" found in `Workflow X`:
   - Simulate: "If we added a pre-check step, would it catch this error?"
   - Generate: **Modification Candidate** (e.g., "Add `npm check` to `dep-upgrade`")
   - Calculate: **Projected Improvement** (e.g., "Expected Success Rate: 80% -> 95%")

## Step 3: Evolution Status Check
5. Check `evolution_history.log`.
6. Verify last approved changes are stable (no regression in error logs).

## Step 4: Generate Governor Report
7. Create artifact: `sentinel_report_{date}.md`

```markdown
# 🛡️ Sentinel Governor Report

## 📊 System Health (Telemetry)
- **Success Rate**: 98% (Last 7 days)
- **Most Used Skill**: `fullstack-builder` (15 calls)
- **Problematic Area**: `None`

## 👻 Shadow Mode Candidates
> Proposals for system evolution based on data.

### 1. [Candidate Name]
- **Issue**: /dep-upgrade failed 2 times on peer deps.
- **Proposal**: Add `--legacy-peer-deps` retry strategy.
- **Evidence**: 2026 patterns suggest this solves 90% of cases.
- **Risk**: Low (Retry only).
- **Status**: 🟢 Ready for Approval

## 🚦 Governance Actions
- [ ] Approve Candidate 1
- [ ] Rollback last change (if regression found)
```

---

## ⚠️ Critical Rules (L3)
- **PASIVE ONLY**: This workflow **NEVER** modifies code/skills directly.
- **EVIDENCE REQUIRED**: Must cite log data for every proposal.
- **GRADUATED AUTONOMY**:
  - If Confidence > 98% AND Risk < Low: Mark as "Auto-Approvable".
  - Else: Mark as "Requires Human Review".
