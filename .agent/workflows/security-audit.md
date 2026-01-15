---
description: Security hardening and vulnerability audit (React Compiler Enhanced)
triggers:
  - "安全"
  - "security"
  - "漏洞"
  - "vulnerability"
  - "audit dependencies"
  - "react compiler security"
  - "資料流失"
---

# Security Hardening Workflow (2026 Enhanced Edition)

> **Principle: Report, Don't Auto-Fix.**
> This workflow provides visibility into security posture. It NEVER auto-patches.

---

## 🔒 Phase 1: Dependency Vulnerability Scan
// turbo
Run `npm audit --production` in frontend directory.

**Parse Output:**
- Count vulnerabilities by severity (Critical, High, Moderate, Low).
- List top 5 critical/high packages.

---

## 🔑 Phase 2: Secret Detection Scan
Search codebase for potential leaked secrets:
- API Keys: Pattern `[A-Za-z0-9_]{20,}`
- Supabase Keys: Pattern `eyJ...` (JWT format)
- Environment files checked: `.env*` NOT in `.gitignore`

---

## 📦 Phase 3: SBOM Check (Software Bill of Materials)
// turbo
Run `npm ls --all --json | Select-Object -First 50` to snapshot top dependencies.

---

## 🆕 Phase 4: React Compiler Security Audit (2026 Deep Research)

### 4.1 React Version Security Check
// turbo
Check React version: `npm list react react-dom`

**Known CVEs to Check:**
| CVE | Severity | Version Affected | Risk |
|:---|:---:|:---|:---|
| CVE-2025-55182 | 🔴 CRITICAL (10.0) | React 19.0.0 (RSC RCE) | Remote Code Execution |
| CVE-2025-55184 | 🟡 HIGH | React 19.x (RSC DoS) | Denial of Service |
| CVE-2025-55183 | 🟠 MEDIUM | React 19.x | Source Code Exposure |
| CVE-2026-21884 | 🟡 HIGH | react-router (SSR XSS) | Cross-Site Scripting |
| CVE-2026-22029 | 🟡 HIGH | react-router (Open Redirect) | XSS via Redirect |

**Safe Versions:** React 19.0.1+, 19.1.2+, 19.2.1+

### 4.2 Client-Side Injection (XSS) Patrol
Search for dangerous patterns:
```grep
Pattern: dangerouslySetInnerHTML
Risk: 🔴 HIGH - Must sanitize with DOMPurify
```

```grep
Pattern: innerHTML\s*=
Risk: 🔴 HIGH - Direct DOM manipulation
```

### 4.3 SSR Hydration Security Audit
Check for hydration attack vectors:
- `<ScrollRestoration>` with untrusted `getKey` or `storageKey`
- Loaders/actions creating redirects from untrusted content
- Server Components exposing sensitive data

### 4.4 Data Integrity Risk Matrix

| 風險類別 | 檢查項目 | 狀態 |
|:---|:---|:---:|
| **用戶資料流失風險** | localStorage 操作正確性 | ⬜ |
| **原有功能影響** | API 請求格式未變 | ⬜ |
| **前後端邏輯連接** | TypeScript 類型匹配 | ⬜ |
| **結構覆蓋風險** | 無直接 DOM 操作 | ⬜ |

### 4.5 Token Storage Security
Check authentication patterns:
```grep
Pattern: localStorage.setItem.*token|sessionStorage.setItem.*token
Risk: 🟡 HIGH - Prefer HttpOnly cookies
```

---

## 🔍 Phase 5: React Compiler Specific Checks

### 5.1 Pure Function Compliance
React Compiler requires pure, predictable code. Scan for:
- Side effects in render functions
- Mutable shared state outside React
- Non-deterministic outputs (Math.random, Date.now in render)

### 5.2 Server Component Boundaries
For apps using React Server Components:
- Verify `'use server'` directives are intentional
- Check that Server Functions don't expose sensitive logic
- Ensure proper input validation in Server Actions

---

## 📊 Phase 6: Generate Security Report
Create artifact: `security_report_{date}.md`

**Report Sections:**
1. **Executive Summary**: Pass/Fail status based on Critical count
2. **React Version Security**: CVE check results
3. **Vulnerability Table**: Package, Severity, Fixable?
4. **Secret Scan Results**: Filenames with potential leaks
5. **Data Integrity Matrix**: Risk assessment results
6. **XSS/Injection Audit**: Dangerous patterns found
7. **Recommendations**: Prioritized action items

---

## ⚠️ Critical Rules
- **DO NOT** run `npm audit fix --force`. Ever.
- **DO NOT** auto-modify `package.json`.
- **PAUSE** and notify user before any destructive action.
- **ALWAYS** report CVE findings immediately.

## [NEURAL] Neural Linkage
13. **Trigger Response**:
    - If Critical Vulnerabilities > 0: Trigger `/fix` workflow (ask user first).
    - If React Version Outdated: Trigger `/dep-upgrade` workflow.
    - Execute: `python backend/scripts/telemetry.py --source "Security Audit" --message "Audit completed. Critical: {CriticalCount}" --level "INFO"`

---

## 📋 2026 React Security Checklist

```markdown
### ✅ Must Check
- [ ] React version is patched (19.0.1+, 19.1.2+, or 19.2.1+)
- [ ] react-router version is patched (check for CVE-2026-21884)
- [ ] No dangerouslySetInnerHTML with unsanitized content
- [ ] No tokens in localStorage (use HttpOnly cookies)
- [ ] No Server Functions with unvalidated inputs

### ⚠️ Should Check
- [ ] DOMPurify used for any HTML rendering
- [ ] CSP headers configured properly
- [ ] CORS settings restrictive
- [ ] No sensitive data in client bundles

### 🔍 Deep Analysis
- [ ] Run npm audit --production
- [ ] Check for secret leaks
- [ ] Verify SSR hydration patterns safe
- [ ] Review Server Component boundaries
```
