---
name: "UI Component Architect"
description: "Master-level UI component generator and dark mode architect. Enforces Tailwind CSS v4, Radix UI primitives, Framer Motion animations, a11y, and i18n standards."
version: "2.0.0"
triggers:
  - "/component"
  - "建立組件"
  - "元件建立"
  - "dark mode"
  - "深色模式"
  - "ui optimize"
parameters:
  - name: componentName
    type: string
    required: true
    description: "The PascalCase name of the component (e.g., ExpenseSummaryCard)"
  - name: template
    type: enum
    values: [basic, animated, interactive, form, modal]
    default: basic
---

# UI Component Architect

## Purpose
Systematically design, generate, and refactor React 19 / Next.js 16 UI components in Tabidachi. Enforces Tailwind CSS v4, Dark Mode compliance, Radix UI accessibility, Framer Motion micro-interactions, and i18n internationalization.

---

## 🏛️ Design System Standards (Tabidachi Gold Standard)

1. **Tailwind CSS v4 & Dark Mode**:
   - Always pair light mode classes with corresponding `dark:` variants.
   - Use CSS variables and theme tokens (e.g. `bg-white dark:bg-slate-900`, `text-slate-900 dark:text-slate-100`).
   - Retain semantic contrast and opacity ratios (`dark:bg-slate-800/80`).
2. **Accessibility & Touch Targets**:
   - Minimum interactive touch target: `44px x 44px` (`min-h-11 min-w-11`).
   - Proper ARIA attributes (`aria-expanded`, `aria-label`, `role`).
3. **Motion & Delight**:
   - Micro-animations via `framer-motion` (`initial`, `animate`, `exit`, `whileTap={{ scale: 0.98 }}`).
   - Respect user motion preferences (`prefers-reduced-motion`).
4. **Internationalization (i18n)**:
   - Zero hardcoded English/Chinese text strings in UI. All labels MUST consume translation dictionaries (`zh-TW`, `en`).

---

## 🎨 Dark Mode Color Mapping Reference

| Element | Light Mode | Dark Mode |
| :--- | :--- | :--- |
| **Surface / Card** | `bg-white` | `dark:bg-slate-900` / `dark:bg-slate-800` |
| **Subtle Canvas** | `bg-slate-50` / `bg-stone-50` | `dark:bg-slate-950` / `dark:bg-slate-900` |
| **Primary Text** | `text-slate-900` | `dark:text-slate-50` |
| **Secondary Text**| `text-slate-600` / `text-slate-500` | `dark:text-slate-400` |
| **Border / Divider**| `border-slate-200` / `border-stone-200` | `dark:border-slate-800` |
| **Input Surface** | `bg-slate-50 border-slate-200` | `dark:bg-slate-800 dark:border-slate-700` |
| **Highlight / Brand**| `bg-amber-50 text-amber-900` | `dark:bg-amber-950/40 dark:text-amber-300` |

---

## 🚀 Execution Workflow

### Step 1: Validate & Resolve Path
- Ensure component name is `PascalCase` (e.g. `TripPlanCard`).
- Standard target path: `frontend/components/ui/<kebab-name>.tsx` or `frontend/components/views/<kebab-name>.tsx`.
- Check if component already exists before creating.

### Step 2: Template Selection
Select from templates in `references/TEMPLATES.md`:
- `basic`: Presentational card / display component.
- `animated`: Framer motion enter/exit wrapper.
- `interactive`: Local state & callback dispatching.
- `form`: Accessible form control with react-hook-form / label / error slot.
- `modal`: Radix UI dialog / drawer with overlay transition.

### Step 3: Implement Code with Zero Compromise
- Inject `"use client"` directive when hooks/framer-motion are used.
- Import helper `cn` from `@/lib/utils`.
- Define explicit TypeScript interface for props (e.g. `{{ComponentName}}Props`).
- Ensure all interactive elements have keyboard listeners and accessible focus rings (`focus-visible:ring-2 focus-visible:ring-primary`).

### Step 4: Verification Gate
- Run `npx tsc --noEmit` from `frontend` directory.
- Verify 0 type errors.

---

## 🧠 Neural Linkage
Execute telemetry signal:
```bash
python backend/scripts/telemetry.py --source "UI Component Architect" --message "Component created/migrated: {componentName}" --level "INFO"
```
