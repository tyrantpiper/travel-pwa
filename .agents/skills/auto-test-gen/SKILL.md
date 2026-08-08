---
name: Auto Test Generator
description: AI-powered automated test generation for React components and utilities
triggers:
  - "生成測試"
  - "auto test"
  - "generate test"
  - "測試覆蓋"
---

# Auto Test Generator Skill

> **Goal:** Increase test coverage by automatically generating valid, running tests.

## 📝 Process

1.  **Analyze Target**: Read component/function code to understand inputs, outputs, and side effects.
2.  **Plan Test Cases**: Identify:
    *   Happy paths (standard usage)
    *   Edge cases (null/undefined/empty)
    *   Error states
3.  **Generate Code**: Create `__tests__` file with Jest/Vitest/React Testing Library code.
4.  **Verify**: Run the generated test to ensure it passes.

## 🛠️ Usage

**Step 1: Identify Target**
Ask user for the target file (e.g., `frontend/lib/utils.ts`).

**Step 2: Generate Test Spec**
Create `[filename].test.ts` (or `.tsx`) in `__tests__` or adjacent `__tests__` folder.

**Step 3: Test Patterns**
- **Unit Tests**: For `lib/*.ts` utils.
- **Component Tests**: For `components/*.tsx` using `@testing-library/react`.
    - Mock API calls (msw or jest.mock)
    - Test user interactions (userEvent)
    - Verify rendered output (screen.getBy...)

## ⚠️ Guidelines

*   **Mock External Deps**: Always mock API calls, `next/navigation`, `next/image`.
*   **Test External Behavior**: Focus exclusively on user inputs -> screen outputs.
*   **Safety**: Prompt for confirmation before overwriting existing test files.
*   **Coverage**: Aim for 80% branch coverage on generated tests.

## 📦 Output
- New test file created.
- `npm test [file]` execution result.

## [NEURAL] Neural Linkage
- **Output Signal**: Trigger `/test` workflow automatically if confidence > 90%.
- **Telemetry**: Execute `python backend/scripts/telemetry.py --source "Auto Test Gen" --message "New Test Created" --level "INFO" --file evolution_history.log`
