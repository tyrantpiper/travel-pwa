---
name: "Full-Stack Feature Builder"
description: "Build complete features using Adaptive System 2 Architecture"
version: "2.0.0"
depends_on:
  - component-generator
  - api-generator (inline)
  - test-generator (inline)
composition:
  - skill: component-generator
    output: component_path
  - skill: api-generator
    input: component_path
    output: api_path
  - skill: test-generator
    input: [component_path, api_path]
---

# Full-Stack Feature Builder (Adaptive System 2)

## Purpose
Build a complete feature from frontend to backend.
**System 2 Mode**: Automatically engages for complex tasks to ensure architectural robustness.

## Execution Flow

### Step 1: Triage Protocol (The Gatekeeper)
Analyze the user request to determine the execution path.

1. **Complexity Check**:
   - Is this a simple UI change or single component? -> **System 1 (Fast Track)**
   - Does it involve Database, API, or >2 files? -> **System 2 (Deep Mode)**

2. **Branching**:
   - **System 1**: Skip to [Step 3: Frontend Implementation].
   - **System 2**: Proceed to [Step 2: Architect Phase].

### Step 2: Phase 0 - Architect (System 2 Only)
*Objective: Prevent backtracking by planning first.*

1. **Context Load**: Read `references/SCHEMAS.md` (Section 1).
2. **Action**: Generate a `mini_design_doc` artifact.
   - Define: Component Hierarchy, API Endpoints, DB Schema.
3. **Approval**: Ask user: "是否同意此架構設計？" (Block until confirmed).

### Step 3: Phase 1 - Frontend Component
*Objective: Create the UI layer.*

1. **Execute Skill**: `component-generator`
   - Params: `componentName`, `toggled_features`
2. **Verify**: Ensure component exports match the Design Doc.

### Step 4: Phase 2 & 3 - API & Backend
*Objective: Connect the pipes.*

1. **Context Load**: Read `references/SCHEMAS.md` (Sections 2 & 3).
2. **Frontend API**: Create/Update `lib/api.ts` using the template.
3. **Backend Router**: Create `backend/routers/{feature_name}.py` using the template.
4. **Registration**: Add router to `main.py`.

### Step 5: Phase 4 - Verification & Safety Valve
*Objective: Robustness.*

1. **TypeScript Check**: `npx tsc --noEmit`
2. **Safety Valve (Self-Correction Loop)**:
   - **IF** error occurs:
     1. Read error log.
     2. Attempt fix (Max 2 retries).
     3. **IF** fails 2 times: **STOP**. Notify user with "Manual Intervention Required".
   - **DO NOT** blind-retry endlessly.

### Step 6: Neural Linkage
1. **Trigger**: `/doc-sync`
   - Msg: "Updating documentation for new feature: {FeatureName}"
2. **Telemetry**:
   - Log success to `.agent/telemetry/tool_usage.log`.

## Progress Tracking
```
📦 Feature: {FeatureName}
🚦 Mode: {System 1 | System 2}
✅ Phase 0: Design (System 2 only)
✅ Phase 1: Frontend
🔄 Phase 2: API & Backend
⏸️ Phase 3: Verification
```

## When to Read References
- **Schemas & Templates**: `references/SCHEMAS.md` (Load ONLY when needed)
