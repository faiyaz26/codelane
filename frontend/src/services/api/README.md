# Review API Abstraction Layer

This directory contains the API abstraction layer for code review operations. It decouples business logic from Tauri invoke calls, enabling testing and future extensibility.

## Architecture

```
┌─────────────────────────────────────────┐
│  Components & Services                   │
│  (AIReviewService, ReviewOrchestrator)  │
└───────────────┬─────────────────────────┘
                │
                │ reviewAPI.generateReview()
                │ reviewAPI.sortFiles()
                ↓
┌─────────────────────────────────────────┐
│  IReviewAPI Interface                    │
│  (Contract for all implementations)     │
└───────────────┬─────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
        ↓                ↓
┌──────────────┐  ┌──────────────┐
│  ReviewAPI   │  │ MockReviewAPI│
│  (Production)│  │  (Testing)   │
└──────────────┘  └──────────────┘
```

## Files

### Core API

- **`ReviewAPI.ts`** - Production implementation using Tauri invoke
- **`MockReviewAPI.ts`** - Mock implementations for testing
- **`ReviewAPIError.ts`** - Custom error class with context
- **`types.ts`** - TypeScript type definitions
- **`provider.ts`** - Singleton instance and environment-based selection
- **`index.ts`** - Barrel export

### Usage

#### Basic Usage

```typescript
import { reviewAPI } from '@/services/api/provider';

// Generate a review
const result = await reviewAPI.generateReview({
  tool: 'claude',
  diffContent: 'git diff output',
  prompt: 'Review this code',
  workingDir: '/path/to/project',
  model: 'haiku',
});

// Sort files
const sorted = await reviewAPI.sortFiles({
  files: fileChangeStats,
  sortOrder: 'smart',
  workingDir: '/path/to/project',
});
```

#### Testing with Mock API

```typescript
import { MockReviewAPI } from '@/services/api';

const mockAPI = new MockReviewAPI();
mockAPI.setDelay(100); // Simulate network delay

const result = await mockAPI.generateReview({
  tool: 'claude',
  diffContent: 'test diff',
  prompt: 'test prompt',
  workingDir: '/test',
});

expect(result.success).toBe(true);
```

#### Environment Variables

Control which implementation is used via environment variables:

```bash
# Use mock API (no Tauri required)
VITE_USE_MOCK_API=true pnpm dev

# Use failing mock API (test error handling)
VITE_USE_FAILING_MOCK_API=true pnpm dev

# Use production API (default)
pnpm dev
```

## Benefits

### 1. Testability

All business logic can now be tested without Tauri runtime:

```typescript
// Before: Requires Tauri
test('generates review', async () => {
  // Can't test without Tauri runtime
});

// After: Uses MockReviewAPI
test('generates review', async () => {
  const mockAPI = new MockReviewAPI();
  const result = await mockAPI.generateReview(params);
  expect(result.success).toBe(true);
});
```

### 2. Type Safety

All parameters are strongly typed:

```typescript
// Type error caught at compile time
reviewAPI.generateReview({
  tool: 'invalid-tool', // ❌ Type error
  diffContent: 'content',
  prompt: 'prompt',
  workingDir: '/path',
});
```

### 3. Error Handling

Consistent error handling across all operations:

```typescript
try {
  await reviewAPI.generateReview(params);
} catch (error) {
  if (error instanceof ReviewAPIError) {
    console.error(error.code, error.cause);
  }
}
```

### 4. Extensibility

Easy to add features without changing consumers:

```typescript
// Add retry logic
export class ReviewAPIWithRetry implements IReviewAPI {
  private api = new ReviewAPI();

  async generateReview(params: ReviewGenerationParams) {
    return retry(() => this.api.generateReview(params), {
      maxAttempts: 3,
      backoff: 'exponential',
    });
  }
}

// Add caching
export class CachedReviewAPI implements IReviewAPI {
  private api = new ReviewAPI();
  private cache = new Map();

  async generateReview(params: ReviewGenerationParams) {
    const key = JSON.stringify(params);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const result = await this.api.generateReview(params);
    this.cache.set(key, result);
    return result;
  }
}
```

## API Reference

### `IReviewAPI`

Interface for all Review API implementations.

#### Methods

##### `generateReview(params: ReviewGenerationParams): Promise<AIReviewResult>`

Generate an AI review for code changes.

**Parameters:**
- `tool` - AI tool to use (claude, aider, opencode, gemini)
- `diffContent` - Git diff content
- `prompt` - Review prompt
- `workingDir` - Project directory path
- `model` - Optional model name

**Returns:** `AIReviewResult` with success, content, and optional error

##### `generateFileReview(params: FileReviewParams): Promise<AIReviewResult>`

Generate an AI review for a specific file.

**Parameters:**
- `tool` - AI tool to use
- `filePath` - File path being reviewed
- `diffContent` - File diff content
- `workingDir` - Project directory path
- `model` - Optional model name
- `customPrompt` - Optional custom prompt

**Returns:** `AIReviewResult` with success, content, and optional error

##### `sortFiles(params: SortFilesParams): Promise<FileChangeStats[]>`

Sort files by importance/dependency order.

**Parameters:**
- `files` - Array of file change stats
- `sortOrder` - Sort order (smart, alphabetical, etc.)
- `workingDir` - Project directory path

**Returns:** Sorted array of file change stats

##### `testTool(params: TestToolParams): Promise<boolean>`

Test if an AI tool is available.

**Parameters:**
- `tool` - AI tool to test

**Returns:** `true` if tool is available, `false` otherwise

##### `getAvailableTools(): Promise<AITool[]>`

Get list of available AI tools.

**Returns:** Array of available tool names

## Testing

Run the test suite:

```bash
cd frontend
pnpm test src/services/api/__tests__
```

## Future Improvements

- [ ] Add retry logic with exponential backoff
- [ ] Implement request/response caching
- [ ] Add request batching for parallel operations
- [ ] Add telemetry and metrics
- [ ] Support for cancellation tokens
- [ ] Add rate limiting
