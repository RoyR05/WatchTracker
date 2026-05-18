export interface HelpTopic {
  /** path prefix to match against location.pathname; longest match wins */
  match: string;
  title: string;
  blurb: string;
  bullets: string[];
}

// Order doesn't matter — HelpPanel picks the longest `match` that
// prefixes the current pathname, falling back to the '/' entry.
export const HELP_TOPICS: HelpTopic[] = [
  {
    match: '/',
    title: 'Dashboard',
    blurb: 'Your home base — trending, anticipated, and popular titles, plus what you are currently watching.',
    bullets: [
      'Tap any poster to open its detail page.',
      'Use the heart / thumbs to like or dislike — disliked titles stop showing up in Trending, Anticipated, and Popular.',
      'Switch Movies / TV with the toggle at the top of each row.',
      '"Currently Watching" at the top lets you jump straight back to what you are in the middle of.',
    ],
  },
  {
    match: '/discovery',
    title: 'Discovery',
    blurb: 'Find something new to watch in a few different ways.',
    bullets: [
      'Feeling Lucky picks something based on your Plan to Watch list, liked genres, or a wildcard — tap Next to cycle.',
      'Stack up to 2 moods in Mood Discovery to blend their genres.',
      '"From People You Follow" surfaces new & upcoming work — use the person pills to filter by a specific creator.',
      'Tap the eye-slash icon on any followed-feed card to hide it permanently.',
      '"Browse by Streaming Service" shows what is on Netflix, Disney+, Paramount+, etc.',
      'Genre browser lets you drill into a specific category.',
    ],
  },
  {
    match: '/search',
    title: 'Search',
    blurb: 'Search across movies, TV shows, and people.',
    bullets: [
      'Use the All / Movies / TV / People pills to filter results.',
      'Tap a person to see their full filmography and Follow them.',
    ],
  },
  {
    match: '/watchlist',
    title: 'Watchlist',
    blurb: 'Everything you are tracking, grouped by status.',
    bullets: [
      'Statuses: Watching, Plan to Watch, Completed, Dropped.',
      'Filter by Movies/TV, sort, and search within your list.',
      'Set a status from any title page or by long-pressing a card.',
    ],
  },
  {
    match: '/lists',
    title: 'My Lists',
    blurb: 'Build custom lists and share individual items with friends.',
    bullets: [
      'Create a list, then add titles to it from any detail page.',
      'On a list you own, each item has a Recommend button to share it.',
    ],
  },
  {
    match: '/calendar',
    title: 'Calendar',
    blurb: 'Upcoming episodes and movie releases for things on your watchlist.',
    bullets: [
      'Defaults to the fast List view; switch to the month grid anytime.',
      'Only shows shows/movies you are Watching or Plan to Watch.',
    ],
  },
  {
    match: '/following',
    title: 'Following',
    blurb: 'People (actors, directors, creators) you follow.',
    bullets: [
      'Follow someone from their person page or any cast/crew card on a detail page.',
      'Their new & upcoming titles appear in the "From People You Follow" Discovery feed.',
      'Tap Unfollow here to stop tracking someone.',
    ],
  },
  {
    match: '/recommendations',
    title: 'Recommendations',
    blurb: 'Titles friends recommended to you, and the ones you sent.',
    bullets: [
      'You can only recommend to mutual-share friends.',
      'A red badge on the Recs tab means you have new recommendations.',
    ],
  },
  {
    match: '/plex-requests',
    title: 'Plex Requests',
    blurb: 'Ask the admin to add a title that is not on Plex yet.',
    bullets: [
      'Check Plex from a title page first; if it is missing you can Request it.',
      'You will see status updates (Pending / Approved / Added / Rejected) here.',
    ],
  },
  {
    match: '/profile',
    title: 'Profile & Preferences',
    blurb: 'Your account and what powers your personalized discovery.',
    bullets: [
      'Discovery Preferences: pick favorite genres and toggle English Only.',
      'These tailor Feeling Lucky and the Discovery results to your taste.',
      'You can also change your photo, username, and password here.',
    ],
  },
  {
    match: '/details',
    title: 'Title details',
    blurb: 'Everything about a movie or show.',
    bullets: [
      'Set a watchlist status, like/dislike, add to a list, or recommend it.',
      'Cast / Crew tabs — tap Follow on anyone to track their future work.',
      'TV shows: tap an episode to mark it watched; enable Auto-fill gaps to backfill previous episodes automatically.',
      '"Mark Season Watched" marks an entire season at once; finished shows auto-complete to Completed.',
      'Check Plex, request it if missing, and write a private note visible only to you.',
    ],
  },
  {
    match: '/notifications',
    title: 'Notifications',
    blurb: 'Episode alerts, incoming recommendations, and Plex status updates all land here.',
    bullets: [
      'Tap the X on any notification to dismiss it.',
      '"Clear All" removes every notification at once.',
      'Unread count shows as a badge on the bell icon in the header.',
    ],
  },
  {
    match: '/person',
    title: 'Person page',
    blurb: 'Full filmography for an actor, director, or creator.',
    bullets: [
      'Tap Follow to track this person — their new & upcoming titles appear in your Discovery feed.',
      'Switch between Movies and TV tabs to browse their credits.',
      'Tap any title to open its detail page and add it to your watchlist.',
    ],
  },
];

export function topicForPath(pathname: string): HelpTopic {
  let best = HELP_TOPICS.find((t) => t.match === '/')!;
  for (const t of HELP_TOPICS) {
    if (t.match === '/') continue;
    if (pathname.startsWith(t.match) && t.match.length > best.match.length) {
      best = t;
    }
  }
  return best;
}
