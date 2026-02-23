/**
 * ReviewChangesPanel - Right half of the code review layout
 *
 * Full-height scrollable view with sticky file contexts.
 * Each file's AI feedback is sticky at the bottom while that file is visible.
 */

import { ReviewFileScrollView } from './ReviewFileScrollView';
import type { FileChangeStats } from '../../types/git';
import type { InlineAnnotation, PrReviewComment, PendingReviewComment } from '../../types/review';

interface ReviewChangesPanelProps {
  laneId: string;
  workingDir: string;
  sortedFiles: FileChangeStats[];
  fileDiffs: Map<string, string>;
  perFileFeedback: Map<string, string>;
  perFileAnnotations: Map<string, InlineAnnotation[]>;
  visibleFilePath: string | null;
  scrollToPath: string | null;
  onVisibleFileChange: (path: string) => void;
  // PR review comment props
  enableAddComment?: boolean;
  prReviewComments?: PrReviewComment[];
  pendingComments?: PendingReviewComment[];
  onAddComment?: (path: string, line: number, body: string) => void;
  onUpdateComment?: (commentId: string, body: string) => void;
  onRemoveComment?: (commentId: string) => void;
}

export function ReviewChangesPanel(props: ReviewChangesPanelProps) {
  return (
    <section
      class="flex flex-col h-full overflow-hidden"
      aria-labelledby="changed-files-heading"
    >
      <h2 id="changed-files-heading" class="sr-only">Changed Files</h2>
      <ReviewFileScrollView
        laneId={props.laneId}
        workingDir={props.workingDir}
        sortedFiles={props.sortedFiles}
        fileDiffs={props.fileDiffs}
        perFileFeedback={props.perFileFeedback}
        perFileAnnotations={props.perFileAnnotations}
        visibleFilePath={props.visibleFilePath}
        onVisibleFileChange={props.onVisibleFileChange}
        scrollToPath={props.scrollToPath}
        enableAddComment={props.enableAddComment}
        prReviewComments={props.prReviewComments}
        pendingComments={props.pendingComments}
        onAddComment={props.onAddComment}
        onUpdateComment={props.onUpdateComment}
        onRemoveComment={props.onRemoveComment}
      />
    </section>
  );
}
