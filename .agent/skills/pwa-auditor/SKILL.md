---
name: PWA Performance Auditor
description: Comprehensive PWA audit covering Core Web Vitals, dark mode coverage, touch targets, and cross-platform compatibility
version: "2.0.0"
triggers:
  - "UI 優化"
  - "效能分析"
  - "PWA 審核"
  - "performance audit"
  - "dark mode"
  - "深色模式"
---

# PWA Performance Auditor Skill

## Purpose
Autonomous performance and UI quality audit for Progressive Web Apps, focusing on:
- Core Web Vitals optimization
- Dark mode coverage analysis
- Touch target accessibility
- Cross-platform (mobile + desktop) compatibility

## When to Use
This skill triggers AUTOMATICALLY when:
1. User mentions "UI 優化", "效能", "performance", "audit"
2. User is working on styling or CSS changes
3. Before any major UI refactoring

## Execution Steps

### Phase 1: Dark Mode Coverage Analysis
Run the following grep search to find elements missing dark mode:

```bash
# Find hard-coded light colors without dark: variants
grep -r "bg-white" --include="*.tsx" frontend/components | grep -v "dark:"
grep -r "text-slate-900" --include="*.tsx" frontend/components | grep -v "dark:"
grep -r "border-slate-" --include="*.tsx" frontend/components | grep -v "dark:"
```

**Report Format:**
```
📊 Dark Mode Coverage Report
────────────────────────────
✅ Components with full dark mode: X
⚠️ Components with partial dark mode: Y  
❌ Components without dark mode: Z

Priority Fixes:
1. [file.tsx] - Missing X dark: classes
```

### Phase 2: Touch Target Audit
Check for buttons/interactive elements smaller than 44x44px:

```bash
# Find small buttons (h-8 = 32px, h-9 = 36px - both below 44px)
grep -r "h-8\|h-9" --include="*.tsx" frontend/components | grep -i "button\|onclick"
```

**Pass Criteria:** All interactive elements have `min-h-[44px]` or equivalent

### Phase 3: Border Contrast Check
Find low-contrast borders:

```bash
grep -r "border-slate-100" --include="*.tsx" frontend/components
```

**Recommendation:** Upgrade to `border-slate-200` for better visibility

### Phase 4: CSS Performance Check
Verify CSS optimizations in globals.css:

- [ ] `overscroll-behavior` set for PWA feel
- [ ] `contain: layout style paint` for cards
- [ ] `@media (prefers-reduced-motion)` respected
- [ ] GPU acceleration hints (`will-change`, `transform: translateZ(0)`)

### Phase 5: Generate Report
Create artifact: `pwa_audit_report.md`

```markdown
# PWA Performance Audit Report
Date: {date}

## Summary
| Metric | Status | Score |
|--------|--------|-------|
| Dark Mode Coverage | ✅/⚠️/❌ | X% |
| Touch Targets | ✅/⚠️/❌ | X/Y compliant |
| Border Contrast | ✅/⚠️/❌ | X issues |
| CSS Performance | ✅/⚠️/❌ | - |

## Priority Actions
1. ...
2. ...

## Detailed Findings
...
```

## Integration with Workflows

This skill should be chained with:
- `/test` workflow (after audit)
- `/push` workflow (before commit)

## Resources
- [Core Web Vitals Guide](https://web.dev/vitals/)
- [Touch Target Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)

## [NEURAL] Neural Linkage
6. **Signal Sentinel**:
   - Execute: `python backend/scripts/telemetry.py --source "PWA Auditor" --message "Audit completed (Score: {X}%)" --level "INFO"`
