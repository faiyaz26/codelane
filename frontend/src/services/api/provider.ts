/**
 * Review API Provider
 *
 * Singleton instance of the Review API.
 * Uses mock implementation in test/dev mode, real implementation in production.
 */

import { ReviewAPI } from './ReviewAPI';
import { MockReviewAPI, FailingMockReviewAPI } from './MockReviewAPI';
import type { IReviewAPI } from './ReviewAPI';

/**
 * Determine which API implementation to use
 */
function createReviewAPI(): IReviewAPI {
  // Check environment variable for mock mode
  const useMock = import.meta.env.VITE_USE_MOCK_API === 'true';
  const useFailing = import.meta.env.VITE_USE_FAILING_MOCK_API === 'true';

  if (useFailing) {
    console.warn('[ReviewAPI] Using FailingMockReviewAPI for testing error scenarios');
    return new FailingMockReviewAPI();
  }

  if (useMock) {
    console.warn('[ReviewAPI] Using MockReviewAPI for testing');
    return new MockReviewAPI();
  }

  // Production: use real Tauri backend
  return new ReviewAPI();
}

/**
 * Singleton Review API instance
 *
 * Import this in your services and components:
 * ```typescript
 * import { reviewAPI } from './services/api/provider';
 *
 * const result = await reviewAPI.generateReview(params);
 * ```
 */
export const reviewAPI = createReviewAPI();

/**
 * Get the current API implementation type
 */
export function getAPIType(): 'production' | 'mock' | 'failing-mock' {
  if (import.meta.env.VITE_USE_FAILING_MOCK_API === 'true') {
    return 'failing-mock';
  }
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return 'mock';
  }
  return 'production';
}
