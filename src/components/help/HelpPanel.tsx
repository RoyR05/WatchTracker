import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HELP_TOPICS, topicForPath, HelpTopic } from './helpContent';
import { groupedGlossary } from './iconGlossary';

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
  onReplayTour: () => void;
  installAvailable?: boolean;
  onInstall?: () => void;
}

export function HelpPanel({ open, onClose, onReplayTour, installAvailable, onInstall }: HelpPanelProps) {
  const location = useLocation();
  const [selected, setSelected] = useState<HelpTopic | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showIcons, setShowIcons] = useState(false);

  // Reset to the current page's topic each time the panel opens.
  useEffect(() => {
    if (open) {
      setSelected(topicForPath(location.pathname));
      setShowAll(false);
      setShowIcons(false);
    }
  }, [open, location.pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const topic = selected ?? topicForPath(location.pathname);

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Help"
    >
      <div
        className="h-full w-full max-w-md bg-brand-card border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Help</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close help"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Current page topic */}
          <div>
            <p className="text-xs uppercase tracking-wide text-primary-400 font-semibold mb-1">
              This page
            </p>
            <h3 className="text-xl font-bold text-white">{topic.title}</h3>
            <p className="text-sm text-gray-300 mt-1 leading-relaxed">{topic.blurb}</p>
            <ul className="mt-3 space-y-2">
              {topic.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-300">
                  <span className="text-primary-500 flex-shrink-0">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Browse all topics */}
          <div className="border-t border-white/10 pt-4">
            <button
              onClick={() => setShowAll((s) => !s)}
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              {showAll ? '▼ Hide all topics' : '▶ Browse all help topics'}
            </button>
            {showAll && (
              <div className="mt-3 flex flex-wrap gap-2">
                {HELP_TOPICS.map((t) => (
                  <button
                    key={t.match}
                    onClick={() => setSelected(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      t.match === topic.match
                        ? 'bg-primary-600 border-primary-500 text-white'
                        : 'bg-gray-800 border-white/10 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Icon reference */}
          <div className="border-t border-white/10 pt-4">
            <button
              onClick={() => setShowIcons((s) => !s)}
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              {showIcons ? '▼ Hide icon reference' : '▶ Icon reference'}
            </button>
            {showIcons && (
              <div className="mt-3 space-y-5">
                {groupedGlossary().map(({ group, entries }) => (
                  <div key={group}>
                    <p className="text-xs uppercase tracking-wide text-primary-400 font-semibold mb-2">
                      {group}
                    </p>
                    <ul className="space-y-3">
                      {entries.map((entry) => (
                        <li key={entry.name} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-gray-300"
                              fill={entry.fill ?? 'none'}
                              stroke={entry.fill === 'currentColor' ? 'none' : 'currentColor'}
                              viewBox="0 0 24 24"
                            >
                              {entry.paths.map((d, i) => (
                                <path
                                  key={i}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={entry.fill === 'currentColor' ? undefined : 2}
                                  d={d}
                                />
                              ))}
                            </svg>
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-white">{entry.name}</p>
                            <p className="text-xs text-gray-400 leading-relaxed">{entry.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/10 space-y-2">
          {installAvailable && onInstall && (
            <button
              onClick={onInstall}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors"
            >
              ⤓ Install app
            </button>
          )}
          <button
            onClick={onReplayTour}
            className="w-full px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
          >
            ↻ Replay the welcome tour
          </button>
        </div>
      </div>
    </div>
  );
}
