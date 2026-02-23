/**
 * Annotation Parser
 *
 * Parses AI file review responses to separate general feedback
 * from line-specific inline annotations.
 *
 * Annotation format: [L<line>]: comment
 * With optional severity: [L<line>:warning]: comment
 */

import type { InlineAnnotation, ParsedFileReview } from '../../types/review';

const ANNOTATION_REGEX = /^\[L(\d+)(?::(info|warning|error))?\]:\s*(.+)$/;

/**
 * Parse a single file's AI review response into general feedback + line annotations.
 */
export function parseFileReviewWithAnnotations(response: string): ParsedFileReview {
  const lines = response.split('\n');
  const feedbackLines: string[] = [];
  const annotations: InlineAnnotation[] = [];

  for (const line of lines) {
    const match = line.trim().match(ANNOTATION_REGEX);
    if (match) {
      annotations.push({
        line: parseInt(match[1], 10),
        severity: (match[2] as InlineAnnotation['severity']) || 'info',
        comment: match[3].trim(),
      });
    } else {
      feedbackLines.push(line);
    }
  }

  // Strip trailing horizontal rules (---, ***, ___) and surrounding whitespace
  const feedback = feedbackLines.join('\n').trim().replace(/(\n\s*[-*_]{3,}\s*)+$/, '').trim();

  return {
    generalFeedback: feedback,
    annotations,
  };
}

/**
 * Parse a batched review response, extracting annotations per file.
 * Splits by file markers then applies annotation parsing to each section.
 */
export function parseBatchedReviewWithAnnotations(
  response: string,
  filePaths: string[]
): Map<string, ParsedFileReview> {
  const results = new Map<string, ParsedFileReview>();

  // Split by file markers (same pattern as ReviewOrchestrator's parseBatchedReview)
  const fileMarkerRegex = /(?:^|\n)(?:##|###)\s*(?:File:|Review for:)?\s*`?([^`\n]+)`?/gi;
  const matches = [...response.matchAll(fileMarkerRegex)];

  if (matches.length === 0 && filePaths.length === 1) {
    results.set(filePaths[0], parseFileReviewWithAnnotations(response));
    return results;
  }

  if (matches.length === 0) {
    // Try simpler filename matching
    for (const filePath of filePaths) {
      const fileName = filePath.split('/').pop() || filePath;
      const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fileRegex = new RegExp(
        `(?:^|\\n).*${escapedFileName}.*?\\n([\\s\\S]*?)(?=\\n.*(?:${filePaths.map(p => p.split('/').pop()).join('|')})|\`\`\`|$)`,
        'i'
      );
      const match = response.match(fileRegex);
      if (match && match[1]) {
        results.set(filePath, parseFileReviewWithAnnotations(match[1].trim()));
      }
    }
  } else {
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const fileName = match[1].trim();
      const startIdx = match.index! + match[0].length;
      const endIdx = i < matches.length - 1 ? matches[i + 1].index! : response.length;
      const content = response.substring(startIdx, endIdx).trim();

      const matchingPath = filePaths.find(
        path => path.includes(fileName) || fileName.includes(path.split('/').pop() || '')
      );

      if (matchingPath) {
        results.set(matchingPath, parseFileReviewWithAnnotations(content));
      }
    }
  }

  // Fallback: single file gets entire response
  if (results.size === 0 && filePaths.length === 1) {
    results.set(filePaths[0], parseFileReviewWithAnnotations(response));
  }

  return results;
}
