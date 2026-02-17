/**
 * ReviewErrorBoundary - Error boundary for the Code Review tab
 *
 * Wraps the CodeReviewLayout to catch and recover from errors without crashing the entire app.
 * Uses SolidJS ErrorBoundary with a custom fallback UI.
 */

import { ErrorBoundary, createSignal, Show, onMount, createEffect } from 'solid-js';
import type { JSX } from 'solid-js/jsx-runtime';

interface ReviewErrorBoundaryProps {
  children: JSX.Element;
}

export function ReviewErrorBoundary(props: ReviewErrorBoundaryProps) {
  return (
    <ErrorBoundary fallback={(err, reset) => <ReviewErrorFallback error={err} reset={reset} />}>
      {props.children}
    </ErrorBoundary>
  );
}

interface ReviewErrorFallbackProps {
  error: Error;
  reset: () => void;
}

function ReviewErrorFallback(props: ReviewErrorFallbackProps) {
  const [showDetails, setShowDetails] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  let retryButtonRef: HTMLButtonElement | undefined;

  const errorMessage = () => {
    // Provide user-friendly messages for common errors
    const msg = props.error.message || 'An unknown error occurred';

    if (msg.includes('fetch') || msg.includes('network')) {
      return 'Network error: Could not connect to the backend service.';
    }
    if (msg.includes('timeout')) {
      return 'Request timed out: The operation took too long to complete.';
    }
    if (msg.includes('parse') || msg.includes('JSON')) {
      return 'Data error: Received invalid response from the backend.';
    }

    return msg;
  };

  const technicalDetails = () => {
    const details = [];

    details.push(`Error: ${props.error.name || 'Error'}`);
    details.push(`Message: ${props.error.message || 'No message'}`);

    if (props.error.stack) {
      details.push(`\nStack trace:\n${props.error.stack}`);
    }

    details.push(`\nTimestamp: ${new Date().toISOString()}`);
    details.push(`User Agent: ${navigator.userAgent}`);

    return details.join('\n');
  };

  const handleCopyError = async () => {
    try {
      await navigator.clipboard.writeText(technicalDetails());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  const handleReportIssue = () => {
    const title = encodeURIComponent(`Code Review Error: ${props.error.message || 'Unknown error'}`);
    const body = encodeURIComponent(
      `## Error Details\n\n\`\`\`\n${technicalDetails()}\n\`\`\`\n\n## Steps to Reproduce\n\n1. \n2. \n3. \n\n## Expected Behavior\n\n\n\n## Actual Behavior\n\n`
    );
    const url = `https://github.com/your-org/codelane/issues/new?title=${title}&body=${body}`;
    window.open(url, '_blank');
  };

  // Auto-focus retry button on mount
  onMount(() => {
    setTimeout(() => retryButtonRef?.focus(), 100);
  });

  return (
    <div class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zed-bg-app" role="alert">
      {/* Error Icon */}
      <div class="relative mb-6">
        <div class="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg
            class="w-10 h-10 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        {/* Pulse effect */}
        <div class="absolute inset-0 rounded-full bg-red-500/5 animate-pulse" />
      </div>

      {/* Error Title */}
      <h2 class="text-xl font-semibold text-zed-text-primary mb-2">
        Something Went Wrong
      </h2>

      {/* User-friendly error message */}
      <p class="text-sm text-red-400 mb-6 max-w-md">
        {errorMessage()}
      </p>

      {/* Action Buttons */}
      <div class="flex items-center gap-3 mb-6">
        <button
          ref={retryButtonRef}
          onClick={props.reset}
          aria-label="Retry review generation"
          class="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Retry
        </button>

        <button
          onClick={handleReportIssue}
          aria-label="Report issue on GitHub"
          class="px-4 py-2.5 bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-active rounded-lg transition-colors text-sm flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          Report Issue
        </button>
      </div>

      {/* Technical Details Toggle */}
      <div class="w-full max-w-2xl">
        <button
          onClick={() => setShowDetails(!showDetails())}
          class="w-full px-4 py-2 bg-zed-bg-panel border border-zed-border-subtle rounded-lg hover:bg-zed-bg-hover transition-colors text-sm text-zed-text-secondary hover:text-zed-text-primary flex items-center justify-between"
        >
          <span class="flex items-center gap-2">
            <svg
              class="w-4 h-4 transition-transform"
              classList={{ 'rotate-90': showDetails() }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
            Technical Details
          </span>
          <span class="text-xs text-zed-text-tertiary">
            {showDetails() ? 'Hide' : 'Show'}
          </span>
        </button>

        {/* Collapsible Technical Details */}
        <Show when={showDetails()}>
          <div class="mt-2 p-4 bg-zed-bg-panel border border-zed-border-subtle rounded-lg text-left">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs font-medium text-zed-text-primary">Error Information</h3>
              <button
                onClick={handleCopyError}
                class="px-2 py-1 text-xs bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary rounded transition-colors flex items-center gap-1"
              >
                <Show
                  when={!copied()}
                  fallback={
                    <>
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  }
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy
                </Show>
              </button>
            </div>
            <pre class="text-xs text-zed-text-secondary font-mono whitespace-pre-wrap break-words overflow-x-auto bg-zed-bg-app p-3 rounded border border-zed-border-subtle">
              {technicalDetails()}
            </pre>
          </div>
        </Show>
      </div>

      {/* Help Text */}
      <p class="text-xs text-zed-text-tertiary mt-6 max-w-md">
        If the problem persists, try reloading the application or contact support with the technical details above.
      </p>
    </div>
  );
}
