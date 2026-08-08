---
name: "UI Component Generator"
description: "Generate standardized UI components with proper structure"
version: "1.0.0"
parameters:
  - name: componentName
    type: string
    required: true
  - name: template
    type: enum
    values: [basic, animated, interactive, form]
    default: basic
---

# UI Component Generator

## Quick Start

**Usage**: `/component <ComponentName> [template]`

**Templates**:
- `basic` - Simple presentational component
- `animated` - With Framer Motion animations
- `interactive` - With state management
- `form` - Form input component

## Execution Steps

### Step 1: Validate Component Name
- Must be PascalCase (e.g., `CircularProgress`)
- No existing component with same name

### Step 2: Determine Template
Ask user if not specified:
```
「請選擇組件模板:
1. basic - 簡單展示組件
2. animated - 含動畫效果
3. interactive - 含狀態管理
4. form - 表單輸入組件」
```

### Step 3: Generate Component
Read template from `{baseDir}/references/TEMPLATES.md`
Apply to `components/ui/<component-name>.tsx`

### Step 4: Verify
// turbo
Run `npx tsc --noEmit` to verify TypeScript

### Step 5: Report
```
「✅ 組件已建立:
  - 路徑: components/ui/<name>.tsx
  - 模板: <template>
  - TypeScript: PASS」
```

## When to Read References
- 完整模板程式碼 → `{baseDir}/references/TEMPLATES.md`
- 樣式指南 → `{baseDir}/references/STYLE_GUIDE.md`
- 進階用法 → `{baseDir}/references/ADVANCED.md`

## [NEURAL] Neural Linkage
6. **Signal Sentinel**:
   - Execute: `python backend/scripts/telemetry.py --source "Component Generator" --message "Component generated: {componentName}" --level "INFO"`
