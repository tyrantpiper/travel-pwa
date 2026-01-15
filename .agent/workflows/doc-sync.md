---
description: Documentation-as-Code synchronization check
triggers:
  - "文檔同步"
  - "doc sync"
  - "documentation"
  - "walkthrough update"
---

# Documentation Sync Workflow

> **Principle: Report, Don't Auto-Update.**
> Generates discrepancy reports for human review.

## Step 1: Scan Codebase Structure
Analyze `frontend/components/` directory:
- List all `.tsx` component files.
- Group by subdirectory (views/, ui/, itinerary/).

## Step 2: Scan Documentation
Read existing documentation files:
- `brain/walkthrough.md`
- `brain/implementation_plan.md`
- `.agent/AGENT_CONFIG.md`

Extract mentioned component names.

## Step 3: Cross-Reference
Compare Code Reality vs Documentation:
- **Undocumented**: Files in code but NOT in docs.
- **Orphaned Docs**: References in docs but file NOT in code.

## Step 4: Generate Discrepancy Report
Create artifact: `doc_sync_report_{date}.md`

**Report Format:**
```markdown
# Documentation Sync Report

## Undocumented Components (Code → Docs)
- `components/new-feature.tsx` - Not mentioned anywhere

## Orphaned References (Docs → Code)
- `walkthrough.md` references `old-component.tsx` - File deleted

## Recommendations
1. Add documentation for `new-feature.tsx`.
2. Remove reference to `old-component.tsx`.
```

## Step 5: User Approval
Present report to user:
- "Found {N} discrepancies. Review report?"

**DO NOT** auto-modify any documentation files.

## ⚠️ Critical Rules
- **DO NOT** auto-edit `walkthrough.md` or any doc.
- **ONLY** generate reports.
- Human approves all changes.

## [NEURAL] Neural Linkage
6. **Signal Sentinel**:
   - Execute: `python backend/scripts/telemetry.py --source "Doc Sync" --message "Doc Sync completed ({N} discrepancies)" --level "INFO"`
