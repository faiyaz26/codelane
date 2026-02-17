# Testing Guide for Review API

This guide shows how to test components and services that use the Review API.

## Quick Start

### 1. Testing with MockReviewAPI

Use `MockReviewAPI` for unit tests that don't require Tauri:

```typescript
import { describe, it, expect } from 'vitest';
import { AIReviewService } from '@/services/AIReviewService';
import { MockReviewAPI } from '@/services/api';

describe('AIReviewService with Mock API', () => {
  it('should generate a review', async () => {
    // The service will use MockReviewAPI if VITE_USE_MOCK_API=true
    const service = new AIReviewService();

    const result = await service.generateReview({
      tool: 'claude',
      diffContent: 'test diff',
      workingDir: '/test',
    });

    expect(result.success).toBe(true);
  });
});
```

### 2. Testing Error Scenarios

Use `FailingMockReviewAPI` to test error handling:

```typescript
import { FailingMockReviewAPI } from '@/services/api';

describe('Error handling', () => {
  it('should handle API failures gracefully', async () => {
    const failingAPI = new FailingMockReviewAPI();

    const result = await failingAPI.generateReview({
      tool: 'claude',
      diffContent: 'test',
      prompt: 'test',
      workingDir: '/test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### 3. Dependency Injection for Testing

Create a wrapper that accepts an API instance:

```typescript
// service.ts
import type { IReviewAPI } from '@/services/api';
import { reviewAPI } from '@/services/api/provider';

export class ReviewService {
  constructor(private api: IReviewAPI = reviewAPI) {}

  async generateReview(params: ReviewGenerationParams) {
    return this.api.generateReview(params);
  }
}

// service.test.ts
import { MockReviewAPI } from '@/services/api';

describe('ReviewService', () => {
  it('should use injected mock API', async () => {
    const mockAPI = new MockReviewAPI();
    const service = new ReviewService(mockAPI);

    const result = await service.generateReview(params);
    expect(result.success).toBe(true);
  });
});
```

## Running Tests

### Run all API tests:

```bash
pnpm test src/services/api/__tests__
```

### Run with mock API (no Tauri required):

```bash
VITE_USE_MOCK_API=true pnpm test
```

### Run with coverage:

```bash
pnpm test --coverage src/services/api
```

## Test Examples

### Example 1: Testing AIReviewService

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AIReviewService } from '@/services/AIReviewService';

describe('AIReviewService', () => {
  let service: AIReviewService;

  beforeEach(() => {
    service = new AIReviewService();
  });

  it('should generate review with default prompt', async () => {
    const result = await service.generateReview({
      tool: 'claude',
      diffContent: '+console.log("hello")',
      workingDir: '/test',
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeTruthy();
  });

  it('should generate review with custom prompt', async () => {
    const result = await service.generateReview({
      tool: 'claude',
      diffContent: '+const x = 1',
      workingDir: '/test',
      customPrompt: 'Focus on variable naming',
    });

    expect(result.success).toBe(true);
  });

  it('should generate file review', async () => {
    const result = await service.generateFileReview(
      'claude',
      'src/test.ts',
      '+const foo = 1',
      '/test'
    );

    expect(result.success).toBe(true);
    expect(result.content).toContain('src/test.ts');
  });
});
```

### Example 2: Testing ReviewOrchestrator

```typescript
import { describe, it, expect } from 'vitest';
import { reviewOrchestrator } from '@/services/review/ReviewOrchestrator';
import { reviewStateManager } from '@/services/review/ReviewStateManager';

describe('ReviewOrchestrator', () => {
  it('should generate full review', async () => {
    const laneId = 'test-lane';

    // Trigger review generation
    await reviewOrchestrator.generateReview(laneId, '/test');

    // Check state
    const state = reviewStateManager.getState(laneId)();
    expect(state.status).toBe('ready');
    expect(state.reviewMarkdown).toBeTruthy();
  });
});
```

### Example 3: Testing with Controlled Delays

```typescript
import { MockReviewAPI } from '@/services/api';

describe('Performance tests', () => {
  it('should handle slow API responses', async () => {
    const mockAPI = new MockReviewAPI();
    mockAPI.setDelay(1000); // 1 second delay

    const start = Date.now();
    const result = await mockAPI.generateReview(params);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(1000);
    expect(result.success).toBe(true);
  });
});
```

## Integration Testing

### Testing with Real API (requires Tauri)

```typescript
import { ReviewAPI } from '@/services/api';

describe('Integration tests', () => {
  // Only run if Tauri is available
  const itIfTauri = typeof window !== 'undefined' && '__TAURI__' in window
    ? it
    : it.skip;

  itIfTauri('should work with real API', async () => {
    const api = new ReviewAPI();

    const tools = await api.getAvailableTools();
    expect(Array.isArray(tools)).toBe(true);
  });
});
```

## Mocking Strategies

### Strategy 1: Environment-based (Recommended)

Set environment variable to use mock globally:

```bash
# .env.test
VITE_USE_MOCK_API=true
```

All services will automatically use `MockReviewAPI`.

### Strategy 2: Dependency Injection

Pass API instance to services:

```typescript
class MyService {
  constructor(private api: IReviewAPI = reviewAPI) {}
}

// Test
const mockAPI = new MockReviewAPI();
const service = new MyService(mockAPI);
```

### Strategy 3: Module Mocking (vitest)

```typescript
import { vi } from 'vitest';

vi.mock('@/services/api/provider', () => ({
  reviewAPI: new MockReviewAPI(),
}));
```

## Best Practices

### 1. Test in Isolation

✅ **Good:** Test one thing at a time
```typescript
it('should generate review', async () => {
  const result = await reviewAPI.generateReview(params);
  expect(result.success).toBe(true);
});
```

❌ **Bad:** Test too many things
```typescript
it('should do everything', async () => {
  // Tests review, sorting, file processing all at once
});
```

### 2. Use Descriptive Test Names

✅ **Good:** Clear what is being tested
```typescript
it('should return error when API fails', async () => { ... });
```

❌ **Bad:** Vague description
```typescript
it('works', async () => { ... });
```

### 3. Mock at the Right Level

✅ **Good:** Mock the API layer
```typescript
const mockAPI = new MockReviewAPI();
const service = new MyService(mockAPI);
```

❌ **Bad:** Mock Tauri invoke directly
```typescript
vi.mock('@tauri-apps/api/core'); // Too low level
```

### 4. Test Error Paths

Always test both success and failure cases:

```typescript
describe('generateReview', () => {
  it('should succeed with valid params', async () => {
    const mockAPI = new MockReviewAPI();
    const result = await mockAPI.generateReview(validParams);
    expect(result.success).toBe(true);
  });

  it('should fail gracefully with invalid params', async () => {
    const failingAPI = new FailingMockReviewAPI();
    const result = await failingAPI.generateReview(validParams);
    expect(result.success).toBe(false);
  });
});
```

## Debugging Tests

### Enable verbose logging:

```typescript
import { reviewAPI } from '@/services/api/provider';

describe('Debug test', () => {
  it('should log details', async () => {
    console.log('Using API:', reviewAPI.constructor.name);
    const result = await reviewAPI.generateReview(params);
    console.log('Result:', result);
  });
});
```

### Check API type at runtime:

```typescript
import { getAPIType } from '@/services/api/provider';

it('should use correct API', () => {
  const type = getAPIType();
  console.log('API type:', type); // 'production' | 'mock' | 'failing-mock'
});
```

## Common Issues

### Issue: Tests timeout

**Solution:** Reduce mock delay or increase test timeout

```typescript
const mockAPI = new MockReviewAPI();
mockAPI.setDelay(0); // No delay for fast tests
```

### Issue: Tests fail with "invoke is not a function"

**Solution:** Use environment variable to enable mock API

```bash
VITE_USE_MOCK_API=true pnpm test
```

### Issue: Can't inject mock API

**Solution:** Refactor service to accept API in constructor

```typescript
// Before
class MyService {
  async doWork() {
    return reviewAPI.generateReview(params);
  }
}

// After
class MyService {
  constructor(private api: IReviewAPI = reviewAPI) {}

  async doWork() {
    return this.api.generateReview(params);
  }
}
```

## Additional Resources

- [Review API README](./README.md) - Architecture overview
- [Vitest Documentation](https://vitest.dev) - Test framework docs
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) - General testing advice
