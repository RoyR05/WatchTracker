import { ReactNode, useEffect, useState } from 'react';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  children: ReactNode;
  defaultCollapsed?: boolean;
  itemCount?: number;
  actions?: ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  children,
  defaultCollapsed = false,
  itemCount,
  actions
}: CollapsibleSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(`section-collapsed-${id}`);
    return saved !== null ? saved === 'true' : defaultCollapsed;
  });

  useEffect(() => {
    localStorage.setItem(`section-collapsed-${id}`, String(isCollapsed));
  }, [id, isCollapsed]);

  return (
    <section>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-primary-500 text-gray-400 hover:text-white transition-all duration-200"
            aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
            title={isCollapsed ? 'Expand section' : 'Collapse section'}
          >
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isCollapsed && itemCount !== undefined && (
            <span className="text-sm text-gray-400 font-medium">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
        {!isCollapsed && actions && (
          <div className="flex flex-col sm:flex-row gap-3">
            {actions}
          </div>
        )}
      </div>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'
        }`}
      >
        {children}
      </div>
    </section>
  );
}
