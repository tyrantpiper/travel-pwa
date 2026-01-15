---
description: Deep code audit with architecture analysis
triggers:
  - "審核"
  - "audit"
  - "分析架構"
  - "code review"
  - "深度研究"
---

## Scope Definition
1. Ask user: "請指定審核範圍：檔案路徑、功能模組、或全專案？"

## Architecture Analysis
2. Read the target files/directories
3. Identify:
   - Component structure
   - State management patterns
   - API integration points
   - Potential performance issues

## Code Quality Check
// turbo
4. Run `npx tsc --noEmit` to check TypeScript errors

## Risk Assessment
5. Analyze for:
   - 🔴 Critical: Security issues, data loss risks
   - 🟡 High: Performance bottlenecks, race conditions
   - 🟢 Medium: Code smells, missing error handling
   - ⚪ Low: Style issues, minor optimizations

## Generate Report
6. Create audit report in artifacts with:
   - Executive Summary
   - Detailed Findings
   - Recommended Actions
   - Risk Matrix
