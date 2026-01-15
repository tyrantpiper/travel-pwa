---
name: Debug Detective
description: AI-powered root cause analysis and anti-hallucination debugging agent.
triggers:
  - "debug"
  - "analyse bug"
  - "why is this broken"
  - "root cause"
---

# Debug Detective Skill

> **Goal**: Analyze bugs, verify symbols, and classify root causes **without executing code** (only static analysis).

## 🕵️ Capabilities

### 1. 🔍 Symbol Verifier (Anti-Hallucination)
Before suggesting any fix, verify if the variables, functions, or imports actually exist.
- Use `view_file` to read imports and definitions.
- Use `grep_search` to check usage.
- **Rule**: If a symbol is not found in the file or its imports, flag as **HALLUCINATION RISK**.

### 2. 🗺️ Trace Mapper
Map error stack traces to actual code locations.
- Read the file content at the specific line number from the stack trace.
- Identify the exact statement causing the error.

### 3. 🧠 Root Cause Analysis (RCA)
Classify the issue into one of:
- **TYPE**: `LOGIC`, `TYPE`, `SECURITY`, `PERFORMANCE`, `UI`
- **SEVERITY**: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- **CONFIDENCE**: 0.0 - 1.0 (Based on evidence found)

## 🔄 Workflow

1.  **Input Analysis**: Read error message / bug description.
2.  **Evidence Gathering**:
    - `view_file` target file.
    - `grep_search` related symbols.
3.  **Symbol Verification**: Check existence of key entities.
4.  **Hypothesis Generation**: Formulate theory (e.g., "Missing null check").
5.  **Validation**: Verify theory against code (e.g., "Is variable nullable?").
6.  **Report Generation**: Output JSON report.

## 📦 Output Format

Return a JSON-like report in Markdown:

```json
{
  "target_file": "path/to/file.ts",
  "root_cause": {
    "type": "LOGIC",
    "severity": "MEDIUM",
    "description": "Variable 'user' is possibly undefined."
  },
  "evidence": {
    "stack_trace_line": 42,
    "code_snippet": "return user.name;",
    "symbol_verification": {
      "user": "VERIFIED (Prop)",
      "name": "VERIFIED (String)"
    }
  },
  "hallucination_check": "PASSED",
  "confidence_score": 0.95,
  "recommended_fix_strategy": "Add optional chaining (user?.name)"
}
```

## ⚠️ Safety Protocols
- **Read-Only**: This skill DOES NOT modify code.
- **Fresh Context**: Always re-read files; do not assume previous context is valid.
- **Security First**: If `SECURITY` type, flag for human review (Confidence max 0.8).
