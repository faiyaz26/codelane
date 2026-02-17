/**
 * Review API Error
 *
 * Custom error class for Review API operations.
 */

export class ReviewAPIError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ReviewAPIError';

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReviewAPIError);
    }
  }

  /**
   * Extract error message from unknown error type
   */
  static extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Create a ReviewAPIError from an unknown error
   */
  static from(error: unknown, context: string, code?: string): ReviewAPIError {
    const message = `${context}: ${ReviewAPIError.extractMessage(error)}`;
    return new ReviewAPIError(message, error, code);
  }
}
