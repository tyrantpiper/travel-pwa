---
name: "security-audit"
description: "Security vulnerability scanning, secret detection, and safe dependency upgrades"
triggers:
  - "/security-audit"
  - "安全"
  - "security"
  - "漏洞"
  - "升級依賴"
  - "dep upgrade"
  - "npm audit"
---

# Security Hardening & Dependency Upgrade Workflow (/security-audit)

> **Principle**: Report, Don't Blindly Fix. Patch First, Ask Before Major.

---

## Phase 1: Vulnerability & Secret Scanning

1. **Dependency Audit**:
   ```bash
   cd frontend; npm audit --production; cd ..
   ```
2. **Secret Leak Detection**:
   - Check `.env*` files are excluded in `.gitignore`.
   - Scan codebase for hardcoded API keys, JWT tokens (`eyJ...`), or Supabase service keys.
3. **API & CORS Hardening**:
   - Verify `backend/main.py` CORS does not allow `["*"]` in production.
   - Verify rate-limiting (`@limiter`) covers sensitive endpoints.

---

## Phase 2: Safe Dependency Upgrade Protocol (Absorbed)

When dependency vulnerabilities or outdated packages are identified:

4. **Outdated Scan & Categorization**:
   ```bash
   cd frontend; npm outdated --json; cd ..
   ```
   - 🟢 **Security & Patch Updates** ($X.Y.Z \to X.Y.Z+1$): Eligible for immediate upgrade.
   - 🟡 **Minor Updates** ($X.Y \to X.Y+1$): Require verification of non-breaking changes.
   - 🔴 **Major Updates** ($X \to X+1$): Require dedicated implementation plan.

5. **Upgrade Safety Valves**:
   - Backup `package-lock.json` before upgrade.
   - Run `npx tsc --noEmit` and `pytest backend/tests/` immediately after upgrade.
   - Generate rollback command if build breaks.

---

## Phase 3: Consolidated Security & Upgrade Report

6. **Generate Report Artifact**: Create `security_report_{date}.md` with:
   - Vulnerability Summary (Critical, High, Moderate)
   - Secret Scan Verdict (PASS / ALERT)
   - Recommended Dependency Upgrades (Risk-ranked table)

---

## [NEURAL] Neural Linkage
Execute telemetry signal:
```bash
python backend/scripts/telemetry.py --source "Security Audit" --message "Security audit and dep scan completed" --level "INFO"
```
