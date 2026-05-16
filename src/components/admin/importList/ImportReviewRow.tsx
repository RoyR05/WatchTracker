import { useState } from 'react';
import { tmdbService } from '../../../services/tmdb';

export interface TmdbCandidate {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year: string | null;
  posterPath: string | null;
  overview: string;
  voteAverage: number;
}

export type RowStatus = 'searching' | 'matched' | 'no_match' | 'error';
export type RowDecision = 'accept' | 'skip';

export interface ReviewRow {
  lineNumber: number;
  inputTitle: string;
  inputMediaType: 'movie' | 'tv';
  comment: string;
  candidates: TmdbCandidate[];
  selectedIndex: number; // -1 = none
  status: RowStatus;
  decision: RowDecision;
  isDuplicate: boolean;
}

interface ImportReviewRowProps {
  row: ReviewRow;
  onSetDecision: (lineNumber: number, decision: RowDecision) => void;
  onSelectCandidate: (lineNumber: number, candidateIndex: number) => void;
}

export function ImportReviewRow({ row, onSetDecision, onSelectCandidate }: ImportReviewRowProps) {
  const [picking, setPicking] = useState(false);
  const selected = row.selectedIndex >= 0 ? row.candidates[row.selectedIndex] : null;
  const accepted = row.decision === 'accept';

  return (
    <div
      className={`rounded-lg border p-4 ${
        accepted ? 'bg-gray-800 border-gray-700' : 'bg-gray-800/40 border-gray-700/50 opacity-60'
      }`}
    >
      <div className="flex gap-4">
        <div className="w-16 flex-shrink-0">
          <img
            src={tmdbService.getImageUrl(selected?.posterPath ?? null, 'w342')}
            alt=""
            className="w-full aspect-[2/3] object-cover rounded"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Line {row.lineNumber}</span>
            {row.status === 'searching' && (
              <span className="text-xs text-blue-400">Searching…</span>
            )}
            {row.status === 'no_match' && (
              <span className="text-xs px-2 py-0.5 bg-red-900/60 text-red-300 border border-red-700 rounded">
                No TMDB match
              </span>
            )}
            {row.status === 'error' && (
              <span className="text-xs px-2 py-0.5 bg-red-900/60 text-red-300 border border-red-700 rounded">
                Search failed
              </span>
            )}
            {row.isDuplicate && (
              <span className="text-xs px-2 py-0.5 bg-yellow-900/60 text-yellow-300 border border-yellow-700 rounded">
                Already curated
              </span>
            )}
          </div>

          {selected ? (
            <>
              <p className="text-white font-semibold text-sm mt-1">
                {selected.title}{' '}
                {selected.year && <span className="text-gray-400 font-normal">({selected.year})</span>}
              </p>
              <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded uppercase">
                {selected.mediaType}
              </span>
            </>
          ) : (
            <p className="text-gray-400 text-sm mt-1 italic">
              Input: "{row.inputTitle}" ({row.inputMediaType}) — no match selected
            </p>
          )}

          {row.comment && (
            <p className="text-xs text-gray-400 italic mt-1.5 line-clamp-2">"{row.comment}"</p>
          )}

          <div className="flex gap-2 mt-3 flex-wrap">
            <button
              onClick={() => onSetDecision(row.lineNumber, 'accept')}
              disabled={!selected}
              className={`text-xs px-3 py-1 rounded font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                accepted ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {accepted ? '✓ Accepted' : 'Accept'}
            </button>
            <button
              onClick={() => onSetDecision(row.lineNumber, 'skip')}
              className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                !accepted ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {!accepted ? '✕ Skipped' : 'Skip'}
            </button>
            {row.candidates.length > 1 && (
              <button
                onClick={() => setPicking((p) => !p)}
                className="text-xs px-3 py-1 rounded font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                {picking ? 'Hide options' : 'Pick different'}
              </button>
            )}
          </div>

          {picking && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-3">
              {row.candidates.map((c, i) => (
                <button
                  key={`${c.mediaType}-${c.tmdbId}`}
                  onClick={() => {
                    onSelectCandidate(row.lineNumber, i);
                    setPicking(false);
                  }}
                  className={`text-left rounded overflow-hidden border transition-colors ${
                    i === row.selectedIndex
                      ? 'border-primary-500 ring-1 ring-primary-500'
                      : 'border-gray-700 hover:border-gray-500'
                  }`}
                  title={`${c.title}${c.year ? ` (${c.year})` : ''} · ${c.mediaType}`}
                >
                  <img
                    src={tmdbService.getImageUrl(c.posterPath, 'w342')}
                    alt=""
                    className="w-full aspect-[2/3] object-cover"
                  />
                  <p className="text-[10px] text-gray-300 px-1 py-0.5 line-clamp-1">
                    {c.title}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
