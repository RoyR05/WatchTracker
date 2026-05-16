import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { tmdbService } from '../../services/tmdb';
import { parseCuratedInput, ParsedLine } from '../../components/admin/importList/parseInput';
import {
  ImportReviewRow,
  ReviewRow,
  TmdbCandidate,
  RowDecision,
} from '../../components/admin/importList/ImportReviewRow';

type Stage = 'input' | 'searching' | 'review' | 'submitting' | 'done';
type ListTarget = 'new' | 'existing';

interface ExistingList {
  id: string;
  name: string;
  itemCount: number;
}

const GEMINI_PROMPT = `Watch/read this video about upcoming TV shows and movies. Extract every distinct upcoming TV show or movie discussed. Output ONLY a plain-text list, one title per line, no header, no numbering, no markdown, no commentary outside the list. Each line must use exactly two pipe characters: Title | type | comment. Title = exact title, no year. type = the single word tv or movie. comment = one sentence (under 200 chars, no pipe characters) on why it's worth watching. One entry per line; no people/channels/franchises; no duplicates; best-guess type if unsure. Example:
Dune: Part Three | movie | The conclusion of Villeneuve's saga, the year's biggest sci-fi release.
Severance Season 3 | tv | Apple's mystery-box thriller returns after a major cliffhanger.`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function defaultListName() {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  return `Gemini Import ${iso}`;
}

function toCandidate(r: any): TmdbCandidate | null {
  if (r.media_type !== 'movie' && r.media_type !== 'tv') return null;
  const date: string = r.release_date || r.first_air_date || '';
  return {
    tmdbId: r.id,
    mediaType: r.media_type,
    title: r.title || r.name || 'Untitled',
    year: date ? date.slice(0, 4) : null,
    posterPath: r.poster_path ?? null,
    overview: r.overview ?? '',
    voteAverage: r.vote_average ?? 0,
  };
}

export default function ImportListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [stage, setStage] = useState<Stage>('input');
  const [rawText, setRawText] = useState('');
  const [parseErrors, setParseErrors] = useState<ParsedLine[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [listName, setListName] = useState(defaultListName());
  const [listDescription, setListDescription] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  // List destination state
  const [listTarget, setListTarget] = useState<ListTarget>('new');
  const [existingLists, setExistingLists] = useState<ExistingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');

  async function handleSearch() {
    if (!user) return;
    const parsed = parseCuratedInput(rawText);
    const errors = parsed.filter((p) => p.parseError);
    const valid = parsed.filter((p) => !p.parseError);
    setParseErrors(errors);

    if (valid.length === 0) {
      toast.error('No valid lines to import. Check the format.');
      return;
    }

    // Load existing lists for the destination picker
    try {
      const { data: lists } = await supabase
        .from('custom_lists')
        .select('id, name, list_items(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const mapped: ExistingList[] = (lists ?? []).map((l: any) => ({
        id: l.id,
        name: l.name,
        itemCount: l.list_items?.[0]?.count ?? 0,
      }));
      setExistingLists(mapped);
      if (mapped.length > 0) setSelectedListId(mapped[0].id);
    } catch (err) {
      console.error('Failed to load existing lists:', err);
    }

    setStage('searching');
    setProgress({ done: 0, total: valid.length });

    const built: ReviewRow[] = [];
    for (let i = 0; i < valid.length; i++) {
      const line = valid[i];
      let candidates: TmdbCandidate[] = [];
      let status: ReviewRow['status'] = 'no_match';
      try {
        const res = await tmdbService.searchMulti(line.title);
        const all = (res.results || []) as any[];
        const mapped = all.map(toCandidate).filter((c): c is TmdbCandidate => c !== null);
        const preferred = mapped.filter((c) => c.mediaType === line.mediaType);
        const others = mapped.filter((c) => c.mediaType !== line.mediaType);
        candidates = [...preferred, ...others].slice(0, 8);
        status = candidates.length > 0 ? 'matched' : 'no_match';
      } catch {
        status = 'error';
      }

      built.push({
        lineNumber: line.lineNumber,
        inputTitle: line.title,
        inputMediaType: line.mediaType,
        comment: line.comment,
        candidates,
        selectedIndex: candidates.length > 0 ? 0 : -1,
        status,
        decision: status === 'matched' ? 'accept' : 'skip',
        isDuplicate: false,
      });

      setProgress({ done: i + 1, total: valid.length });
      if (i < valid.length - 1) await sleep(250);
    }

    // Dedup against the admin's existing curated lists
    try {
      const { data: curatedLists } = await supabase
        .from('custom_lists')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_curated', true);

      const listIds = (curatedLists ?? []).map((l) => l.id);
      if (listIds.length > 0) {
        const tmdbIds = [
          ...new Set(
            built
              .filter((r) => r.selectedIndex >= 0)
              .map((r) => r.candidates[r.selectedIndex].tmdbId)
          ),
        ];
        if (tmdbIds.length > 0) {
          const { data: existing } = await supabase
            .from('list_items')
            .select('tmdb_id, media_type')
            .in('list_id', listIds)
            .in('tmdb_id', tmdbIds);

          const dupSet = new Set(
            (existing ?? []).map((e) => `${e.tmdb_id}-${e.media_type}`)
          );
          for (const r of built) {
            if (r.selectedIndex >= 0) {
              const c = r.candidates[r.selectedIndex];
              if (dupSet.has(`${c.tmdbId}-${c.mediaType}`)) {
                r.isDuplicate = true;
                r.decision = 'skip';
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Dedup check failed:', err);
    }

    setRows(built);
    setStage('review');
  }

  function setDecision(lineNumber: number, decision: RowDecision) {
    setRows((prev) =>
      prev.map((r) => (r.lineNumber === lineNumber ? { ...r, decision } : r))
    );
  }

  function selectCandidate(lineNumber: number, candidateIndex: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.lineNumber === lineNumber ? { ...r, selectedIndex: candidateIndex } : r
      )
    );
  }

  async function handleSubmit() {
    if (!user) return;
    const accepted = rows.filter((r) => r.decision === 'accept' && r.selectedIndex >= 0);
    if (accepted.length === 0) {
      toast.error('Nothing accepted to import.');
      return;
    }

    if (listTarget === 'new' && !listName.trim()) {
      toast.error('List name is required.');
      return;
    }
    if (listTarget === 'existing' && !selectedListId) {
      toast.error('Please select a list to import into.');
      return;
    }

    setStage('submitting');

    // Build the de-duped item list (no within-batch duplicates)
    const seen = new Set<string>();
    const dedupedAccepted = accepted.filter((r) => {
      const c = r.candidates[r.selectedIndex];
      const k = `${c.tmdbId}-${c.mediaType}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    try {
      if (listTarget === 'new') {
        // ── Create a new list ──
        const { data: list, error: listError } = await supabase
          .from('custom_lists')
          .insert({
            user_id: user.id,
            name: listName.trim(),
            description: listDescription.trim(),
            is_public: false,
            is_curated: true,
          })
          .select()
          .single();

        if (listError) throw listError;

        const items = dedupedAccepted.map((r, i) => {
          const c = r.candidates[r.selectedIndex];
          return {
            list_id: list.id,
            tmdb_id: c.tmdbId,
            media_type: c.mediaType,
            notes: r.comment,
            position: i,
          };
        });

        const { error: itemsError } = await supabase
          .from('list_items')
          .upsert(items, { onConflict: 'list_id,tmdb_id,media_type', ignoreDuplicates: true });

        if (itemsError) throw itemsError;

        await supabase
          .rpc('log_admin_action', {
            p_action_type: 'curated_list_imported',
            p_target_user_id: user.id,
            p_details: `Imported curated list "${listName.trim()}" (${items.length} items)`,
          })
          .maybeSingle();

        setStage('done');
        toast.success(`Created "${listName.trim()}" with ${items.length} item(s)`);
        navigate(`/lists/${list.id}`);
      } else {
        // ── Append to an existing list ──
        const targetList = existingLists.find((l) => l.id === selectedListId);

        // Get current max position so we append, not overwrite
        const { data: posData } = await supabase
          .from('list_items')
          .select('position')
          .eq('list_id', selectedListId)
          .order('position', { ascending: false })
          .limit(1)
          .maybeSingle();

        const startPosition = (posData?.position ?? -1) + 1;

        const items = dedupedAccepted.map((r, i) => {
          const c = r.candidates[r.selectedIndex];
          return {
            list_id: selectedListId,
            tmdb_id: c.tmdbId,
            media_type: c.mediaType,
            notes: r.comment,
            position: startPosition + i,
          };
        });

        const { error: itemsError } = await supabase
          .from('list_items')
          .upsert(items, { onConflict: 'list_id,tmdb_id,media_type', ignoreDuplicates: true });

        if (itemsError) throw itemsError;

        await supabase
          .rpc('log_admin_action', {
            p_action_type: 'curated_list_imported',
            p_target_user_id: user.id,
            p_details: `Appended ${items.length} items to list "${targetList?.name ?? selectedListId}"`,
          })
          .maybeSingle();

        setStage('done');
        toast.success(`Added ${items.length} item(s) to "${targetList?.name ?? 'list'}"`);
        navigate(`/lists/${selectedListId}`);
      }
    } catch (err: any) {
      console.error('Import failed:', err);
      toast.error(err.message || 'Failed to import list');
      setStage('review');
    }
  }

  const acceptedCount = rows.filter(
    (r) => r.decision === 'accept' && r.selectedIndex >= 0
  ).length;

  const submitDisabled =
    stage === 'submitting' ||
    acceptedCount === 0 ||
    (listTarget === 'existing' && !selectedListId);

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Import List</h1>
          <p className="text-gray-400">
            Paste a Gemini-extracted list of upcoming titles. Each is matched to TMDB for you to
            review, then saved as a private curated list you can share per-item.
          </p>
        </div>

        {stage === 'input' && (
          <>
            <div className="bg-gray-800 rounded-lg p-4">
              <button
                onClick={() => setShowPrompt((p) => !p)}
                className="text-sm text-primary-400 hover:text-primary-300 font-medium"
              >
                {showPrompt ? '▼ Hide' : '▶ Show'} the Gemini prompt to use
              </button>
              {showPrompt && (
                <pre className="mt-3 text-xs text-gray-300 bg-gray-900 rounded p-3 whitespace-pre-wrap">
                  {GEMINI_PROMPT}
                </pre>
              )}
            </div>

            <div className="bg-gray-800 rounded-lg p-6 space-y-4">
              <label className="block text-sm font-medium text-gray-300">
                Paste list — one per line:{' '}
                <code className="text-gray-400">Title | tv or movie | comment</code>
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={12}
                placeholder={"Dune: Part Three | movie | The conclusion of Villeneuve's saga.\nSeverance Season 3 | tv | Apple's mystery-box thriller returns."}
                className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none font-mono text-sm"
              />
              <button
                onClick={handleSearch}
                disabled={!rawText.trim()}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Parse & Match on TMDB
              </button>
            </div>
          </>
        )}

        {stage === 'searching' && (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <div className="w-10 h-10 mx-auto mb-4 animate-spin rounded-full border-4 border-gray-600 border-t-primary-500" />
            <p className="text-white font-medium">
              Matching titles on TMDB… {progress.done} / {progress.total}
            </p>
          </div>
        )}

        {(stage === 'review' || stage === 'submitting') && (
          <>
            {parseErrors.length > 0 && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                <p className="text-red-300 font-medium text-sm mb-2">
                  {parseErrors.length} line(s) skipped (format errors):
                </p>
                <ul className="text-xs text-red-300/80 space-y-1">
                  {parseErrors.map((e) => (
                    <li key={e.lineNumber}>
                      Line {e.lineNumber}: {e.parseError} — <span className="italic">{e.raw}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* List destination */}
            <div className="bg-gray-800 rounded-lg p-6 space-y-4">
              <p className="text-sm font-medium text-gray-300">List destination</p>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={listTarget === 'new'}
                    onChange={() => setListTarget('new')}
                    className="accent-primary-500"
                  />
                  <span className="text-white text-sm">Create new list</span>
                </label>
                <label className={`flex items-center gap-2 ${existingLists.length === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="radio"
                    checked={listTarget === 'existing'}
                    onChange={() => setListTarget('existing')}
                    disabled={existingLists.length === 0}
                    className="accent-primary-500"
                  />
                  <span className="text-white text-sm">Add to existing list</span>
                </label>
              </div>

              {listTarget === 'new' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      List name
                    </label>
                    <input
                      type="text"
                      value={listName}
                      onChange={(e) => setListName(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={listDescription}
                      onChange={(e) => setListDescription(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {listTarget === 'existing' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Select list
                  </label>
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
                  >
                    {existingLists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.itemCount} items)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">
                {acceptedCount} of {rows.length} will be imported
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setStage('input')}
                  disabled={stage === 'submitting'}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm font-medium disabled:opacity-40"
                >
                  ← Edit input
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitDisabled}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {stage === 'submitting'
                    ? listTarget === 'new' ? 'Creating…' : 'Adding…'
                    : listTarget === 'new'
                      ? `Create curated list (${acceptedCount})`
                      : `Add to list (${acceptedCount})`}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {rows.map((row) => (
                <ImportReviewRow
                  key={row.lineNumber}
                  row={row}
                  onSetDecision={setDecision}
                  onSelectCandidate={selectCandidate}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
