---
name: "Full-Stack Feature Builder"
description: "Build complete features by chaining multiple Skills"
version: "1.0.0"
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

# Full-Stack Feature Builder (Skill Chaining)

## Purpose
Build a complete feature from frontend to backend in one command.

**Usage**: "建立完整的 [功能名稱] 功能"

## Execution Flow

```
┌─────────────────────┐
│ Phase 1: Frontend   │
│ (component-generator)│
└──────────┬──────────┘
           │ output: component_path
           ▼
┌─────────────────────┐
│ Phase 2: API        │
│ (api-generator)     │
└──────────┬──────────┘
           │ output: api_path
           ▼
┌─────────────────────┐
│ Phase 3: Backend    │
│ (backend router)    │
└──────────┬──────────┘
           │ output: router_path
           ▼
┌─────────────────────┐
│ Phase 4: Test       │
│ (test-generator)    │
└─────────────────────┘
```

## Step 1: Gather Requirements
Ask user:
1. 「功能名稱是什麼？」(e.g., "Expense Tracker")
2. 「需要哪些層級？」
   - [ ] Frontend Component
   - [ ] API Endpoint
   - [ ] Backend Router
   - [ ] Tests

## Step 2: Phase 1 - Frontend Component
```
執行 Skill: component-generator
參數:
  - componentName: {FeatureName}
  - template: interactive (預設)

輸出：
  - component_path: components/ui/{feature-name}.tsx
```

Progress: `✅ Phase 1: Frontend (完成)`

## Step 3: Phase 2 - Frontend API Client
在 `lib/api.ts` 新增 API 方法：

```typescript
// {featureName}Api
export const {featureName}Api = {
  getAll: async () => {
    const res = await fetch(`${API_BASE}/api/{feature-name}`)
    return res.json()
  },
  create: async (data: {FeatureName}Request) => {
    const res = await fetch(`${API_BASE}/api/{feature-name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
    return res.json()
  },
  update: async (id: string, data: Partial<{FeatureName}Request>) => {
    const res = await fetch(`${API_BASE}/api/{feature-name}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
    return res.json()
  },
  delete: async (id: string) => {
    await fetch(`${API_BASE}/api/{feature-name}/${id}`, { method: "DELETE" })
  }
}
```

Progress: `✅ Phase 2: API Client (完成)`

## Step 4: Phase 3 - Backend Router
在 `backend/routers/` 新增 Python router：

```python
# backend/routers/{feature_name}.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/{feature-name}", tags=["{FeatureName}"])

class {FeatureName}Request(BaseModel):
    # 根據需求定義欄位
    name: str
    # ...

@router.get("")
async def get_all():
    # TODO: Implement
    return []

@router.post("")
async def create(data: {FeatureName}Request):
    # TODO: Implement
    return {"id": "new-id", **data.dict()}

@router.patch("/{id}")
async def update(id: str, data: {FeatureName}Request):
    # TODO: Implement
    return {"id": id, **data.dict()}

@router.delete("/{id}")
async def delete(id: str):
    # TODO: Implement
    return {"success": True}
```

**Register in main.py**:
```python
from routers import {feature_name}
app.include_router({feature_name}.router)
```

Progress: `✅ Phase 3: Backend Router (完成)`

## Step 5: Phase 4 - Verification
// turbo
Run `npx tsc --noEmit` to verify TypeScript

Progress: `✅ Phase 4: Verification (完成)`

## Error Handling
如果任何階段失敗：
1. 紀錄失敗點
2. 顯示已完成的階段
3. 提供修復建議
4. 詢問是否重試該階段

## Progress Tracking
使用以下格式顯示進度：
```
📦 Building Feature: {FeatureName}
✅ Phase 1: Frontend Component (完成)
✅ Phase 2: API Client (完成)
🔄 Phase 3: Backend Router (執行中...)
⏸️ Phase 4: Verification (等待中)
```

## When to Read References
- 完整 API 模板 → `{baseDir}/references/API_TEMPLATES.md`
- Backend 模板 → `{baseDir}/references/BACKEND_TEMPLATES.md`
- 測試模板 → `{baseDir}/references/TEST_TEMPLATES.md`
