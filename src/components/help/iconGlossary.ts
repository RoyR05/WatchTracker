export interface IconEntry {
  group: string;
  name: string;
  description: string;
  paths: string[];          // one or more SVG <path d="..."> values
  fill?: 'none' | 'currentColor'; // default 'none' (stroke icons)
}

export const ICON_GLOSSARY: IconEntry[] = [
  // ── Header bar (mobile top bar) ─────────────────────────────────
  {
    group: 'Header bar',
    name: 'Following',
    description: 'Manage people you follow — actors, directors, and creators.',
    paths: [
      'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    ],
  },
  {
    group: 'Header bar',
    name: 'Calendar',
    description: 'Upcoming episodes and release dates for things on your watchlist.',
    paths: [
      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    ],
  },
  {
    group: 'Header bar',
    name: 'Recommendations',
    description: 'Titles friends recommended to you. A red badge means new ones are waiting.',
    paths: [
      'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
    ],
  },
  {
    group: 'Header bar',
    name: 'Help',
    description: 'Opens this help panel.',
    paths: [
      'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    ],
  },
  {
    group: 'Header bar',
    name: 'Notifications',
    description: 'Episode alerts, Plex status updates, and messages. Red badge = unread.',
    paths: [
      'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    ],
  },

  {
    group: 'Header bar',
    name: 'Customize Dashboard',
    description: 'Opens the Dashboard customisation drawer — drag sections to reorder them or toggle the eye to show/hide individual sections.',
    paths: [
      'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
    ],
  },

  // ── Bottom navigation ────────────────────────────────────────────
  {
    group: 'Bottom navigation',
    name: 'Browse',
    description: 'Advanced filtering — combine genre, streaming service, release year, and rating to find exactly what you want.',
    paths: [
      'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
    ],
  },
  {
    group: 'Bottom navigation',
    name: 'Home',
    description: 'Dashboard — trending, anticipated, and popular titles.',
    paths: [
      'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    ],
  },
  {
    group: 'Bottom navigation',
    name: 'Discover',
    description: "Feeling Lucky, Moods, Genres, Streaming Services, and your followed people's feed.",
    paths: [
      'M13 3l1.9 5.7a2 2 0 001.4 1.4L22 12l-5.7 1.9a2 2 0 00-1.4 1.4L13 21l-1.9-5.7a2 2 0 00-1.4-1.4L4 12l5.7-1.9a2 2 0 001.4-1.4L13 3z',
    ],
  },
  {
    group: 'Bottom navigation',
    name: 'Search',
    description: 'Search movies, TV shows, and people by name.',
    paths: ['M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'],
  },
  {
    group: 'Bottom navigation',
    name: 'Watchlist',
    description: 'Everything you are tracking — Watching, Plan to Watch, Completed, Dropped.',
    paths: ['M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z'],
  },
  {
    group: 'Bottom navigation',
    name: 'My Lists',
    description: 'Custom curated lists you can recommend from.',
    paths: ['M4 6h16M4 12h16M4 18h7'],
  },

  // ── On cards ─────────────────────────────────────────────────────
  {
    group: 'On cards',
    name: 'Star rating',
    description: 'TMDB audience rating out of 10.',
    paths: [
      'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z',
    ],
    fill: 'currentColor',
  },
  {
    group: 'On cards',
    name: 'Hide from feed',
    description: 'Permanently hides this card from your "From People You Follow" feed.',
    paths: [
      'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21',
    ],
  },
  {
    group: 'On cards',
    name: 'Like',
    description: 'Thumbs up — signals you enjoy this type of content and personalizes your results.',
    paths: [
      'M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5',
    ],
  },
  {
    group: 'On cards',
    name: 'Dislike',
    description: 'Thumbs down — hides this title from Trending, Anticipated, and Popular sections.',
    paths: [
      'M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5',
    ],
  },

  {
    group: 'On cards',
    name: 'Section visibility (eye)',
    description: 'In the Dashboard Customize drawer — eye open means the section is visible; eye-slash means it is hidden. Tap to toggle.',
    paths: [
      'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    ],
  },

  // ── Episode tracker ───────────────────────────────────────────────
  {
    group: 'Episode tracker',
    name: 'Auto-fill gaps',
    description:
      'Lightning bolt — when on, checking an episode also marks all earlier unwatched episodes in the season (and prior seasons) as watched.',
    paths: ['M13 10V3L4 14h7v7l9-11h-7z'],
  },
  {
    group: 'Episode tracker',
    name: 'Mark Season Watched',
    description: 'Clipboard with checkmark — marks every unwatched episode in the current season at once.',
    paths: [
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    ],
  },
  {
    group: 'Episode tracker',
    name: 'Set Reminder',
    description: 'Bell (amber) — sets a notification for an upcoming episode or season finale.',
    paths: [
      'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    ],
  },
];

/** Group entries by their `group` field, preserving insertion order. */
export function groupedGlossary(): Array<{ group: string; entries: IconEntry[] }> {
  const map = new Map<string, IconEntry[]>();
  for (const entry of ICON_GLOSSARY) {
    if (!map.has(entry.group)) map.set(entry.group, []);
    map.get(entry.group)!.push(entry);
  }
  return Array.from(map.entries()).map(([group, entries]) => ({ group, entries }));
}
