/**
 * ErrorBoundaryTest - Test component to verify error boundary functionality
 *
 * This component can be temporarily imported to test that the error boundary
 * properly catches and recovers from errors.
 *
 * Usage:
 * 1. Import this component in CodeReviewLayout.tsx
 * 2. Add <ErrorBoundaryTest /> somewhere in the JSX
 * 3. Click the "Throw Error" button to test the error boundary
 * 4. Verify the error boundary shows the fallback UI
 * 5. Click "Retry" to verify error recovery works
 * 6. Remove the test component when done
 */

import { createSignal, Show } from 'solid-js';

export function ErrorBoundaryTest() {
  const [shouldThrow, setShouldThrow] = createSignal(false);

  if (shouldThrow()) {
    throw new Error('Test error from ErrorBoundaryTest component - This is intentional for testing the error boundary');
  }

  return (
    <div class="fixed bottom-4 right-4 z-50 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 backdrop-blur-sm">
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-yellow-400">Error Boundary Test</p>
          <p class="text-xs text-yellow-400/70">Click to test error handling</p>
        </div>
        <button
          onClick={() => setShouldThrow(true)}
          class="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded text-xs font-medium transition-colors"
        >
          Throw Error
        </button>
      </div>
    </div>
  );
}

/**
 * Example usage scenarios to test:
 *
 * 1. Network Error:
 *    throw new Error('fetch failed: Network error');
 *
 * 2. Timeout Error:
 *    throw new Error('Request timeout exceeded');
 *
 * 3. Parse Error:
 *    throw new Error('JSON parse error: Unexpected token');
 *
 * 4. Generic Error:
 *    throw new Error('Something went wrong');
 */
