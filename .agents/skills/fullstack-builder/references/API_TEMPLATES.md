# API Templates

## Frontend API Client Template

```typescript
// lib/api.ts - Add to existing file

export interface {{FeatureName}}Request {
    // Define request fields
    name: string
    // Add more fields as needed
}

export interface {{FeatureName}}Response {
    id: string
    // Define response fields
    name: string
    created_at: string
    updated_at: string
}

export const {{featureName}}Api = {
    /**
     * Get all {{featureName}} items
     */
    getAll: async (): Promise<{{FeatureName}}Response[]> => {
        const res = await fetch(`${API_BASE}/api/{{feature-name}}`, {
            headers: {
                "X-User-ID": localStorage.getItem("user_uuid") || ""
            }
        })
        if (!res.ok) throw new Error("Failed to fetch {{featureName}}")
        return res.json()
    },

    /**
     * Get single {{featureName}} by ID
     */
    getById: async (id: string): Promise<{{FeatureName}}Response> => {
        const res = await fetch(`${API_BASE}/api/{{feature-name}}/${id}`)
        if (!res.ok) throw new Error("{{FeatureName}} not found")
        return res.json()
    },

    /**
     * Create new {{featureName}}
     */
    create: async (data: {{FeatureName}}Request): Promise<{{FeatureName}}Response> => {
        const res = await fetch(`${API_BASE}/api/{{feature-name}}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-ID": localStorage.getItem("user_uuid") || ""
            },
            body: JSON.stringify(data)
        })
        if (!res.ok) throw new Error("Failed to create {{featureName}}")
        return res.json()
    },

    /**
     * Update existing {{featureName}}
     */
    update: async (id: string, data: Partial<{{FeatureName}}Request>): Promise<{{FeatureName}}Response> => {
        const res = await fetch(`${API_BASE}/api/{{feature-name}}/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-User-ID": localStorage.getItem("user_uuid") || ""
            },
            body: JSON.stringify(data)
        })
        if (!res.ok) throw new Error("Failed to update {{featureName}}")
        return res.json()
    },

    /**
     * Delete {{featureName}}
     */
    delete: async (id: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/api/{{feature-name}}/${id}`, {
            method: "DELETE",
            headers: {
                "X-User-ID": localStorage.getItem("user_uuid") || ""
            }
        })
        if (!res.ok) throw new Error("Failed to delete {{featureName}}")
    }
}
```

## Placeholder Replacements

| Placeholder | Example | Description |
|-------------|---------|-------------|
| `{{FeatureName}}` | `Expense` | PascalCase |
| `{{featureName}}` | `expense` | camelCase |
| `{{feature-name}}` | `expense` | kebab-case (URL) |
| `{{feature_name}}` | `expense` | snake_case (Python) |
