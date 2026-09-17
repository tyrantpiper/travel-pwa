---
description: Smart commit and push with TypeScript quality check and GitHub MCP cloud synchronization
triggers:
  - "push"
  - "推送"
  - "commit"
  - "提交"
  - "git push"
---

> **架構守則**: 本地 `/push` 是負責全棧 Quality Gate、Neural Linkage 與 GitHub Cloud Synchronization 的發布管線。Commit Message 生成與 MCP 雲端協同指引委派給全域技能。
> **環境規範**: Windows PowerShell 嚴禁使用 `&&` 串接指令，必須使用確定性熔斷語法（`if ($LASTEXITCODE -ne 0) { exit 1 }`）確保錯誤立即中止。

## 1. Quality Gate (Pre-flight Fail-Fast Harness)
在推送前，必須循序執行並通過四大品質檢驗關卡。任何一項失敗，必須**立即終止**並向開發者回報，絕對禁止推進提交：

```powershell
# 1. 前端 TypeScript 靜態檢查 (0 錯誤)
cd frontend; npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { Write-Error "TypeScript Check Failed"; exit 1 }

# 2. 前端 ESLint 程式碼檢查 (0 錯誤、0 警告)
npm run lint; if ($LASTEXITCODE -ne 0) { Write-Error "ESLint Check Failed"; exit 1 }

# 3. 前端全量單元測試 (100% 通過)
npx vitest run; if ($LASTEXITCODE -ne 0) { Write-Error "Vitest Suite Failed"; exit 1 }
cd ..

# 4. 後端 Pytest 測試套件 (全數通過)
cd backend; pytest; if ($LASTEXITCODE -ne 0) { Write-Error "Backend Pytest Failed"; exit 1 }
cd ..
```

## 2. Delegation to Global Brain (Conventional Commit & Push)
2. **Execute Global Skill**: 讀取並執行 `~/.gemini/config/skills/git-pushing/SKILL.md`。
   - 委派全域技能分析差異、生成 Conventional Commit message。
   - 執行 `git add`、`git commit` 與 `git push`。

## 3. 🛡️ Safety Protocol (L1->L1 Mesh)
3. **Regression Check**: 
   - 參照 `.agents/skills/regression-guardian/SKILL.md` 確保關鍵縫隙（DeepLink 路由、SWR 404 自癒、多天航線幾何計算）無任何退化。

## 4. GitHub Cloud Synchronization (via @mcp:github-mcp-server)
4. **Cloud Hook Execution**:
   - 解析遠端倉庫：
     ```powershell
     $remoteUrl = git remote get-url origin
     # 相容 HTTPS 與 SSH 格式: git@github.com:owner/repo.git 或 https://github.com/owner/repo.git
     if ($remoteUrl -match 'github\.com[:/]([^/]+)/([^.]+)(?:\.git)?$') {
         $owner = $matches[1]
         $repo = $matches[2]
     }
     ```
   - 依據分支自適應同步：
     - **Feature 分支 (non-main)**:
       1. 檢查是否存在 PR: `call_mcp_tool("github-mcp-server", "list_pull_requests", { owner, repo, head: currentBranch })`
       2. 若無既存 PR，自動建立:
          ```json
          call_mcp_tool("github-mcp-server", "create_pull_request", {
            "owner": owner,
            "repo": repo,
            "title": commitTitle,
            "head": currentBranch,
            "base": "main",
            "body": "### Automated PR\n\n- Changes summary...\n- Pre-flight Quality Gate: 100% Passed (TS, Lint, Vitest, Pytest)"
          })
          ```
     - **Main 分支 (Direct Push)**:
       - 若對話、commit 或分支名稱中明確識別出 `#IssueID`（如 `#85`）：
         1. 留言通知: `call_mcp_tool("github-mcp-server", "add_issue_comment", { owner, repo, issue_number, body: "✅ 本次變更已直接推送至 main 分支並通過全棧 Quality Gate。" })`
         2. 標記關閉: `call_mcp_tool("github-mcp-server", "update_issue", { owner, repo, issue_number, state: "closed" })`
       - 若未提及任何 Issue，安靜跳過，不進行多餘干擾。
   - **容錯防線**: 若 GitHub MCP 調用失敗（如 Token 過期或網路超時），記錄 Warning 提示，絕不回滾本地代碼。

## 5. [NEURAL] Neural Linkage (Post-Flight)
5. **Signal Sentinel**:
   - 執行: `python backend/scripts/telemetry.py --source "Push" --message "Push and GitHub Sync completed" --level "INFO"`

