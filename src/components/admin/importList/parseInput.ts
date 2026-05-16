// Parser for the admin curated-list import.
// Expected input: one entry per line, pipe-delimited: `Title | tv or movie | comment`
// Blank lines and lines starting with `#` are ignored.

export interface ParsedLine {
  raw: string;
  lineNumber: number;
  title: string;
  mediaType: 'movie' | 'tv';
  comment: string;
  parseError?: string;
}

function normalizeType(value: string): 'movie' | 'tv' | null {
  const v = value.trim().toLowerCase();
  if (v === 'tv' || v === 'series' || v === 'show' || v === 'tv show') return 'tv';
  if (v === 'movie' || v === 'film') return 'movie';
  return null;
}

export function parseCuratedInput(text: string): ParsedLine[] {
  const lines = text.split('\n');
  const result: ParsedLine[] = [];

  lines.forEach((raw, index) => {
    const lineNumber = index + 1;
    const trimmed = raw.trim();

    // Skip blank lines and comment lines
    if (trimmed === '' || trimmed.startsWith('#')) return;

    const parts = trimmed.split('|');

    if (parts.length !== 3) {
      result.push({
        raw,
        lineNumber,
        title: parts[0]?.trim() ?? '',
        mediaType: 'movie',
        comment: '',
        parseError:
          parts.length < 3
            ? 'Expected "Title | tv or movie | comment" (need exactly two | characters)'
            : 'Too many | characters — comment must not contain a pipe',
      });
      return;
    }

    const title = parts[0].trim();
    const mediaType = normalizeType(parts[1]);
    const comment = parts[2].trim();

    if (!title) {
      result.push({
        raw,
        lineNumber,
        title: '',
        mediaType: 'movie',
        comment,
        parseError: 'Missing title',
      });
      return;
    }

    if (!mediaType) {
      result.push({
        raw,
        lineNumber,
        title,
        mediaType: 'movie',
        comment,
        parseError: `Type must be "tv" or "movie" (got "${parts[1].trim()}")`,
      });
      return;
    }

    result.push({ raw, lineNumber, title, mediaType, comment });
  });

  return result;
}
