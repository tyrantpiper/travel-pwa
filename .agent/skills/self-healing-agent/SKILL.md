---
name: Self-Healing Agent
description: Autonomous error detection and fixing agent with strict safety guardrails
triggers:
  - "自動修復"
  - "self-heal"
  - "auto-fix"
  - "fix build"
---

# Self-Healing Agent Skill

> **Goal:** Autonomously fix build errors, lint errors, or failing tests within safe limits.

## 🛡️ Safety Valves (CRITICAL)

1.  **Iteraction Limit**: MAX **3** retries per issue.
2.  **Time Limit**: MAX **60 seconds** total execution time.
3.  **Change Limit**: MAX **50 lines** modified per file.
4.  **Forbidden Operations**:
    *   ❌ DELETE files (unless temp files)
    *   ❌ MODIFY `package.json` / `package-lock.json`
    *   ❌ MODIFY `.env` / credentials
5.  **Human Checkpoint**: Pause after 2 consecutive failures.

## 🔄 The Loop

1.  **Diagnose**: Run command (e.g., `npm run build`) and capture stderr.
2.  **Analyze**: Agent identifies root cause from error log.
3.  **Plan**: Propose a minimal fix (e.g., fix type error, add missing import).
4.  **Act**: Apply fix using `replace_file_content` (or `multi_`).
5.  **Verify**: Re-run command.
    *   ✅ Success -> Stop.
    *   ❌ Fail -> GOTO 1 (Increment retry count).

## 🛠️ Usage

**Step 1: Set Target**
User provides command to heal (e.g., "fix npm run build").

**Step 2: Execute Loop (Max 3)**
- **Attempt 1**: Try obvious fix.
- **Attempt 2**: Try alternative fix.
- **Attempt 3**: Try last resort (safe fallback).
- **STOP**: Notify user "Self-healing failed".

## [NEURAL] Neural Linkage
- **On Fault**: Execute `python backend/scripts/telemetry.py --source "Self Healing" --message "Fault detected" --level "ERROR" --file error_events.log`
- **On Success**: Execute `python backend/scripts/telemetry.py --source "Self Healing" --message "Recovery successful" --level "INFO"`

## 📦 Output
- Artifact `fix_report.md` detailing error, fix applied, and verification result.
