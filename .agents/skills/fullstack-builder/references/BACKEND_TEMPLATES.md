# Backend Templates

## FastAPI Router Template

```python
# backend/routers/{{feature_name}}.py

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/{{feature-name}}", tags=["{{FeatureName}}"])

# ========== Models ==========

class {{FeatureName}}Request(BaseModel):
    """Request model for creating/updating {{FeatureName}}"""
    name: str
    # Add more fields as needed
    
class {{FeatureName}}Response(BaseModel):
    """Response model for {{FeatureName}}"""
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

# ========== In-Memory Storage (Replace with DB) ==========

_storage: dict[str, dict] = {}

# ========== Endpoints ==========

@router.get("", response_model=List[{{FeatureName}}Response])
async def get_all(x_user_id: Optional[str] = Header(None)):
    """Get all {{featureName}} items"""
    return list(_storage.values())

@router.get("/{id}", response_model={{FeatureName}}Response)
async def get_by_id(id: str):
    """Get single {{featureName}} by ID"""
    if id not in _storage:
        raise HTTPException(status_code=404, detail="{{FeatureName}} not found")
    return _storage[id]

@router.post("", response_model={{FeatureName}}Response)
async def create(data: {{FeatureName}}Request, x_user_id: Optional[str] = Header(None)):
    """Create new {{featureName}}"""
    now = datetime.utcnow()
    item = {
        "id": str(uuid.uuid4()),
        **data.dict(),
        "created_at": now,
        "updated_at": now,
        "created_by": x_user_id
    }
    _storage[item["id"]] = item
    return item

@router.patch("/{id}", response_model={{FeatureName}}Response)
async def update(id: str, data: {{FeatureName}}Request, x_user_id: Optional[str] = Header(None)):
    """Update existing {{featureName}}"""
    if id not in _storage:
        raise HTTPException(status_code=404, detail="{{FeatureName}} not found")
    
    _storage[id].update({
        **data.dict(exclude_unset=True),
        "updated_at": datetime.utcnow()
    })
    return _storage[id]

@router.delete("/{id}")
async def delete(id: str, x_user_id: Optional[str] = Header(None)):
    """Delete {{featureName}}"""
    if id not in _storage:
        raise HTTPException(status_code=404, detail="{{FeatureName}} not found")
    
    del _storage[id]
    return {"success": True}
```

## Register Router in main.py

```python
# backend/main.py

from routers import {{feature_name}}

# Add to existing app.include_router() calls
app.include_router({{feature_name}}.router)
```

## With Supabase Integration

```python
# backend/routers/{{feature_name}}.py (Supabase version)

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional
from supabase import create_client
import os

router = APIRouter(prefix="/api/{{feature-name}}", tags=["{{FeatureName}}"])

# Supabase client
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

@router.get("", response_model=List[{{FeatureName}}Response])
async def get_all(x_user_id: Optional[str] = Header(None)):
    """Get all {{featureName}} items from Supabase"""
    result = supabase.table("{{feature_name}}").select("*").execute()
    return result.data

@router.post("", response_model={{FeatureName}}Response)
async def create(data: {{FeatureName}}Request, x_user_id: Optional[str] = Header(None)):
    """Create new {{featureName}} in Supabase"""
    result = supabase.table("{{feature_name}}").insert({
        **data.dict(),
        "created_by": x_user_id
    }).execute()
    return result.data[0]
```
