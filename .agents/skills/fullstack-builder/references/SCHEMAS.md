# Full-Stack Feature Schemas

> **Context Economy Reference**
> Loaded only when needed by `fullstack-builder`.

## 1. Feature Design Document (Phase 0)
Required for "Deep Mode" (System 2) execution.

```markdown
# Design: {FeatureName}

## 1. Architecture
- **Frontend**: [Components list]
- **State**: [Zustand/Context?]
- **API**: [Endpoints list]
- **DB**: [Schema changes?]

## 2. Data Flow
[Mermaid Diagram or Text Description]

## 3. Risk Analysis
- [ ] Auth required?
- [ ] Performance impact?
```

## 2. API Method Template (Phase 2)
Standardized pattern for `frontend/lib/api.ts`.

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

## 3. Backend Router Template (Phase 3)
Standardized pattern for `backend/routers/{feature_name}.py`.

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/{feature-name}", tags=["{FeatureName}"])

class {FeatureName}Request(BaseModel):
    name: str

@router.get("")
async def get_all():
    return []

@router.post("")
async def create(data: {FeatureName}Request):
    return {"id": "new-id", **data.dict()}
```
