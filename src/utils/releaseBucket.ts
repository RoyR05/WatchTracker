export type ReleaseBucket = 'available' | 'coming_soon' | 'announced';

interface DatedItem {
  release_date: string | null;
  media_year: number | null;
}

/**
 * Classifies a plan-to-watch item into one of three release buckets.
 *
 * Date-first: if we have a full release_date we trust it. Otherwise fall back to
 * media_year so already-released catalog titles aren't mislabeled "Announced"
 * before the Dashboard backfill populates release_date.
 *
 *  - available    → released (date today/past, or a past year)
 *  - coming_soon  → has a future date, or a future year
 *  - announced    → no date and current-year-or-unknown (TBA)
 */
export function releaseBucket(item: DatedItem): ReleaseBucket {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (item.release_date) {
    return new Date(item.release_date) <= today ? 'available' : 'coming_soon';
  }

  const yr = item.media_year;
  if (yr != null) {
    if (yr < today.getFullYear()) return 'available';
    if (yr > today.getFullYear()) return 'coming_soon';
  }

  return 'announced';
}

/** Short human label for a Coming Soon release date, e.g. "Releases Mar 14, 2026". */
export function releasesLabel(release_date: string | null): string | null {
  if (!release_date) return null;
  const d = new Date(release_date);
  if (isNaN(d.getTime())) return null;
  return `Releases ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
