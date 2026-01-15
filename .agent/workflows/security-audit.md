---
description: Security hardening and vulnerability audit
triggers:
  - "安全"
  - "security"
  - "漏洞"
  - "vulnerability"
  - "audit dependencies"
---

# Security Hardening Workflow

> **Principle: Report, Don't Auto-Fix.**
> This workflow provides visibility into security posture. It NEVER auto-patches.

## Step 1: Dependency Vulnerability Scan
// turbo
Run `npm audit --production` in frontend directory.

**Parse Output:**
- Count vulnerabilities by severity (Critical, High, Moderate, Low).
- List top 5 critical/high packages.

## Step 2: Secret Detection Scan
Search codebase for potential leaked secrets:
- API Keys: Pattern `[A-Za-z0-9_]{20,}`
- Supabase Keys: Pattern `eyJ...` (JWT format)
- Environment files checked: `.env*` NOT in `.gitignore`

## Step 3: SBOM Check (Software Bill of Materials)
// turbo
Run `npm ls --all --json | Select-Object -First 50` to snapshot top dependencies.

## Step 4: Generate Security Report
Create artifact: `security_report_{date}.md`

**Report Sections:**
1. **Executive Summary**: Pass/Fail status based on Critical count.
2. **Vulnerability Table**: Package, Severity, Fixable?
3. **Secret Scan Results**: Filenames with potential leaks.
4. **Recommendations**: Manual steps user should take.

## ⚠️ Critical Rules
- **DO NOT** run `npm audit fix --force`. Ever.
- **DO NOT** auto-modify `package.json`.
- **PAUSE** and notify user before any destructive action.
