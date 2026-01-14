---
name: "Skill Creator"
description: "Create new Agent Skills with proper structure"
version: "1.0.0"
parameters:
  - name: skillName
    type: string
    required: true
  - name: scope
    type: enum
    values: [workspace, global]
    default: workspace
---

# Skill Creator (Meta-Skill)

## Purpose
A Skill that creates other Skills with proper structure and best practices.

## Quick Start
**Usage**: Ask "幫我建立一個 Skill 來..."

## Execution Steps

### Step 1: Gather Requirements
Ask user:
1. 「這個 Skill 要解決什麼問題？」
2. 「適用範圍？(workspace / global)」
3. 「是否需要參考文件 (references/)？」
4. 「是否需要腳本 (scripts/)？」

### Step 2: Generate Skill Name
- Convert to kebab-case for directory
- Example: "UI Component Generator" → `ui-component-generator`

### Step 3: Create Directory Structure
```bash
.agent/skills/<skill-name>/
├── SKILL.md              # Main instructions
├── references/           # (if needed)
│   └── README.md
└── scripts/              # (if needed)
    └── README.md
```

### Step 4: Generate SKILL.md
Use template:
```yaml
---
name: "<Skill Name>"
description: "<AI-generated description>"
version: "1.0.0"
parameters:
  - name: ...
    type: ...
---

# <Skill Name>

## Quick Start
[Brief usage instructions]

## Execution Steps
[Numbered steps]

## When to Read References
[Progressive disclosure links]
```

### Step 5: Verify Structure
List created files and confirm with user

### Step 6: Test Skill
Ask user to try the new Skill

## Advanced Features

### Progressive Disclosure
For complex Skills, split into:
- SKILL.md (< 500 lines, core logic)
- references/EXAMPLES.md (detailed examples)
- references/ADVANCED.md (edge cases)

### Skill Chaining
```yaml
depends_on:
  - other-skill-name
```

### Dynamic Parameters
```yaml
parameters:
  - name: framework
    type: enum
    values: [react, vue, svelte]
```
