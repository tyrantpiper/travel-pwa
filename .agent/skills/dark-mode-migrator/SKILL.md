---
name: Dark Mode Migrator
description: Batch migration tool for adding dark mode support to React components
version: "1.0.0"
triggers:
  - "dark mode"
  - "深色模式"
  - "夜間模式"
  - "theme support"
---

# Dark Mode Migrator Skill

## Purpose
Systematically add dark mode support to React/Next.js components with minimal risk.

## When to Use
- When a component lacks `dark:` Tailwind classes
- Before launching to production
- When user requests theme support

## Color Mapping Reference

### Backgrounds
| Light Mode | Dark Mode |
|------------|-----------|
| `bg-white` | `dark:bg-slate-800` |
| `bg-stone-50` | `dark:bg-slate-900` |
| `bg-slate-50` | `dark:bg-slate-800` |
| `bg-slate-100` | `dark:bg-slate-700` |

### Text Colors
| Light Mode | Dark Mode |
|------------|-----------|
| `text-slate-900` | `dark:text-white` |
| `text-slate-800` | `dark:text-slate-100` |
| `text-slate-700` | `dark:text-slate-200` |
| `text-slate-600` | `dark:text-slate-300` |
| `text-slate-500` | `dark:text-slate-400` |
| `text-slate-400` | `dark:text-slate-500` |

### Borders
| Light Mode | Dark Mode |
|------------|-----------|
| `border-slate-100` | `dark:border-slate-700` |
| `border-slate-200` | `dark:border-slate-600` |
| `border-slate-300` | `dark:border-slate-500` |

### Gradients
```
from-slate-50 to-slate-100 → dark:from-slate-800 dark:to-slate-900
from-amber-50 to-orange-50 → dark:from-amber-900/20 dark:to-orange-900/20
from-indigo-50 to-purple-50 → dark:from-indigo-900/20 dark:to-purple-900/20
```

## Execution Steps

### Step 1: Identify Target Component
```bash
# List components without dark mode
grep -L "dark:" frontend/components/views/*.tsx
```

### Step 2: Analyze Current Classes
View the component and identify all hardcoded colors:
- `bg-white`, `bg-slate-*`, `bg-stone-*`
- `text-slate-*`, `text-gray-*`
- `border-slate-*`, `border-stone-*`

### Step 3: Apply Mappings
Use multi_replace_file_content to add dark: variants:

```tsx
// Before
className="bg-white text-slate-900"

// After
className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
```

### Step 4: Special Cases

#### Gradients
```tsx
// Before
className="bg-gradient-to-br from-slate-50 to-slate-100"

// After
className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900"
```

#### Inverted Buttons (Primary CTA)
```tsx
// Light: dark button on light bg
// Dark: light button on dark bg
className="bg-slate-900 dark:bg-white text-white dark:text-slate-900"
```

#### Amber/Highlight Colors
```tsx
// Use /30 or /50 opacity in dark mode
className="bg-amber-50 dark:bg-amber-900/30"
```

### Step 5: Verify
// turbo
Run `npx tsc --noEmit` to ensure no type errors

### Safety Rules
1. **Never remove existing classes** - only ADD dark: variants
2. **Test in browser** after each major component
3. **Preserve existing opacity values** - don't change `/50` to `/30` etc.
4. **Check contrast** - use browser DevTools dark mode

## Progress Tracking
```
📦 Dark Mode Migration: {ComponentName}
✅ Backgrounds migrated (X classes)
✅ Text colors migrated (Y classes)  
✅ Borders migrated (Z classes)
✅ TypeScript verified
```

## [NEURAL] Neural Linkage
6. **Signal Sentinel**:
   - Log to `.agent/telemetry/tool_usage.log`: "Dark Mode migration: {ComponentName}".
