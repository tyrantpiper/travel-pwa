---
description: Safe dependency upgrade with security-first approach
triggers:
  - "升級依賴"
  - "dependency upgrade"
  - "dep upgrade"
  - "npm update"
  - "安全補丁"
---

# Safe Dependency Upgrade Workflow

> **Principle: Patch First, Ask Before Major.**
> Security patches auto-upgrade. Minor/Major require explicit approval.

---

## 🛡️ Safety Valves

```yaml
limits:
  auto_upgrade: "patch only"
  require_approval: ["minor", "major"]
  require_planning: ["major"]
  max_packages_per_run: 10
  
mandatory:
  backup_lockfile: true
  run_tests_after: true
  generate_rollback: true
```

---

## Step 1: Scan Outdated Dependencies
// turbo
1. Run `npm outdated --json` to get current state

2. Parse and categorize:
   - 🔴 **Security Patches**: npm audit findings
   - 🟢 **Patch Updates**: X.Y.Z → X.Y.Z+1
   - 🟡 **Minor Updates**: X.Y → X.Y+1
   - 🔴 **Major Updates**: X → X+1

## Step 2: Security Audit
// turbo
3. Run `npm audit --json` to identify vulnerable packages

4. Cross-reference with outdated list

## Step 3: Generate Upgrade Plan

Create table:
| Package | Current | Latest | Type | Security? | Risk | Action |
|:---|:---|:---|:---|:---:|:---:|:---|
| lodash | 4.17.20 | 4.17.21 | patch | ✅ | 🟢 | Auto |
| react | 19.0.0 | 19.1.0 | minor | ❌ | 🟡 | Ask |
| next | 14.0.0 | 15.0.0 | major | ✅ | 🔴 | Plan |

## Step 4: Backup Before Upgrade
// turbo
4. Run: `Copy-Item package-lock.json package-lock.backup.json`

## Step 5: Execute Upgrades (By Category)

### 5.1 Security Patches (Auto)
// turbo
```powershell
# Only if user approves
npm update [package1] [package2] --save-exact
```

### 5.2 Minor Updates (Ask First)
5. **PAUSE**: Ask user "以下 minor 更新是否執行？" with package list

### 5.3 Major Updates (Require Planning)
6. **PAUSE**: Generate migration plan before any major update
   - Breaking changes analysis
   - Required code changes
   - Testing strategy

## Step 6: Verify After Upgrade
// turbo
7. Run `npm run lint` to check for issues

// turbo
8. Run `npx tsc --noEmit` to verify TypeScript

// turbo
9. Run `npm run build` to ensure build succeeds

## Step 7: Generate Report

Create artifact: `dep_upgrade_report_{date}.md`

```markdown
# Dependency Upgrade Report

## 📊 Summary
- Packages Scanned: X
- Security Patches Applied: X
- Minor Updates: X (pending approval)
- Major Updates: X (requires planning)

## ✅ Applied Changes
| Package | From | To | Type |
|:---|:---|:---|:---|

## ⏳ Pending Approval
| Package | From | To | Type | Risk |

## 🔄 Rollback Command
\`\`\`powershell
Copy-Item package-lock.backup.json package-lock.json
npm ci
\`\`\`
```

---

## ⚠️ Critical Rules
- **NEVER** run `npm audit fix --force`
- **ALWAYS** backup package-lock.json first
- **ALWAYS** run tests after upgrade
- **NEVER** auto-upgrade major versions
- **PAUSE** if > 5 security issues found

## [NEURAL] Neural Linkage
9. **Chain Reaction**:
   - If upgrades successful: Trigger `/test` (Regression Check).
   - If security patches applied: Trigger `/security-audit` (Verification).
   - Execute: `python backend/scripts/telemetry.py --source "Dep Upgrade" --message "Upgrade Batch Completed" --level "INFO"`
