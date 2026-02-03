import { createSignal, onCleanup } from 'solid-js';

export type ResizeDirection = 'left' | 'right';

interface ResizeHandleProps {
  direction: ResizeDirection;
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

export function ResizeHandle(props: ResizeHandleProps) {
  const [isResizing, setIsResizing] = createSignal(false);

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    props.onResizeStart?.();

    const startX = e.clientX;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = props.direction === 'right'
        ? startX - e.clientX  // Inverted for right-side panels
        : e.clientX - startX; // Normal for left-side panels
      props.onResize(delta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      props.onResizeEnd?.();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      class={`w-1 cursor-col-resize hover:bg-zed-accent-blue/50 transition-colors ${
        isResizing() ? 'bg-zed-accent-blue' : ''
      }`}
      onMouseDown={handleMouseDown}
    />
  );
}
