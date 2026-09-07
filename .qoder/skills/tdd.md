# TDD Workflow for Ads Pro Enterprise

## When to use

Use this skill for every non-trivial code change: new features, bug fixes, refactors that change behavior, and hook/component additions.

## Workflow

1. **Understand the change** from the issue/PRD, `CONTEXT.md`, and existing code.
2. **Write the failing test first** (Red). It should express the desired behavior, not the implementation.
3. **Run the test to confirm it fails** for the right reason.
4. **Write the minimum code to pass** (Green).
5. **Refactor** while keeping tests green.
6. **Run the full relevant test suite** before finishing.

## Project conventions

- Test runner: Jest via `next/jest`.
- DOM utilities: `@testing-library/react`, `@testing-library/jest-dom`.
- Test locations:
  - `src/**/__tests__/*.{test,spec}.{ts,tsx}` (preferred for components/hooks)
  - `src/**/*.{test,spec}.{ts,tsx}` (for utilities)
  - `tests/**/*.{ts,tsx}` (for integration/e2e-style tests)
- Imports use `@/` aliases.
- The setup file at `src/test-utils/jest.setup.js` already mocks `IntersectionObserver`, `ResizeObserver`, `matchMedia`, `WebSocket`, and Supabase env vars.

## Red phase

- Name the test after the behavior, e.g. `shows optimization result after optimize completes`.
- Use `describe` blocks to group by component/function and `it` blocks for each behavior.
- For UI: render the component, interact as a user would, assert on visible outcomes.
- For hooks: use `renderHook` from `@testing-library/react` and assert on returned values/effects.
- For utilities: test pure inputs/outputs and edge cases.
- Mock external boundaries: tRPC (`api`), Supabase, fetch, WebSocket, AI providers. Do not mock the unit under test.

## Green phase

- Write the smallest change that makes the test pass.
- Do not worry about elegance yet.
- If a test is too hard to pass, the test may be wrong; reconsider the assertion.

## Refactor phase

- Remove duplication, improve names, split large functions.
- Run tests after each refactor.
- Do not add new behavior during refactor.

## Coverage policy

- New behavior should have tests.
- Do not chase 100% coverage, but do cover:
  - Happy path
  - Empty/error states
  - User interactions
  - Async completion and failure
- Existing thresholds in `jest.config.js` must not drop.

## Commands

```bash
# Run tests for the file you are changing
npx jest src/path/to/file.test.tsx --watch

# Run tests once for affected areas
npx jest src/hooks/__tests__/use-ai-agents.test.tsx src/components/ai/__tests__/ai-analysis-panel.test.tsx --no-coverage

# Type-check before finishing
npx tsc --noEmit

# Run full test suite
npm test
```

## Common patterns

### Testing a component with tRPC

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '@/lib/trpc/client'
import { CampaignOptimizer } from '@/components/ai/campaign-optimizer'

jest.mock('@/lib/trpc/client', () => ({
  api: {
    ai: {
      optimizeCampaign: {
        useMutation: jest.fn(() => ({
          mutate: jest.fn(),
          isPending: false,
          data: undefined,
        })),
      },
    },
  },
}))

describe('CampaignOptimizer', () => {
  it('calls optimize when the button is clicked', async () => {
    const mutate = jest.fn()
    ;(api.ai.optimizeCampaign.useMutation as jest.Mock).mockReturnValue({
      mutate,
      isPending: false,
      data: undefined,
    })

    render(<CampaignOptimizer campaignId="camp_123" />)
    await userEvent.click(screen.getByRole('button', { name: /optimize/i }))

    expect(mutate).toHaveBeenCalledWith({ campaignId: 'camp_123' })
  })
})
```

### Testing a hook

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { useCampaignAnalysis } from '@/hooks/use-ai-agents'

jest.mock('@/lib/trpc/client', () => ({
  api: {
    ai: {
      analyzeCampaign: {
        useMutation: jest.fn(() => ({
          mutate: jest.fn(),
          mutateAsync: jest.fn(),
          isPending: false,
          error: null,
        })),
      },
    },
  },
}))

describe('useCampaignAnalysis', () => {
  it('exposes analyze and isAnalyzing flags', () => {
    const { result } = renderHook(() => useCampaignAnalysis())
    expect(typeof result.current.analyze).toBe('function')
    expect(result.current.isAnalyzing).toBe(false)
  })
})
```

### Testing a pure utility

```ts
import { parseAIResponse } from '@/lib/ai/agent-base'

describe('parseAIResponse', () => {
  it('extracts JSON from a markdown code block', () => {
    const content = '```json\n{"ok": true}\n```'
    expect(parseAIResponse(content)).toEqual({ ok: true })
  })

  it('returns an empty object when no JSON is found', () => {
    expect(parseAIResponse('no json here')).toEqual({})
  })
})
```

## Anti-patterns

- Do not test implementation details (internal state, method calls on the component).
- Do not write tests that pass without implementation (assert `true` or snapshot-only).
- Do not skip the failing-test step.
- Do not bulk-copy tests from reference repos without adapting them to this codebase.
