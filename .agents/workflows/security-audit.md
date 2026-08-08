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
> This workflow provides visibility into security posture. It operates in a strict read-only reporting mode.

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

## 🌐 Phase 3.5: API Security Hardening

Check backend API security posture:

### 3.5.1 CORS Configuration
Search `backend/main.py` for CORS middleware:
- Verify `allow_origins` is NOT `["*"]` in production
- Confirm only explicitly listed domains

### 3.5.2 Rate Limiting Coverage
// turbo
Run `Select-String -Path "backend/routers/*.py" -Pattern "@limiter" | Measure-Object | Select-Object Count` to count rate-limited endpoints.

Cross-reference with total endpoint count:
// turbo
Run `Select-String -Path "backend/routers/*.py" -Pattern "@router\.(get|post|put|delete|patch)" | Measure-Object | Select-Object Count`

**Flag**: Any unprotected public endpoint as 🟡 HIGH risk.

### 3.5.3 Authentication Header Validation
Search for BYOK API key handling:
- Verify `X-API-Key` or `Authorization` header is validated
- Confirm no endpoint bypasses auth without explicit `public=True`

### 3.5.4 Error Response Sanitization
Ensure error responses are properly sanitized:
- Stack traces to client
- Internal file paths
- Database connection strings

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
- Check that Server Functions securely encapsulate sensitive logic
- Ensure proper input validation in Server Actions

---

## 🎯 Phase 5.5: Injection & SSRF Scan

### 5.5.1 SQL Injection Detection
Search for string-interpolated SQL (Python backend):
```grep
Pattern: f".*SELECT|f".*INSERT|f".*UPDATE|f".*DELETE
Risk: 🔴 CRITICAL - String interpolation in SQL queries
Fix: Use parameterized queries or Supabase client
```

### 5.5.2 SSRF Protection Verification
Verify all external URL access goes through safety checks:
```grep
Pattern: httpx\.(get|post|put|delete)\(
Files: backend/**/*.py
```

For each match, verify it either:
- Uses `utils/url_safety.py` validation, OR
- Targets a hardcoded, trusted domain (e.g., `api.openai.com`)

**Flag**: Any `httpx` call without URL validation as 🔴 CRITICAL.

### 5.5.3 Command Injection Check
Search for shell execution patterns:
```grep
Pattern: subprocess\.|os\.system\(|os\.popen\(
Risk: 🔴 CRITICAL - Potential command injection
```

### 5.5.4 Path Traversal Check
Search for user-controlled file path access:
```grep
Pattern: open\(.*request|Path\(.*request
Risk: 🟡 HIGH - Potential path traversal
```

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
7. **API Security Posture**: CORS, Rate Limiting, Auth coverage
8. **Injection & SSRF Scan**: SQL injection, SSRF, command injection findings
9. **Red-Team Summary**: 5-category threat assessment
   - Direct Prompt Injection risk: LOW/MED/HIGH
   - Indirect Prompt Injection risk: LOW/MED/HIGH
   - Information Extraction risk: LOW/MED/HIGH
   - Tool Abuse risk: LOW/MED/HIGH
   - Goal Hijacking risk: LOW/MED/HIGH
10. **Recommendations**: Prioritized action items

---

## ⚠️ Critical Rules
- Execute `npm audit` purely for reporting.
- Leave modifications to the user for `package.json`.
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
