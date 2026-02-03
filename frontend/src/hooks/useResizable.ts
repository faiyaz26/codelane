import { createSignal } from 'solid-js';

interface UseResizableOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
}

export function useResizable(options: UseResizableOptions) {
  const [width, setWidth] = createSignal(options.initialWidth);
  const [isResizing, setIsResizing] = createSignal(false);

  const handleResize = (delta: number) => {
    const newWidth = Math.max(options.minWidth, Math.min(options.maxWidth, width() + delta));
    setWidth(newWidth);
  };

  const startResize = () => setIsResizing(true);
  const endResize = () => setIsResizing(false);

  return {
    width,
    setWidth,
    isResizing,
    handleResize,
    startResize,
    endResize,
  };
}

interface UseResizableWithNullOptions {
  initialWidth: number | null;
  minWidth: number;
  maxWidth: number;
  getDefaultWidth: () => number;
}

export function useResizableWithNull(options: UseResizableWithNullOptions) {
  const [width, setWidth] = createSignal<number | null>(options.initialWidth);
  const [isResizing, setIsResizing] = createSignal(false);

  const handleResize = (delta: number) => {
    const currentWidth = width() ?? options.getDefaultWidth();
    const newWidth = Math.max(options.minWidth, Math.min(options.maxWidth, currentWidth + delta));
    setWidth(newWidth);
  };

  const startResize = () => setIsResizing(true);
  const endResize = () => setIsResizing(false);

  return {
    width,
    setWidth,
    isResizing,
    handleResize,
    startResize,
    endResize,
  };
}
