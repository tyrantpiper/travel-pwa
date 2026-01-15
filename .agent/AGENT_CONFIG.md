# Ryan Travel App - Agent Configuration

> **This file is auto-read by the AI agent at the start of EVERY conversation.**
> It ensures consistent behavior across all sessions.

## 🏛️ L0 Constitution (Supreme Authority)
> **MUST READ**: `.agent/CONSTITUTION.md`
> Defines the immutable core principles: Safety First, Human Sovereignty, and Data Integrity.

## 🔒 Mandatory Workflow Triggers

### 🧠 Governor Layer (L3)
| Trigger | Workflow | Role |
|:---|:---|:---|
| Weekly / Meta-Analysis | `/sentinel-report` | **Sentinel**: Monitors system health & proposes evolution |

### 🛠️ Execution Layer (L1/L2)
The following workflows MUST be triggered based on context:

| Trigger Condition | Workflow | Command |
|-------------------|----------|---------|
| Any UI/styling work, **React Compiler** issues | `/audit` first | Read `.agent/workflows/audit.md` |
| Before any commit | `/test` | Read `.agent/workflows/test.md` |
| After changes complete | `/push` | Read `.agent/workflows/push.md` |
| Backend changes | `/regression-check` | Read `.agent/workflows/regression-check.md` |
| Bug fix work | `/fix` v2.0 | Read `.agent/workflows/fix.md` (w/ 2026 safety) |
| Security concerns, **React Compiler security**, 資料流失 | `/security-audit` | Read `.agent/workflows/security-audit.md` |
| Finding regressions | `/bisect-debug` | Read `.agent/workflows/bisect-debug.md` |
| Doc maintenance | `/doc-sync` | Read `.agent/workflows/doc-sync.md` |
| Performance issues | `/perf-profiler` | Read `.agent/workflows/perf-profiler.md` |
| UI Optimization | `/ui-optimize` | Read `.agent/workflows/ui-optimize.md` |
| **Code Review** | `/ai-review` | Read `.agent/workflows/ai-review.md` |
| **Dependency Upgrade** | `/dep-upgrade` | Read `.agent/workflows/dep-upgrade.md` |
| **Code Refactoring** | `/refactor` | Read `.agent/workflows/refactor.md` |
| **System Governance (L3)** | `/sentinel-report` | Read `.agent/workflows/sentinel-report.md` |
| **Migration Wizard** | `/migration-wizard` | Read `.agent/workflows/migration-wizard.md` |
| **Incident Response** | `/incident-playbook` | Read `.agent/workflows/incident-playbook.md` |

## 🎯 Skill Auto-Activation

| User Intent Keywords | Skill to Activate |
|---------------------|-------------------|
| "UI 優化", "效能", "audit", "dark mode" | `pwa-auditor` |
| "深色模式", "theme", "夜間" | `dark-mode-migrator` |
| "新功能", "full-stack", "建立功能" | `fullstack-builder` |
| "回歸", "regression", "broken" | `regression-guardian` |
| "元件", "component", "UI 元件" | `component-generator` |
| "優化 skill", "refine", "演化" | `skill-refiner` |
| "生成測試", "auto test" | `auto-test-gen` |
| "生成測試", "auto test" | `auto-test-gen` |
| "自動修復", "self heal", "fix build" | `self-healing-agent` |
| "debug", "root cause", "分析錯誤", "why broken" | `debug-detective` |

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
