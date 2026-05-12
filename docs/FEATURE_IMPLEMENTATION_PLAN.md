# WatchTracker Feature Enhancement Plan

## Overview
This document outlines the implementation plan for major feature additions to WatchTracker, organized by priority, complexity, and dependencies.

---

## Current State Assessment

### ✅ Existing Features
- User authentication and profiles
- Watchlist management (watching, completed, plan to watch, dropped)
- TV show episode tracking
- Custom lists with sharing
- Social following system
- Basic search
- Detail pages for movies/TV shows
- Recommendations feature (recently added)
- Calendar view (recently added)

### 🗄️ Current Database Tables
- `profiles` - User information
- `watchlist_items` - Main watchlist tracking
- `tv_show_progress` - Episode-level tracking
- `custom_lists` - User-created collections
- `list_items` - Items in collections
- `follows` - Social connections
- `list_shares` - Collaborative lists

---

## Implementation Phases

## PHASE 1: UI Foundation Enhancements
**Priority:** HIGH | **Complexity:** MEDIUM | **Duration:** 2-3 sessions

### Features
1. **Skeleton Loading States**
   - Replace all loading spinners with skeleton screens
   - Components: MediaCard, Dashboard, SearchPage, DetailPage, ListsPage
   - Better perceived performance

2. **Toast Notifications System**
   - Create reusable toast component
   - Toast context for global state
   - Success, error, info, warning variants
   - Auto-dismiss with timing control
   - Stack multiple toasts

3. **Infinite Scroll**
   - Implement on SearchPage
   - Implement on Dashboard trending section
   - Implement on ListsPage
   - Intersection Observer API
   - Loading states at bottom

### Database Changes
- None required

### New Files
- `src/components/ui/Skeleton.tsx`
- `src/components/ui/Toast.tsx`
- `src/contexts/ToastContext.tsx`
- `src/hooks/useInfiniteScroll.ts`

### Dependencies
- None

### Testing Checklist
- [ ] Skeletons match content dimensions
- [ ] Toasts appear/dismiss correctly
- [ ] Infinite scroll loads next page
- [ ] Existing features work unchanged

---

## PHASE 2: Mobile Interactions
**Priority:** MEDIUM | **Complexity:** MEDIUM | **Duration:** 2 sessions

### Features
1. **Swipe Gestures**
   - Swipe right on watchlist items to mark completed
   - Swipe left to remove
   - Swipe on episodes to toggle watched
   - Visual feedback during swipe

2. **Quick Actions (Long-Press Menus)**
   - Long-press on media cards
   - Context menu with actions:
     - Add to watchlist
     - Add to list
     - Share/Recommend
     - Mark as watched
   - Touch-friendly menu design

### Database Changes
- None required

### New Files
- `src/hooks/useSwipeGesture.ts`
- `src/hooks/useLongPress.ts`
- `src/components/ui/ContextMenu.tsx`

### Dependencies
- Toast notifications (Phase 1)

### Testing Checklist
- [ ] Swipe gestures work on touch devices
- [ ] Long-press doesn't trigger on desktop
- [ ] Actions execute correctly
- [ ] Visual feedback is clear

---

## PHASE 3: Enhanced TV Tracking
**Priority:** HIGH | **Complexity:** HIGH | **Duration:** 3-4 sessions

### Features
1. **Auto-Mark Episodes**
   - "Mark as watched" button on episode
   - Auto-mark previous episodes when marking a later one
   - "Auto-continue" toggle in settings
   - Batch episode marking

2. **Next Episode Countdown**
   - Show countdown for next airing episode
   - Display on detail page and dashboard
   - "Notify me" option

3. **Binge-Watch Session Tracking**
   - Track continuous watching sessions
   - Statistics: episodes watched, time spent
   - "Continue watching" with session resume
   - Session history view

4. **Season Finale Reminders**
   - Detect season/series finales
   - Optional reminder before finale airs
   - "Finale alert" badge

### Database Changes
```sql
-- Add to migration
CREATE TABLE IF NOT EXISTS binge_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  episodes_watched integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_binge_sessions_user ON binge_sessions(user_id);
CREATE INDEX idx_binge_sessions_tmdb ON binge_sessions(tmdb_id);

-- Add RLS policies
ALTER TABLE binge_sessions ENABLE ROW LEVEL SECURITY;

-- Add to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_continue_episodes boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_new_episodes boolean DEFAULT true;
```

### New Files
- `src/components/tv/BingeSessionTracker.tsx`
- `src/components/tv/NextEpisodeCountdown.tsx`
- `src/hooks/useBingeSession.ts`
- `src/services/sessionTracking.ts`

### Dependencies
- Toast notifications (Phase 1)

### Testing Checklist
- [ ] Auto-mark works correctly
- [ ] Countdown displays accurate time
- [ ] Sessions track properly
- [ ] Reminders fire at correct time

---

## PHASE 4: Advanced Search & Filters
**Priority:** HIGH | **Complexity:** MEDIUM | **Duration:** 2-3 sessions

### Features
1. **Advanced Filters**
   - Filter by genre (multi-select)
   - Filter by year range (slider)
   - Filter by rating (min/max)
   - Filter by runtime (min/max)
   - Filter by status (for watchlist)

2. **Sorting Options**
   - Sort by popularity (trending)
   - Sort by rating (highest/lowest)
   - Sort by release date (newest/oldest)
   - Sort by title (A-Z)
   - Sort by date added (for watchlist)

3. **"Similar to This" Feature**
   - Use TMDB recommendations API
   - Display on detail pages
   - Carousel of similar content

### Database Changes
- None required (uses TMDB API)

### New Files
- `src/components/search/FilterPanel.tsx`
- `src/components/search/SortDropdown.tsx`
- `src/components/media/SimilarContent.tsx`
- `src/hooks/useFilters.ts`

### TMDB API Additions
```typescript
// Add to tmdb.ts
getSimilarMovies: async (movieId: number, page = 1)
getSimilarTVShows: async (tvId: number, page = 1)
getGenres: async (mediaType: 'movie' | 'tv')
discoverMovies: async (filters: DiscoverFilters, page = 1)
discoverTVShows: async (filters: DiscoverFilters, page = 1)
```

### Dependencies
- Infinite scroll (Phase 1)
- Toast notifications (Phase 1)

### Testing Checklist
- [ ] Filters combine correctly
- [ ] Sorting maintains filters
- [ ] Similar content is relevant
- [ ] Performance is acceptable

---

## PHASE 5: Content Discovery Hub
**Priority:** MEDIUM | **Complexity:** MEDIUM | **Duration:** 3 sessions

### Features
1. **"Feeling Lucky" Random Picker**
   - Random selection from watchlist
   - Random selection from genre
   - Filters: min rating, decade, type
   - Animated selection process

2. **Mood-Based Recommendations**
   - Predefined moods: Happy, Sad, Thrilling, Relaxing, Adventurous
   - Genre mapping per mood
   - Keyword-based search

3. **Decade Exploration**
   - Browse by decade (1950s - 2020s)
   - Top movies/shows per decade
   - Decade statistics

4. **Hidden Gems Discovery**
   - High-rated but lesser-known content
   - Filter: vote_count < threshold, vote_average > 7.5
   - Rotates weekly

5. **Festival Award Winners**
   - Curated lists of award-winning content
   - Categories: Oscar, Emmy, Golden Globe, Cannes, etc.
   - Updated annually

### Database Changes
```sql
-- Add to migration
CREATE TABLE IF NOT EXISTS discovery_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_genres integer[] DEFAULT '{}',
  favorite_decades text[] DEFAULT '{}',
  preferred_runtime_min integer DEFAULT 0,
  preferred_runtime_max integer DEFAULT 300,
  min_rating numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE discovery_preferences ENABLE ROW LEVEL SECURITY;
```

### New Files
- `src/pages/DiscoveryPage.tsx`
- `src/components/discovery/FeelingLuckyPicker.tsx`
- `src/components/discovery/MoodSelector.tsx`
- `src/components/discovery/DecadeExplorer.tsx`
- `src/components/discovery/HiddenGems.tsx`
- `src/services/discovery.ts`

### Dependencies
- Advanced filters (Phase 4)
- Toast notifications (Phase 1)

### Testing Checklist
- [ ] Random picker is truly random
- [ ] Mood selections are appropriate
- [ ] Decade filtering works
- [ ] Hidden gems meet criteria

---

## PHASE 6: Content Calendar Enhancement
**Priority:** HIGH | **Complexity:** HIGH | **Duration:** 3-4 sessions

### Features
1. **Upcoming Releases Tracking**
   - Track unreleased movies/shows
   - Show release dates on calendar
   - Filter calendar by tracked items

2. **TV Episode Calendar**
   - Show all episode air dates for watching shows
   - Weekly view, monthly view
   - Today's episodes highlighted

3. **Release Notifications** (requires push notifications)
   - Notify day before release
   - Notify on release day
   - Customizable notification timing

4. **"What to Watch Tonight"**
   - Smart suggestions based on:
     - Available time (runtime filter)
     - Current mood (user input)
     - Unwatched episodes airing today
     - Plan to watch items
   - Refreshes daily

### Database Changes
```sql
-- Add to migration
CREATE TABLE IF NOT EXISTS release_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  release_date date NOT NULL,
  notify_enabled boolean DEFAULT true,
  notify_days_before integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_release_tracking_user ON release_tracking(user_id);
CREATE INDEX idx_release_tracking_date ON release_tracking(release_date);

ALTER TABLE release_tracking ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS tv_episode_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tmdb_id integer NOT NULL,
  season_number integer NOT NULL,
  episode_number integer NOT NULL,
  air_date date NOT NULL,
  episode_name text,
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tv_calendar_user ON tv_episode_calendar(user_id);
CREATE INDEX idx_tv_calendar_date ON tv_episode_calendar(air_date);

ALTER TABLE tv_episode_calendar ENABLE ROW LEVEL SECURITY;
```

### New Files
- `src/components/calendar/UpcomingReleases.tsx`
- `src/components/calendar/EpisodeCalendar.tsx`
- `src/components/calendar/WhatToWatchTonight.tsx`
- `src/hooks/useReleaseTracking.ts`
- `src/services/releaseNotifications.ts`

### Dependencies
- Calendar page (existing)
- Toast notifications (Phase 1)

### Testing Checklist
- [ ] Calendar shows correct dates
- [ ] Notifications fire correctly
- [ ] Tonight suggestions are relevant
- [ ] Timezone handling is correct

---

## PHASE 7: Personalized Recommendations Engine
**Priority:** HIGH | **Complexity:** VERY HIGH | **Duration:** 4-5 sessions

### Features
1. **Viewing History Analysis**
   - Track all completed items
   - Genre preferences calculation
   - Actor/director preferences
   - Rating patterns

2. **"Because You Watched X" Suggestions**
   - Use TMDB similar/recommended APIs
   - Weight by user's rating of X
   - Filter out already watched
   - Display on dashboard

3. **Trending Among Followed Users**
   - Aggregate watchlists of followed users
   - Show popular items in network
   - Social proof ("3 friends are watching this")

4. **Genre-Based Discovery**
   - Deep-dive into user's top genres
   - Discover new content in favorite genres
   - Cross-genre recommendations

### Database Changes
```sql
-- Add to migration
CREATE TABLE IF NOT EXISTS viewing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  watched_at timestamptz DEFAULT now(),
  user_rating numeric,
  genres integer[],
  cast_ids integer[],
  director_ids integer[]
);

CREATE INDEX idx_viewing_history_user ON viewing_history(user_id);
CREATE INDEX idx_viewing_history_date ON viewing_history(watched_at DESC);

ALTER TABLE viewing_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS recommendation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recommendations jsonb NOT NULL,
  recommendation_type text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX idx_rec_cache_user ON recommendation_cache(user_id);
CREATE INDEX idx_rec_cache_type ON recommendation_cache(recommendation_type);
CREATE INDEX idx_rec_cache_expires ON recommendation_cache(expires_at);

ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;
```

### New Files
- `src/pages/RecommendationsEnginePage.tsx`
- `src/components/recommendations/BecauseYouWatched.tsx`
- `src/components/recommendations/TrendingInNetwork.tsx`
- `src/components/recommendations/GenreDeepDive.tsx`
- `src/services/recommendationEngine.ts`
- `src/hooks/usePersonalizedRecs.ts`

### Edge Function
- `supabase/functions/generate-recommendations/index.ts`
  - Analyzes viewing history
  - Calculates preferences
  - Fetches TMDB recommendations
  - Caches results

### Dependencies
- Viewing history tracking
- Social follows (existing)
- Toast notifications (Phase 1)

### Testing Checklist
- [ ] Recommendations are personalized
- [ ] Social recommendations work
- [ ] Cache invalidation works
- [ ] Performance is acceptable

---

## Additional Enhancements & Suggestions

### 🎨 Design Improvements
1. **Dark/Light Theme Toggle**
   - User preference saved in profile
   - Smooth transition between themes
   - System preference detection

2. **Customizable Dashboard**
   - Drag-and-drop sections
   - Hide/show sections
   - Layout preferences saved

3. **Better Empty States**
   - Illustrations for empty lists
   - Actionable suggestions
   - Onboarding tips

### ⚡ Performance Optimizations
1. **Image Lazy Loading**
   - Already using browser native lazy load
   - Add blur-up placeholder effect

2. **Code Splitting**
   - Route-based splitting (already done)
   - Component lazy loading for modals

3. **Database Query Optimization**
   - Add compound indexes
   - Materialize common views
   - Cache frequent queries

### 🔔 Push Notifications (Future Phase)
1. **Service Worker Notifications**
   - New episode released
   - Friend recommendations
   - List updates
   - Trending alerts

2. **Notification Preferences**
   - Granular control
   - Quiet hours
   - Notification grouping

### 📊 Analytics Dashboard (Future Phase)
1. **Personal Statistics**
   - Total watch time
   - Movies vs TV ratio
   - Favorite genres
   - Completion rate
   - Yearly wrapped

2. **Social Statistics**
   - Most followed users
   - List popularity
   - Recommendation success rate

### 🔐 Privacy & Security
1. **Privacy Settings**
   - Hide watchlist from others
   - Private profile option
   - Block users

2. **Data Export**
   - Export watchlist as CSV/JSON
   - Import from other services

3. **Account Management**
   - Delete account
   - Download all data
   - Privacy policy

---

## Implementation Priority Matrix

### Must Have (P0)
- ✅ Phase 1: UI Foundation (Skeletons, Toasts, Infinite Scroll)
- ✅ Phase 3: Enhanced TV Tracking
- ✅ Phase 4: Advanced Search & Filters
- ✅ Phase 6: Content Calendar Enhancement

### Should Have (P1)
- ✅ Phase 7: Personalized Recommendations Engine
- ✅ Phase 5: Content Discovery Hub

### Nice to Have (P2)
- ✅ Phase 2: Mobile Interactions
- Theme Toggle
- Custom Dashboard
- Analytics

### Future Considerations (P3)
- Push Notifications
- Data Import/Export
- Advanced Privacy Controls

---

## Technical Considerations

### TMDB API Rate Limits
- Current: ~40 requests/10 seconds
- Mitigation:
  - Cache responses in edge function
  - Batch requests where possible
  - Use stored data when available

### Database Performance
- Add indexes for new tables
- Regular VACUUM and ANALYZE
- Monitor slow queries
- Consider pagination limits

### Mobile Performance
- Minimize bundle size
- Optimize images
- Reduce animation complexity
- Test on low-end devices

### Browser Compatibility
- Test on major browsers
- Progressive enhancement
- Polyfills where needed
- Service worker support detection

---

## Testing Strategy

### Unit Tests (Future)
- Component rendering
- Hook logic
- Service functions
- Utility functions

### Integration Tests (Future)
- User flows
- API integration
- Database operations
- Authentication

### Manual Testing Checklist
- [ ] All existing features work
- [ ] New features work as expected
- [ ] Mobile responsive
- [ ] Touch interactions
- [ ] Loading states
- [ ] Error handling
- [ ] Edge cases

### Accessibility Testing
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast
- [ ] Focus indicators
- [ ] ARIA labels

---

## Rollout Strategy

### Phase 1-2: Foundation (Week 1-2)
Deploy UI enhancements and mobile interactions

### Phase 3-4: Core Features (Week 3-4)
Deploy TV tracking and search enhancements

### Phase 5-6: Discovery (Week 5-6)
Deploy content discovery and calendar features

### Phase 7: Intelligence (Week 7-8)
Deploy recommendation engine

### Post-Launch (Week 9+)
- Monitor performance
- Gather user feedback
- Bug fixes
- Refinements

---

## Success Metrics

### User Engagement
- Daily active users
- Session duration
- Features used per session
- Return rate

### Feature Adoption
- % using new features
- Feature usage frequency
- User feedback scores

### Performance
- Page load time
- Time to interactive
- API response time
- Error rate

### Technical Health
- Build size
- Lighthouse scores
- Bug report rate
- Uptime

---

## Risk Assessment

### High Risk
- **Recommendation engine complexity**
  - Mitigation: Start simple, iterate
  - Fallback: Use TMDB recommendations only

- **TMDB API rate limits**
  - Mitigation: Aggressive caching
  - Fallback: Reduce API calls, queue requests

### Medium Risk
- **Mobile gesture conflicts**
  - Mitigation: Extensive testing
  - Fallback: Make gestures optional

- **Database query performance**
  - Mitigation: Proper indexing
  - Fallback: Limit result sets, pagination

### Low Risk
- **UI component complexity**
  - Mitigation: Reusable components
  - Rollback: Easy to revert

---

## Conclusion

This plan provides a comprehensive roadmap for enhancing WatchTracker with modern features while maintaining stability and performance. The phased approach allows for:

1. **Incremental delivery** - Features ship progressively
2. **Risk management** - Each phase is independently testable
3. **Flexibility** - Phases can be reordered based on feedback
4. **Quality assurance** - Existing features remain functional

The implementation should take approximately 8-10 weeks with regular testing and refinement.
