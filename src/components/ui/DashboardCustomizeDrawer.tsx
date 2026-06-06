import { useState, useEffect, useRef } from 'react';
import { Reorder, useDragControls } from 'framer-motion';

export interface SectionMeta {
  id: string;
  label: string;
}

export const DASHBOARD_SECTION_META: SectionMeta[] = [
  { id: 'currently-watching', label: 'Currently Watching' },
  { id: 'plan-to-watch',      label: 'Plan to Watch' },
  { id: 'coming-soon',        label: 'Coming Soon' },
  { id: 'trending',           label: 'Trending' },
  { id: 'anticipated',        label: 'Anticipated' },
  { id: 'popular',            label: 'Popular' },
];

interface Props {
  order: string[];
  hidden: Set<string>;
  onClose: () => void;
  onChange: (order: string[], hidden: Set<string>) => void;
  onReset: () => void;
}

function DragRow({ meta, hidden, onToggle }: { meta: SectionMeta; hidden: boolean; onToggle: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={meta.id}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-3 select-none"
    >
      {/* Drag handle */}
      <span
        onPointerDown={(e) => controls.start(e)}
        className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
        </svg>
      </span>

      <span className={`flex-1 text-sm font-medium ${hidden ? 'text-gray-500' : 'text-white'}`}>
        {meta.label}
      </span>

      {/* Eye toggle */}
      <button
        onClick={onToggle}
        className={`p-1 rounded transition-colors ${hidden ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-white'}`}
        aria-label={hidden ? `Show ${meta.label}` : `Hide ${meta.label}`}
      >
        {hidden ? (
          // Eye-slash (hidden)
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          // Eye (visible)
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </Reorder.Item>
  );
}

export function DashboardCustomizeDrawer({ order, hidden, onClose, onChange, onReset }: Props) {
  const [localOrder, setLocalOrder] = useState<string[]>(order);
  const [localHidden, setLocalHidden] = useState<Set<string>>(new Set(hidden));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce save: 600ms after last change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(localOrder, localHidden);
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localOrder, localHidden]);

  function toggleHidden(id: string) {
    setLocalHidden(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Map id → SectionMeta for the ordered list
  const metaMap = Object.fromEntries(DASHBOARD_SECTION_META.map(m => [m.id, m]));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-80 max-w-full bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">Customize Dashboard</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="px-5 pt-4 pb-2 text-xs text-gray-500">
          Drag to reorder sections. Toggle the eye to show or hide.
        </p>

        {/* Reorder list */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          <Reorder.Group
            axis="y"
            values={localOrder}
            onReorder={setLocalOrder}
            className="flex flex-col gap-2"
          >
            {localOrder.map(id => {
              const meta = metaMap[id];
              if (!meta) return null;
              return (
                <DragRow
                  key={id}
                  meta={meta}
                  hidden={localHidden.has(id)}
                  onToggle={() => toggleHidden(id)}
                />
              );
            })}
          </Reorder.Group>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-700">
          <button
            onClick={() => {
              onReset();
              onClose();
            }}
            className="w-full text-sm text-gray-400 hover:text-white transition-colors py-2 rounded-lg border border-gray-700 hover:border-gray-500"
          >
            Reset to default
          </button>
        </div>
      </div>
    </>
  );
}
