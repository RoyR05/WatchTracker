import { useRef, useCallback } from 'react';

interface LongPressOptions {
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  delay?: number;
  shouldPreventDefault?: boolean;
}

export function useLongPress(options: LongPressOptions) {
  const { onLongPress, delay = 500, shouldPreventDefault = true } = options;

  const timeout = useRef<NodeJS.Timeout>();
  const target = useRef<EventTarget>();
  const isLongPress = useRef(false);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    isLongPress.current = false;
    target.current = e.target;

    if (shouldPreventDefault && e.target) {
      (e.target as HTMLElement).addEventListener('contextmenu', preventDefault);
    }

    timeout.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress(e);
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, delay);
  }, [onLongPress, delay, shouldPreventDefault]);

  const clear = useCallback((e?: React.TouchEvent | React.MouseEvent) => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    if (shouldPreventDefault && target.current) {
      (target.current as HTMLElement).removeEventListener('contextmenu', preventDefault);
    }

    if (isLongPress.current && e) {
      e.preventDefault();
      e.stopPropagation();
    }

    isLongPress.current = false;
  }, [shouldPreventDefault]);

  const preventDefault = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
  };
}
