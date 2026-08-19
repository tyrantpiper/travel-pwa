---
name: "Schema Contract Guard"
description: "Cross-stack type and schema synchronization guard. Validates consistency between Supabase PostgreSQL migrations, FastAPI Pydantic schemas, and Next.js TypeScript types."
version: "1.0.0"
triggers:
  - "/contract-check"
  - "schema sync"
  - "型別同步"
  - "資料庫型別"
  - "pydantic sync"
---

# Schema Contract Guard (Full-Stack Type Synchronizer)

## Purpose
Ensure zero-drift type safety across Tabidachi's full-stack architecture:
`Supabase PostgreSQL (DDL)` ⇄ `FastAPI (Pydantic v2)` ⇄ `Next.js 16 (TypeScript 5.9)`.

---

## 🏛️ Tri-Layer Contract Matrix

```
[Layer 1: Database]   backend/migrations/*.sql, Supabase RPC
       ▲
       │  (Mapping Validation)
       ▼
[Layer 2: Backend]    backend/models/*.py, backend/routers/*.py (Pydantic)
       ▲
       │  (API JSON Serialization)
       ▼
[Layer 3: Frontend]   frontend/types/*.ts, frontend/store/*.ts (TypeScript)
```

---

## 🔍 Validation Protocol

### Step 1: Scan Changed Data Models
When any file in `backend/models/`, `backend/migrations/`, or `frontend/types/` changes, identify the target domain:
- **Itinerary Domain**: `TripPlan`, `Destination`, `AIDayPlan`, `AIActivityItem` (Follow `CONTEXT.md` leading words).
- **Expense Domain**: `ExpenseRequest`, `ExpenseResponse`, `ExpenseItem`, `currency`, `exchange_rate`.
- **User Domain**: `UserProfile`, `UserPreferences`.

### Step 2: Cross-Check Field Attributes
Validate each field across the 3 layers:
1. **Naming Convention**:
   - DB: `snake_case` (e.g. `exchange_rate`, `created_at`).
   - Pydantic: `snake_case` with Field aliases if needed.
   - TypeScript: `camelCase` or matching API payload casing.
2. **Nullability & Optionals**:
   - `NULL` in SQL ⇄ `Optional[T] = None` in Pydantic ⇄ `T | null` / `T?` in TypeScript.
3. **Array & Nested Structures**:
   - JSONB / Array in DB ⇄ `List[SubModel]` in Pydantic ⇄ `SubModel[]` in TypeScript.
4. **Numeric Precision**:
   - `numeric / decimal` in DB ⇄ `float` / `Decimal` in Pydantic ⇄ `number` in TypeScript.

### Step 3: Run Verification Scripts
```powershell
# 1. Run backend Pydantic model serialization tests
pytest backend/tests/ -k "schema or model or type"

# 2. Run TypeScript compiler to ensure frontend types match API
cd frontend; npx tsc --noEmit; cd ..
```

### Step 4: Consistency Report Generation
Output a tri-layer matrix report showing:
- ✅ **Database DDL**: Matches migration state.
- ✅ **Pydantic Schema**: Validates input/output payloads.
- ✅ **Frontend TypeScript**: 0 `any` types, 100% strict type safety.

---

## 🧠 Neural Linkage
Execute telemetry signal:
```bash
python backend/scripts/telemetry.py --source "Schema Contract Guard" --message "Contract verified for: {modelName}" --level "INFO"
```
