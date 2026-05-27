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

## Step 1: Telemetry Analysis
1. Read `.agent/telemetry/tool_usage.log` (if exists)
2. Read `.agent/telemetry/error_events.log` (if exists)
3. Analyze for patterns:
   - **High Failure Rate**: Is a specific workflow failing > 20%?
   - **Inefficiency**: Is a workflow taking > 5 attempts to complete?
   - **Staleness**: Has a skill not been used/updated in > 30 days?
   - **Resonance Risk**: Is the same error appearing > 3 times in 24h? (Circuit Breaker Trigger)

## Step 1.5: Skill Ecosystem Health Audit
*Objective: Prevent skill sprawl and context-window saturation.*

1. **Count Skills**:
   ```powershell
   # Global
   (Get-ChildItem "$HOME\.gemini\antigravity\skills" -Directory).Count
   # Project
   (Get-ChildItem ".agent\skills" -Directory).Count
   ```
2. **Size Compliance**: Check all SKILL.md files < 500 lines
   ```powershell
   Get-ChildItem "$HOME\.gemini\antigravity\skills" -Recurse -Filter "SKILL.md" |
     ForEach-Object { $l=(Get-Content $_.FullName | Measure-Object -Line).Lines; if($l -gt 500){"OVER: $($_.FullName) ($l lines)"} }
   ```
3. **Staleness Check**: Flag skills not referenced in recent conversations
4. **Overlap Scan**: Identify skills with > 50% keyword overlap in trigger table
5. **Report** against targets in `AGENT_CONFIG.md` → `Skill Ecosystem Health`

| Metric | Target | Action if Breached |
|:---|:---|:---|
| Global Skills | 12-18 | Consolidate or archive |
| Project Skills | 8-15 | Promote to global or remove |
| Total Skills | < 30 | Mandatory triage |
| Max SKILL.md | < 500 lines | `/skill-refiner` to split |

## Step 2: Circuit Breaker Check
*Objective: Prevent Infinite Feedback Loops.*
- **IF** Resonance Risk detected:
  - **Action**: Mark workflow as **QUARANTINED**.
  - **Output**: "⚠️ CRITICAL: Workflow X is in a failure loop. Optimization paused. Human intervention required."
  - **STOP** (Do not proceed to Shadow Mode for this workflow).

## Step 3: Shadow Mode Simulation (Conceptual)
4. If "High Failure Rate" found in `Workflow X`:
   - Simulate: "If we added a pre-check step, would it catch this error?"
   - Generate: **Modification Candidate** (e.g., "Add `npm check` to `dep-upgrade`")
   - Calculate: **Projected Improvement** (e.g., "Expected Success Rate: 80% -> 95%")

## Step 4: Evolution Status Check
5. Check `evolution_history.log`.
6. Verify last approved changes are stable (no regression in error logs).

## Step 5: Continuous Monitoring Dashboard
*Objective: Produce actionable metrics for ongoing health.*

Generate the following metrics table in every report:

```markdown
## 📈 Continuous Monitoring Metrics

| Category | Metric | Value | Trend | Status |
|:---------|:-------|:------|:------|:------:|
| **Skills** | Global count | N | — | ✅/⚠️ |
| **Skills** | Project count | N | — | ✅/⚠️ |
| **Skills** | Oversized (>500 lines) | N | — | ✅/❌ |
| **Skills** | Stale (>30 days) | N | — | ✅/⚠️ |
| **MCP** | Servers active | N/5 | — | ✅/❌ |
| **Workflows** | Total | N | — | — |
| **Workflows** | Failure rate (7d) | N% | ↑↓ | ✅/⚠️ |
| **Token** | Avg skills loaded/conv | N | ↑↓ | ✅/⚠️ |
| **Security** | Unscanned third-party | N | — | ✅/❌ |
| **Governance** | Quarantined workflows | N | — | ✅/⚠️ |
```

## Step 6: Generate Governor Report
7. Create artifact: `sentinel_report_{date}.md`

```markdown
# 🛡️ Sentinel Governor Report

## 📊 System Health (Telemetry)
- **Success Rate**: 98% (Last 7 days)
- **Most Used Skill**: `fullstack-builder` (15 calls)
- **Problematic Area**: `None`

## 🩺 Skill Ecosystem Health
- **Global Skills**: N / Target 12-18
- **Project Skills**: N / Target 8-15
- **Oversized Skills**: List or "None"
- **Stale Skills**: List or "None"
- **Token Defense**: Layer 1/2/3 status

## 👻 Shadow Mode Candidates
> Proposals for system evolution based on data.

### 1. [Candidate Name]
- **Issue**: /dep-upgrade failed 2 times on peer deps.
- **Proposal**: Add `--legacy-peer-deps` retry strategy.
- **Evidence**: 2026 patterns suggest this solves 90% of cases.
- **Risk**: Low (Retry only).
- **Status**: 🟢 Ready for Approval

## 📈 Continuous Monitoring Dashboard
[Insert Step 5 metrics table]

## 🚦 Governance Actions
- [ ] Approve Candidate 1
- [ ] Rollback last change (if regression found)
```

---

## ⚠️ Critical Rules (L3)
- **PASSIVE ONLY**: This workflow **NEVER** modifies code/skills directly.
- **EVIDENCE REQUIRED**: Must cite log data for every proposal.
- **GRADUATED AUTONOMY**:
  - If Confidence > 98% AND Risk < Low: Mark as "Auto-Approvable".
  - Else: Mark as "Requires Human Review".

