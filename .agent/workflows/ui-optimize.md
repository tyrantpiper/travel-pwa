---
description: Complete UI optimization workflow with skill chaining
triggers:
  - "UI 優化"
  - "樣式優化"
  - "styling"
  - "dark mode"
  - "效能優化"
---

# UI Optimization Workflow

This workflow chains multiple skills for comprehensive UI work.

## Phase 1: Audit
1. Read and execute `.agent/skills/pwa-auditor/SKILL.md`
2. Generate audit report

## Phase 2: Plan
3. Based on audit, create implementation plan
4. Request user approval if major changes

## Phase 3: Execute
5. For dark mode work → Read `.agent/skills/dark-mode-migrator/SKILL.md`
6. Apply changes following skill instructions

## Phase 4: Verify
// turbo
7. Run `npx tsc --noEmit --skipLibCheck` for TypeScript check

// turbo  
8. Run `npx eslint . --ext .ts,.tsx --quiet 2>&1 | Select-Object -First 20` for lint check

## Phase 5: Report
9. Update walkthrough with changes made
10. Notify user of completion

## Chained Skills
- `pwa-auditor` (Phase 1)
- `dark-mode-migrator` (Phase 3, if applicable)

## Exit Criteria
- [ ] All TypeScript errors resolved
- [ ] Audit findings addressed
- [ ] User notified

## [NEURAL] Neural Linkage
11. **Signal Sentinel**:
    - Log to `.agent/telemetry/tool_usage.log`: "UI Optimize completed".
