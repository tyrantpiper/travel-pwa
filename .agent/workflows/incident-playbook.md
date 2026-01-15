---
description: Automated incident analysis and playbook generation (Read-Only)
triggers:
  - "incident"
  - "outage"
  - "down"
  - "緊急"
  - "crash"
---

# Incident Playbook (Hacker-Grade Analysis)

> **Principle: Read-Only Analysis, Human Execution.**
> The Agent diagnoses the patient but does not perform surgery unsanctioned.

## 🛡️ Safety Constraints
- **Scope**: Local Logs (dev) + Simulated Prod Logs (if provided).
- **Access**: READ-ONLY. No write access to DB/ProD.
- **Output**: Markdown Playbook ("The Prescription").

## Step 1: Triage (System 2)
1. **Input**: User pastes logs / error trace.
2. **Signal**:
   - Identify affected subsystem (DB? Frontend? API?).
   - Severity Assessment (P0/P1/P2).

## Step 2: Diagnostics (Deep Search)
3. Search codebase for error signatures.
4. Check `evolution_history.log` (Did a recent change cause this?).
4. Check `evolution_history.log` (Did a recent change cause this?).
5. Check `tool_usage.log` (Was an automated tool responsible?).

## Step 2.5: Correlation Engine (Context Awareness)
*Objective: Avoid Tunnel Vision.*
- **Action**: Cross-reference timestamps across:
  - Application Logs (Error trace)
  - Database Logs (Slow queries)
  - System Metrics (CPU/RAM spikes)
- **Output**: "Timeline of Destruction" (Sequence of events leading to failure).

## Step 3: Playbook Generation
6. Create artifact: `incident_response_{id}.md`

```markdown
# 🔥 Incident Playbook: [Error Name]

## 🚨 Root Cause Analysis (Hypothesis)
- Likelihood: 90%
- Cause: DB Connection Pool Exhaustion

## 🧪 Verification Steps (Safe)
- Run `SELECT * FROM pg_stat_activity`
- Check API latency metrics

## 💊 Remediation Plan (Human Execute)
1. [ ] Restart Service X
2. [ ] Rollback to Commit Y (Command provided)
3. [ ] Increase Pool Size (Config path provided)

## 🛡️ Future Prevention (Sentinel)
- Add monitoring for metric Z
```

## [NEURAL] Neural Linkage
7. **Signal Sentinel**:
   - Execute: `python backend/scripts/telemetry.py --source "Incident Playbook" --message "Incident logged" --level "ERROR" --file "error_events.log"`
   - **Evolution**: Sentinel will use this to propose stricter guardrails in next Weekly Report.

## ⚠️ Critical Rules
- **DO NOT** execute remediation commands automatically.
- **DO NOT** assume specific env (prod vs staging) without checking.
- **FOCUS** on providing "Copy-Pasteable" safe commands for the Human.
