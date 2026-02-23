import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = position.x;
      let adjustedY = position.y;

      if (adjustedX + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      if (adjustedY + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      menuRef.current.style.left = `${Math.max(10, adjustedX)}px`;
      menuRef.current.style.top = `${Math.max(10, adjustedY)}px`;
    }
  }, [position]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-in fade-in duration-150" />
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[200px] rounded-xl bg-gray-800 shadow-2xl border border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ left: position.x, top: position.y }}
      >
        <div className="py-2">
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className={`w-full px-4 py-3 flex items-center space-x-3 transition-colors ${
                item.variant === 'danger'
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-gray-200 hover:bg-gray-700'
              }`}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
