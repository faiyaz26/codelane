/**
 * Review type definitions for inline annotations
 */

export interface InlineAnnotation {
  line: number;
  comment: string;
  severity?: 'info' | 'warning' | 'error';
}

export interface ParsedFileReview {
  generalFeedback: string;
  annotations: InlineAnnotation[];
}
