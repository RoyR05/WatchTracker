import { useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  onLoadMore: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useInfiniteScroll({ onLoadMore, threshold = 0.1, enabled = true }: UseInfiniteScrollOptions) {
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !observerTarget.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { threshold }
    );

    observer.observe(observerTarget.current);

    return () => {
      observer.disconnect();
    };
  }, [onLoadMore, threshold, enabled]);

  return observerTarget;
}
