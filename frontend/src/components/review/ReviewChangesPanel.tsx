/**
 * ReviewChangesPanel - Right half of the code review layout
 *
 * Full-height scrollable view with sticky file contexts.
 * Each file's AI feedback is sticky at the bottom while that file is visible.
 */

import { createMemo } from 'solid-js';
import { ReviewFileScrollView } from './ReviewFileScrollView';
import type { FileChangeStats } from '../../types/git';
import type { InlineAnnotation } from '../../types/review';

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
      />
    </section>
  );
}
