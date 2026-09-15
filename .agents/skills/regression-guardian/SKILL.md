---
name: Regression Guardian
description: Autonomous skill to detect regressions, missing features, and structural integrity issues after code changes.
---

# Regression Guardian Skill

Execute strict regression checks after backend changes to ensure structural integrity.

## Capabilities

1. **Backend Integrity Check**:
   - Detects `NameError`, `ImportError`, and `SyntaxError` in Python modules.
   - Verifies all routers, models, and utility modules can be imported.
2. **Frontend Build Verification**:
   - Runs TypeScript compiler (`tsc`) to catch type mismatches.
   - Ensures API client signatures match backend endpoints.

## Instructions

### When to use
- After creating or modifying backend routers (`routers/*.py`).
- After changing database models (`models/*.py`).
- When the user reports "runtime error" or "missing functionality".
- Before pushing to `main` (Pre-flight check).

### How to use

**1. Run the Automated Health Check**
Use the `run_command` tool to execute the health check script:
```bash
python backend/scripts/health_check.py
```
*If this fails, STOP and fix the reported errors immediately.*

**2. Run the Full Regression Workflow**
For a comprehensive check including frontend and backend:
```powershell
# 呼叫統一大門 /test 工作流
# 檔案路徑: .agents/workflows/test.md
cd frontend; npx vitest run; cd ..
cd backend; pytest; cd ..
```

**3. Critical Seam Regression Checklist (關鍵縫隙回歸防線)**
- [ ] **Deep Linking & Filter Penetration**: 驗證 URL 深層參數傳入時，篩選器是否自動穿透且虛擬清單平滑尋址（`frontend/__tests__/deep-link-router.test.ts`）。
- [ ] **SWR 404 Silent Self-Healing**: 驗證死行程 ID 是否雙清自癒，合法行程是否雙重核驗絕不誤刪（`frontend/__tests__/self-healing-simulation.test.tsx`）。
- [ ] **Multi-Day Map & Great-Circle Geometry**: 驗證大圓航線球面插值演算法與天數色盤映射（`frontend/__tests__/multi-day-map.test.ts`）。
- [ ] **POI Lifespan & Backend Geocoding**: 驗證景點經緯度為空防禦與非同步保活連線池（`backend/tests/test_poi_lifespan.py`）。
- [ ] **Decoupled Button DOM**: 驗證卡片未嵌套 `<button>`。

## Resources
- Script: `backend/scripts/health_check.py`
- Workflow: `.agents/workflows/test.md`

## [NEURAL] Neural Linkage
4. **Signal Sentinel**:
   - Execute: `python backend/scripts/telemetry.py --source "Regression Guardian" --message "Check Status: {PASS/FAIL}" --level "INFO"`
