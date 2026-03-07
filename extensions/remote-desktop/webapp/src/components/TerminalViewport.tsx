/**
 * TerminalViewport — scales a desktop-sized terminal to fit mobile viewports.
 *
 * The terminal is rendered at its native host dimensions (e.g. 120 cols × 40 rows).
 * CSS transform: scale() shrinks it to fit the mobile viewport width.
 * Vertical scrolling works naturally; pinch-to-zoom is available for detail.
 */

import { onMount, onCleanup, createSignal, type JSX } from 'solid-js';

interface TerminalViewportProps {
  hostSize?: { cols: number; rows: number };
  children: JSX.Element;
}

// Approximate pixel width per terminal column at 13px Menlo font
const CHAR_WIDTH_PX = 7.8;
const CHAR_HEIGHT_PX = 18.2; // 13px * 1.4 lineHeight

export function TerminalViewport(props: TerminalViewportProps) {
  let viewportRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;
  const [scale, setScale] = createSignal(1);

  const computeScale = () => {
    if (!viewportRef || !props.hostSize) {
      setScale(1);
      return;
    }
    const viewportWidth = viewportRef.clientWidth;
    const terminalWidth = props.hostSize.cols * CHAR_WIDTH_PX + 16; // +padding
    
    if (terminalWidth > viewportWidth) {
      setScale(Math.min(1, viewportWidth / terminalWidth));
    } else {
      setScale(1);
    }
  };

  onMount(() => {
    computeScale();

    const observer = new ResizeObserver(computeScale);
    if (viewportRef) observer.observe(viewportRef);

    onCleanup(() => observer.disconnect());
  });

  const scaledHeight = () => {
    if (!props.hostSize) return 'auto';
    const nativeHeight = props.hostSize.rows * CHAR_HEIGHT_PX + 16;
    return `${nativeHeight * scale()}px`;
  };

  return (
    <div
      ref={viewportRef}
      class="h-full w-full overflow-y-auto overflow-x-hidden touch-manipulation"
    >
      <div
        ref={contentRef}
        style={{
          transform: `scale(${scale()})`,
          'transform-origin': 'top left',
          width: props.hostSize ? `${props.hostSize.cols * CHAR_WIDTH_PX + 16}px` : '100%',
          height: props.hostSize ? `${props.hostSize.rows * CHAR_HEIGHT_PX + 16}px` : '100%',
        }}
      >
        {props.children}
      </div>
      {/* Spacer to make scrollbar match scaled content height */}
      <div style={{ height: scaledHeight(), 'margin-top': `-${scaledHeight()}`, 'pointer-events': 'none' }} />
    </div>
  );
}
