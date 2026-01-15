# Telemetry Data Schema

> **Purpose**: Store execution logs for Sentinel L3 analysis.

## 1. `tool_usage.log`
Records every tool execution for frequency analysis.
```csv
timestamp, tool_name, success(bool), duration_ms, context_task
2026-01-15T12:00:00Z, run_command, true, 1200, "build"
```

## 2. `error_events.log`
Records failures for "Self-Healing" analysis.
```json
{
  "timestamp": "...",
  "workflow": "/dep-upgrade",
  "step": "3",
  "error": "Conflict in peerDependencies",
  "resolution": "manual"
}
```

## 3. `evolution_history.log`
Records changes made by Sentinel/Skill-Refiner.
```markdown
- [2026-01-15] Refined `dep-upgrade` to add safety valve (Approved by User)
```
