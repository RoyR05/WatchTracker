import { useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { CollapsibleSection } from './CollapsibleSection';

interface HorizontalScrollSectionProps {
  id: string;
  title: string;
  itemCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  page: number;
  onLoadMore: () => void;
  children: ReactNode;
  endLabel?: string;
}

export function HorizontalScrollSection({
  id,
  title,
  itemCount,
  loading,
  loadingMore,
  hasMore,
  page,
  onLoadMore,
  children,
  endLabel,
}: HorizontalScrollSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
      if ((scrollLeft + clientWidth) / scrollWidth > 0.8 && hasMore && !loadingMore) {
        onLoadMore();
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    updateButtons();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, onLoadMore, updateButtons]);

  useEffect(() => {
    updateButtons();
  }, [itemCount, updateButtons]);

  const scrollBy = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -el.clientWidth * 0.8 : el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <CollapsibleSection id={id} title={title} itemCount={itemCount}>
      <div className="hidden md:flex items-center gap-2 mb-4">
        <button
          onClick={() => scrollBy('left')}
          disabled={!canScrollLeft}
          className={`p-2 rounded-lg bg-gray-800 border border-gray-700 transition-all duration-200 ${
            canScrollLeft ? 'hover:bg-gray-700 hover:border-primary-500 text-white' : 'opacity-40 cursor-not-allowed text-gray-600'
          }`}
          aria-label="Scroll left"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => scrollBy('right')}
          disabled={!canScrollRight}
          className={`p-2 rounded-lg bg-gray-800 border border-gray-700 transition-all duration-200 ${
            canScrollRight ? 'hover:bg-gray-700 hover:border-primary-500 text-white' : 'opacity-40 cursor-not-allowed text-gray-600'
          }`}
          aria-label="Scroll right"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <span className="text-sm text-gray-400 ml-2">
          {canScrollRight ? 'Scroll to see more' : `End of ${endLabel ?? title.toLowerCase()}`}
        </span>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-40 sm:w-48">
              <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
        >
          {children}

          {hasMore && !loadingMore && (
            <div className="flex-shrink-0 w-40 sm:w-48 flex items-center justify-center">
              <button
                onClick={onLoadMore}
                className="w-full h-full min-h-[240px] bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg border-2 border-dashed border-gray-600 hover:border-primary-500 transition-all duration-200 flex flex-col items-center justify-center gap-3 shadow-lg"
              >
                <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-base font-semibold">Load More</span>
                <span className="text-xs text-gray-400">Page {page + 1}</span>
              </button>
            </div>
          )}

          {loadingMore && (
            <div className="flex-shrink-0 w-40 sm:w-48">
              <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
            </div>
          )}

          {!hasMore && itemCount > 0 && (
            <div className="flex-shrink-0 w-40 sm:w-48 flex items-center justify-center">
              <div className="text-gray-500 text-sm text-center px-4">
                End of {endLabel ?? title.toLowerCase()}
              </div>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
