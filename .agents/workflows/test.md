---
name: "test"
description: "Unified testing and verification gateway (Static Quality, Full Regression, and Git Bisect)"
triggers:
  - "/test"
  - "測試"
  - "test"
  - "驗證"
  - "verify"
  - "回歸測試"
  - "bisect"
---

# Unified Testing Gateway (/test)

> **Role**: Quality & Regression Guardian.
> **Standard**: Zero compromise on type safety (`tsc --noEmit` 0 errors) and backend test passing.

---

## 🎯 Execution Modes

### Mode 1: Standard Static Quality Gate (Default)
Run before every commit or pull request:
1. **Frontend Type & Lint Check**:
   ```bash
   cd frontend
   npx tsc --noEmit
   npx eslint . --ext .ts,.tsx --quiet
   cd ..
   ```
2. **Backend Unit & API Test**:
   ```bash
   pytest backend/tests/
   ```

---

### Mode 2: Deep Regression Check (`/test --regression`)
Triggered after major backend/frontend architectural refactors:
1. **Read & Execute Regression Guardian**:
   - Inspect `.agents/skills/regression-guardian/SKILL.md`.
2. **Execute Full Suite**:
   ```bash
   pytest backend/tests/ -v
   cd frontend; npm test; cd ..
   ```
3. **Verify Critical Seams**:
   - POI Lifespan & CJK search
   - Currency & Expense calculation
   - Supabase Auth & RLS token exchange

---

### Mode 3: Automated Bisect Debugging (`/test --bisect`)
Triggered when hunting when a specific bug was introduced:
1. **Flakiness Pre-check**: Run target test command 3 times at `HEAD` to confirm determinism.
2. **Initialize Git Bisect**:
   ```bash
   git bisect start
   git bisect bad HEAD
   git bisect good <known_good_commit>
   git bisect run <test_command>
   ```
3. **Report Culprit & Reset**:
   - Show first-bad commit summary.
   - Run `git bisect reset`.

---

## [NEURAL] Neural Linkage
Execute telemetry signal:
```bash
python backend/scripts/telemetry.py --source "Test Gateway" --message "Test suite executed" --level "INFO"
```
