---
description: Smart commit and push with TypeScript quality check
triggers:
  - "push"
  - "推送"
  - "commit"
  - "提交"
  - "git push"
---

> **架構守則**: 本地 `/push` 是負責全棧 Quality Gate 與 Neural Linkage 的外殼。高智商的 Commit Message 生成將委派給全域技能。
> **環境規範**: Windows PowerShell 嚴禁使用 `&&` 串接指令，必須使用確定性熔斷語法（`if ($LASTEXITCODE -ne 0) { exit 1 }`）確保錯誤立即中止。

## 1. Quality Gate (Pre-flight Fail-Fast Harness)
在推送前，必須循序執行並通過四大品質檢驗關卡。任何一項失敗，必須**立即終止**並向開發者回報，絕對禁止推進提交：

```powershell
# 1. 前端 TypeScript 靜態檢查 (0 錯誤)
cd frontend; npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { Write-Error "TypeScript Check Failed"; exit 1 }

# 2. 前端 ESLint 程式碼檢查 (0 錯誤、0 警告)
npm run lint; if ($LASTEXITCODE -ne 0) { Write-Error "ESLint Check Failed"; exit 1 }

# 3. 前端全量單元測試 (161 tests 100% 通過)
npx vitest run; if ($LASTEXITCODE -ne 0) { Write-Error "Vitest Suite Failed"; exit 1 }
cd ..

# 4. 後端 Pytest 測試套件 (全數通過)
cd backend; pytest; if ($LASTEXITCODE -ne 0) { Write-Error "Backend Pytest Failed"; exit 1 }
cd ..
```

## 2. Delegation to Global Brain
2. **Execute Global Skill**: 讀取並執行 `~/.gemini/config/skills/git-pushing/SKILL.md`。
   - 委派全域技能生成 Conventional Commit message、執行 `git add`、`git commit` 與 `git push`。

## 3. 🛡️ Safety Protocol (L1->L1 Mesh)
3. **Regression Check**: 
   - 參照 `.agents/skills/regression-guardian/SKILL.md` 確保關鍵縫隙（DeepLink 路由、SWR 404 自癒、多天航線幾何計算）無任何退化。

## 4. [NEURAL] Neural Linkage (Post-Flight)
4. **Signal Sentinel**:
   - 執行: `python backend/scripts/telemetry.py --source "Push" --message "Push completed" --level "INFO"`
