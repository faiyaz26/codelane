/**
 * Review type definitions for inline annotations and GitHub PR comments
 */

export interface InlineAnnotation {
  line: number;
  comment: string;
  severity?: 'info' | 'warning' | 'error';
  /** Origin of the annotation: 'ai' for generated, 'github' for fetched from GitHub */
  source?: 'ai' | 'github';
  /** GitHub username (for github-sourced annotations) */
  user?: string;
  /** GitHub comment ID (for github-sourced annotations) */
  id?: number;
}

export interface ParsedFileReview {
  generalFeedback: string;
  annotations: InlineAnnotation[];
}

// ============================================================================
// GitHub PR Review Comments
// ============================================================================

/** An inline review comment on a PR diff, fetched from GitHub */
export interface PrReviewComment {
  id: number;
  path: string;
  line: number | null;
  originalLine: number | null;
  side: 'LEFT' | 'RIGHT' | null;
  body: string;
  user: string;
  createdAt: string;
  updatedAt: string;
  inReplyToId: number | null;
}

/** A top-level PR conversation comment (issue comment), fetched from GitHub */
export interface PrConversationComment {
  id: number;
  body: string;
  user: string;
  createdAt: string;
  updatedAt: string;
  authorAssociation: string;
}

/** A user-authored pending review comment (not yet submitted to GitHub) */
export interface PendingReviewComment {
  id: string;
  path: string;
  line: number;
  side: 'RIGHT';
  body: string;
  status: 'pending';
  createdAt: number;
}
