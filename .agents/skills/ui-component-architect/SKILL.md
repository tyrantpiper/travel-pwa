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
5. **WebKit 匿名文本溢出防擠壓 (Text-Node Isolation)**:
   - 在 Flex 容器（`flex items-center`）中，若包含同級 Badge / Button，動態文字**必須封裝於獨立的 `<span className="truncate">`**，嚴禁直接裸放文字於帶有 `truncate` 的父級 Flex 容器中。同級標籤/按鈕必須宣告 `shrink-0`。
6. **解耦按鈕 DOM 架構 (Decoupled Button DOM Architecture)**:
   - HTML5 嚴禁 `<button>` 嵌套 `<button>`。卡片操作列按鈕（如刪除、PDF、編輯）與卡片本體點擊區域，必須在 DOM 結構中解耦為同級 Sibling 節點，杜絕事件冒泡衝突與合法性違規。
7. **WebGL Canvas 與浮動手勢硬體隔離 (Hardware Compositing)**:
   - 跨越 WebGL Canvas 的可拖曳浮動節點（如 `chat-widget` 圓球），必須使用 `transform-gpu` 與動態 `willChange: isDragging ? "right, bottom" : "auto"`，地圖容器宣告 `transform-gpu will-change-transform`，阻斷拖曳時觸發主執行緒 Reflow 重繪 WebGL。
8. **虛擬列表篩選穿透與 Ref 尋址 (Filter Penetration on Deep Link)**:
   - 虛擬化列表（React Virtuoso）項目未渲染至 DOM 時，嚴禁直接使用 `document.getElementById(...).scrollIntoView()`。必須調用 `virtuosoRef.current.scrollToIndex`，且尋址前必須先重置衝突的 UI 篩選器（Filter Reset）。
9. **觸控防護與輸入法選字防禦 (Touch Guards & IME Composition)**:
   - 行動端按鈕一律提供 `active:scale-95` 觸覺回彈；多行文字輸入框必須在 `onKeyDown` 檢查 `if (e.nativeEvent.isComposing) return`，防止 CJK 注音/拼音選字時提前觸發發送。

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
