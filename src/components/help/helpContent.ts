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
    blurb: 'Your home base — personalised sections showing what you are watching, what is coming up, and what is trending.',
    bullets: [
      'Tap ⚙ Customize (top-right) to reorder sections or hide the ones you do not use.',
      '"Currently Watching" hides shows that have been on a long hiatus and re-shows them as they return — configure the threshold in Profile.',
      '"Coming Soon" shows your Plan to Watch titles that have a future release date, sorted by soonest first.',
      'Use the heart / thumbs on any discovery card to like or dislike — disliked titles stop appearing in Trending, Anticipated, and Popular.',
      'The Discovery Filters bar (Movies / TV, Today / This Week, English Only) applies to all three discovery rows below it.',
    ],
  },
  {
    match: '/discovery',
    title: 'Discovery',
    blurb: 'Find something new to watch in a few different ways.',
    bullets: [
      'Feeling Lucky picks a title based on your Plan to Watch list, liked genres, or a wildcard — tap Next to cycle through suggestions.',
      'Stack up to 2 moods in Mood Discovery to blend their genres into a custom mix.',
      '"From People You Follow" surfaces new & upcoming work by the actors, directors, and creators you follow — use the person pills to filter by a specific name.',
      'Tap the eye-slash icon on any followed-feed card to permanently hide that title from the feed.',
      '"Browse by Streaming Service" shows what is currently available on Netflix, Disney+, Apple TV+, Paramount+, and more.',
      'Genre browser lets you drill into a specific category across movies and TV.',
      'Tap the grid icon (Browse) for advanced filtering by genre, streaming service, release year, and rating all at once.',
    ],
  },
  {
    match: '/browse',
    title: 'Browse',
    blurb: 'Advanced search across movies and TV with multiple filters applied at the same time.',
    bullets: [
      'Filter by genre, streaming service, release year range, and minimum rating — combine as many as you like.',
      'Switch between Movies and TV at the top.',
      'Scroll down to load more results.',
      'Tap any card to open its detail page and add it to your watchlist.',
    ],
  },
  {
    match: '/search',
    title: 'Search',
    blurb: 'Search across movies, TV shows, and people by name.',
    bullets: [
      'Use the All / Movies / TV / People pills to narrow results.',
      'Tap a person result to see their full filmography and Follow them.',
      'Tap any title result to open its detail page.',
    ],
  },
  {
    match: '/watchlist',
    title: 'Watchlist',
    blurb: 'Everything you are tracking, organised by status.',
    bullets: [
      'Four statuses: Watching, Plan to Watch, Completed, Dropped.',
      'Plan to Watch auto-splits into three groups: Available Now, Coming Soon (future release date), and Announced (no date yet).',
      'Coming Soon items show an amber "Releases [date]" badge; Announced items show a grey badge.',
      'When a Coming Soon title\'s release date arrives, you receive a notification automatically.',
      'Filter by Movies / TV, sort by title, date added, rating, or release date, and search within your list.',
      'Set a status from any title\'s detail page or by swiping a card (right = Plan to Watch, left = Completed).',
    ],
  },
  {
    match: '/lists',
    title: 'My Lists',
    blurb: 'Build custom curated lists and share individual picks with friends.',
    bullets: [
      'Create a list, then add titles to it from any detail page.',
      'On a list you own, each item has a Recommend button to share it directly with a friend.',
      'Lists can be public (visible to other users) or private.',
    ],
  },
  {
    match: '/calendar',
    title: 'Calendar',
    blurb: 'Upcoming episodes and movie release dates for things on your watchlist.',
    bullets: [
      'Defaults to the fast List view; switch to the month grid using the toggle at the top.',
      'Only shows titles you have set to Watching or Plan to Watch.',
      'Tap any entry to jump straight to that title\'s detail page.',
    ],
  },
  {
    match: '/following',
    title: 'Following',
    blurb: 'People — actors, directors, and creators — that you follow.',
    bullets: [
      'Follow someone from their person page or any cast / crew card on a detail page.',
      'Their new & upcoming titles appear in the "From People You Follow" row on the Discovery page.',
      'Tap Unfollow here to stop tracking someone.',
    ],
  },
  {
    match: '/recommendations',
    title: 'Recommendations',
    blurb: 'Titles friends recommended to you, and the ones you have sent.',
    bullets: [
      'You can only recommend to mutual-follow friends (both of you must be connected).',
      'A red badge on the Recs tab means you have new unread recommendations.',
      'Tap a recommendation to open the title detail page and decide whether to add it to your watchlist.',
    ],
  },
  {
    match: '/plex-requests',
    title: 'Plex Requests',
    blurb: 'Request titles that are missing from the Plex library.',
    bullets: [
      'From any title detail page, tap "Check Plex" first. If it is missing, tap "Request it".',
      'Track the status of your requests here: Pending, Approved, Added, or Rejected.',
      'You receive a notification when the status of a request changes.',
      'You can cancel a Pending request if you change your mind.',
    ],
  },
  {
    match: '/profile',
    title: 'Profile & Preferences',
    blurb: 'Your account settings and the preferences that power personalised discovery.',
    bullets: [
      'Discovery Preferences: pick favourite genres and toggle English Only — these tailor Feeling Lucky, Feeling Lucky, and all Discovery results.',
      'Currently Watching settings: control how long a show can be on hiatus before it is hidden from your Dashboard, and how many days before its return it re-appears.',
      'Push Notifications: enable to get episode alerts and release notifications even when the app is closed. On iOS, install the app to your Home Screen first (requires iOS 16.4+).',
      'You can also update your photo, username, and password here.',
      'Dashboard layout is customised directly on the Dashboard using the ⚙ Customize button — not here.',
    ],
  },
  {
    match: '/details',
    title: 'Title details',
    blurb: 'Everything about a movie or TV show in one place.',
    bullets: [
      'Set a watchlist status, like / dislike, add to a custom list, or recommend it to a friend.',
      'Cast / Crew tabs — tap Follow on anyone to track their future work in your Discovery feed.',
      'TV shows: tap any episode to mark it watched. Enable the lightning-bolt Auto-fill to also mark all earlier unwatched episodes in the season.',
      '"Mark Season Watched" marks an entire season at once; when you finish a series, the status auto-updates to Completed.',
      'Check Plex to see if the title is available; if it is missing, request it and track the status in Plex Requests.',
      'Write a private note visible only to you — useful for recording where you left off or reminders.',
    ],
  },
  {
    match: '/notifications',
    title: 'Notifications',
    blurb: 'Episode alerts, release notifications, incoming recommendations, and Plex status updates.',
    bullets: [
      'Episode alerts fire when a show you are Watching has a new episode airing soon.',
      '"Now available" alerts fire when a title in your Coming Soon bucket reaches its release date.',
      'Plex updates tell you when a request was approved or added to the library.',
      'Tap any notification to jump to the relevant title or page.',
      'Tap the X on a notification to dismiss it; "Clear All" removes every notification at once.',
      'The red badge on the bell icon in the header shows your unread count.',
    ],
  },
  {
    match: '/person',
    title: 'Person page',
    blurb: 'Full filmography for an actor, director, or creator.',
    bullets: [
      'Tap Follow to track this person — their new & upcoming titles appear in the "From People You Follow" Discovery row.',
      'Switch between Movies and TV tabs to browse all their credits.',
      'Tap any title to open its detail page and add it to your watchlist.',
      'Tap Unfollow at any time to stop tracking their work.',
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
