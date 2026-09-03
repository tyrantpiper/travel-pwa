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

## Phase 1: Vulnerability & Secret Scanning (tools-hub Powered)

1. **Dependency Audit**:
   ```bash
   cd frontend; npm audit --production; cd ..
   ```
2. **Verified Secret Leak Detection (`trufflehog_scan`)**:
   - 執行活體憑證掃描，排除 `node_modules` 與暫存區，精準捕捉已驗證之高危洩漏：
     `trufflehog_scan(path="frontend/app", only_verified=true)`
     `trufflehog_scan(path="backend", only_verified=true)`
     `trufflehog_scan(path="docs", only_verified=true)`
   - 檢查 `.env*` 檔案皆已包含於 `.gitignore`。
3. **AST Sensitive Call Audit (`ast_grep_search`)**:
   - 掃描是否有硬編碼密鑰或非法的危險代碼執行：
     `ast_grep_search(lang="typescript", path="frontend", pattern="process.env.SUPABASE_SERVICE_ROLE_KEY")`
     `ast_grep_search(lang="python", path="backend", pattern="eval($$$ARGS)")`
4. **API & CORS Hardening**:
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
