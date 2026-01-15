---
description: AI-powered deep code review with actionable insights
triggers:
  - "AI審查"
  - "ai review"
  - "code review"
  - "深度審查"
  - "代碼審查"
---

# AI Deep Code Review Workflow

> **Principle: Report Only, Never Auto-Fix.**
> This workflow provides analysis and suggestions. It NEVER modifies code directly.

---

## Step 1: Scope Definition
1. Ask user: "請指定審查範圍：檔案路徑、變更差異 (git diff)、或功能模組？"

## Step 2: Code Analysis
// turbo
2. If reviewing changes, run: `git diff --stat HEAD~1`

3. Read the target files/changes

## Step 3: Multi-Dimensional Review

### 3.1 Security Analysis
Check for:
- 🔴 XSS vulnerabilities (dangerouslySetInnerHTML)
- 🔴 SQL injection patterns
- 🔴 Hardcoded secrets/credentials
- 🟡 Unsafe data handling
- 🟡 Missing input validation

### 3.2 Performance Analysis
Check for:
- 🔴 N+1 query patterns
- 🔴 Memory leaks (missing cleanup)
- 🟡 Unnecessary re-renders
- 🟡 Large bundle imports
- 🟢 Optimization opportunities

### 3.3 Code Quality Analysis
Check for:
- 🔴 Dead code / unreachable paths
- 🟡 Duplicated logic
- 🟡 Magic numbers / hardcoded strings
- 🟢 Naming conventions
- 🟢 TypeScript strictness

### 3.4 React Compiler Compatibility
Check for:
- 🔴 setState in useEffect (non-SSR patterns)
- 🟡 Mutating props/state directly
- 🟡 Non-pure render functions
- 🟢 Manual useMemo/useCallback (may be redundant)

### 3.5 Architecture Analysis
Check for:
- 🔴 Circular dependencies
- 🟡 God components (> 500 lines)
- 🟡 Missing error boundaries
- 🟢 Separation of concerns

---

## Step 4: Generate Review Report

Create artifact: `code_review_{date}.md`

**Report Format:**

```markdown
# AI Code Review Report

## 📊 Summary
- Files Reviewed: X
- Issues Found: X (Critical: X, High: X, Medium: X, Low: X)
- Confidence Score: X%

## 🔴 Critical Issues
| File | Line | Issue | Suggestion | Confidence |
|:---|:---:|:---|:---|:---:|

## 🟡 Improvements
| File | Line | Issue | Suggestion | Confidence |

## 🟢 Best Practices
| File | Line | Issue | Suggestion | Confidence |

## 📋 Action Items (Prioritized)
1. [CRITICAL] ...
2. [HIGH] ...
3. [MEDIUM] ...
```

---

## ⚠️ Critical Rules
- **NEVER** auto-fix any issues
- **ALWAYS** include confidence score (0-100%)
- **ALWAYS** cite source/reason for each suggestion
- **FLAG** low-confidence suggestions clearly
- **PAUSE** if > 20 critical issues found

## [NEURAL] Neural Linkage
8. **Signal Sentinel**:
   - Log review to `.agent/telemetry/tool_usage.log`: "AI Review completed ({N} issues found)".
