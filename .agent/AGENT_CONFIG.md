# Ryan Travel App - Agent Configuration

> **This file is auto-read by the AI agent at the start of EVERY conversation.**
> It ensures consistent behavior across all sessions.

## 🔒 Mandatory Workflow Triggers

The following workflows MUST be triggered based on context:

| Trigger Condition | Workflow | Command |
|-------------------|----------|---------|
| Any UI/styling work | `/audit` first | Read `.agent/workflows/audit.md` |
| Before any commit | `/test` | Read `.agent/workflows/test.md` |
| After changes complete | `/push` | Read `.agent/workflows/push.md` |
| Backend changes | `/regression-check` | Read `.agent/workflows/regression-check.md` |
| Bug fix work | `/fix` | Read `.agent/workflows/fix.md` |
| Security concerns | `/security-audit` | Read `.agent/workflows/security-audit.md` |
| Finding regressions | `/bisect-debug` | Read `.agent/workflows/bisect-debug.md` |
| Doc maintenance | `/doc-sync` | Read `.agent/workflows/doc-sync.md` |

## 🎯 Skill Auto-Activation

| User Intent Keywords | Skill to Activate |
|---------------------|-------------------|
| "UI 優化", "效能", "audit", "dark mode" | `pwa-auditor` |
| "深色模式", "theme", "夜間" | `dark-mode-migrator` |
| "新功能", "full-stack", "建立功能" | `fullstack-builder` |
| "回歸", "regression", "broken" | `regression-guardian` |
| "元件", "component", "UI 元件" | `component-generator` |
| "優化 skill", "refine", "演化" | `skill-refiner` |

## 📋 Pre-Task Checklist

Before starting ANY coding task:
1. ☐ Identify which Skills/Workflows apply
2. ☐ Read the relevant SKILL.md files
3. ☐ Plan execution according to Skill instructions

## ⚙️ Project Context

- **Framework**: Next.js 15 + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 (with dark mode via `.dark` class)
- **Backend**: FastAPI + Supabase
- **PWA**: Full offline support, service worker enabled
- **Theme**: User-selectable accent colors via ThemeContext

## 🚨 Critical Rules

1. **Always run `/test` before `/push`**
2. **Use `pwa-auditor` skill for any styling work**
3. **Never skip TypeScript verification**
4. **Check dark mode compatibility for all UI changes**

## 📁 Key Paths

- Skills: `.agent/skills/`
- Workflows: `.agent/workflows/`
- Frontend: `frontend/`
- Backend: `backend/`
- This config: `.agent/AGENT_CONFIG.md`
