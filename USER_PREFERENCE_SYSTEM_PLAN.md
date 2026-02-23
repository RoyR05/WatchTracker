# User Preference System - Comprehensive Implementation Plan

## Executive Summary

This document outlines a complete preference learning system for WatchTracker that captures user feedback (likes/dislikes) and uses this data to improve content recommendations. The system builds upon the existing interaction tracking infrastructure and extends it with explicit preference signals.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Data Structure Design](#data-structure-design)
3. [User Interface Components](#user-interface-components)
4. [Recommendation Algorithm](#recommendation-algorithm)
5. [Technical Implementation](#technical-implementation)
6. [Privacy & Security](#privacy--security)
7. [Performance Optimization](#performance-optimization)
8. [A/B Testing Framework](#ab-testing-framework)
9. [Implementation Roadmap](#implementation-roadmap)

---

## Current State Analysis

### Existing Infrastructure

**What We Have:**
- `user_interactions` table: Tracks implicit interactions (viewed_detail, added_to_watchlist, rated, completed, searched_for, clicked_similar)
- `profile_affinity` table: Stores learned preferences (genre, actor, director, decade affinities with scores 0-100)
- `updateProfileAffinities()` function: Processes interactions into affinities using weighted scoring
- Profile-based isolation: Each profile tracks preferences independently

**Interaction Weights (Current):**
```typescript
{
  viewed_detail: 1,
  added_to_watchlist: 3,
  rated: 5,
  completed: 4,
  searched_for: 2,
  clicked_similar: 1
}
```

**What's Missing:**
- Explicit like/dislike feedback mechanism
- Negative preference tracking (what users dislike)
- Content-specific preferences (individual movie/show preferences)
- Recency weighting in affinity calculations
- Similarity-based collaborative filtering

---

## Data Structure Design

### 1. Content Preferences Table (NEW)

**Purpose:** Store explicit user feedback (like/dislike/neutral) for specific content

```sql
CREATE TABLE content_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text CHECK (media_type IN ('movie', 'tv')) NOT NULL,

  -- Preference signal
  preference text CHECK (preference IN ('like', 'dislike', 'neutral', 'love', 'hate')) NOT NULL,

  -- Context
  reason text[], -- Optional tags like ['too-slow', 'great-acting', 'boring']
  feedback_context text, -- Optional free-form feedback

  -- Metadata at time of feedback
  content_metadata jsonb DEFAULT '{}'::jsonb, -- Store genre_ids, cast, director, etc.

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT unique_content_pref UNIQUE(profile_id, tmdb_id, media_type)
);

-- Indexes for performance
CREATE INDEX idx_content_pref_profile ON content_preferences(profile_id);
CREATE INDEX idx_content_pref_preference ON content_preferences(profile_id, preference);
CREATE INDEX idx_content_pref_updated ON content_preferences(updated_at DESC);
CREATE INDEX idx_content_pref_tmdb ON content_preferences(tmdb_id, media_type);
```

**Preference Levels:**
- `love` (5 points): Absolutely loved it, want more like this
- `like` (3 points): Enjoyed it, would watch similar content
- `neutral` (0 points): Watched it, no strong feelings
- `dislike` (-3 points): Didn't enjoy it, avoid similar content
- `hate` (-5 points): Strongly disliked, actively avoid

### 2. Enhanced Profile Affinity Table (MODIFY EXISTING)

**Add negative affinity support:**

```sql
-- Modify existing table
ALTER TABLE profile_affinity
  ALTER COLUMN score TYPE decimal(6,2),
  DROP CONSTRAINT IF EXISTS profile_affinity_score_check,
  ADD CONSTRAINT profile_affinity_score_check CHECK (score >= -100 AND score <= 100);

-- Add new fields
ALTER TABLE profile_affinity
  ADD COLUMN IF NOT EXISTS positive_weight decimal(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negative_weight decimal(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interaction_count integer DEFAULT 0;

-- New index for negative affinities
CREATE INDEX IF NOT EXISTS idx_affinity_negative ON profile_affinity(profile_id, score ASC)
  WHERE score < 0;
```

**Score Range:** -100 (strongly avoid) to +100 (strongly prefer)

### 3. Enhanced User Interactions (MODIFY EXISTING)

**Add new interaction types:**

```sql
-- Add 'liked_content' and 'disliked_content' to interaction_type enum
-- This will be handled in the migration
```

**New Interaction Types:**
- `liked_content` (weight: 4)
- `disliked_content` (weight: -4)
- `loved_content` (weight: 6)
- `hated_content` (weight: -6)

### 4. Recommendation Cache Table (NEW)

**Purpose:** Pre-compute and cache recommendations for faster retrieval

```sql
CREATE TABLE recommendation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text CHECK (media_type IN ('movie', 'tv')) NOT NULL,

  -- Recommendation score and reasoning
  score decimal(6,2) NOT NULL,
  match_reasons jsonb DEFAULT '{}'::jsonb, -- Why recommended: {genre_match: 0.8, actor_match: 0.6}

  -- Cache management
  computed_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),

  -- Presentation tracking
  shown_count integer DEFAULT 0,
  last_shown_at timestamptz,

  CONSTRAINT unique_rec_cache UNIQUE(profile_id, tmdb_id, media_type)
);

CREATE INDEX idx_rec_cache_profile_score ON recommendation_cache(profile_id, score DESC);
CREATE INDEX idx_rec_cache_expires ON recommendation_cache(expires_at);
CREATE INDEX idx_rec_cache_shown ON recommendation_cache(profile_id, shown_count ASC, score DESC);
```

### 5. Data Model Relationships

```
user_profiles (1) ──→ (many) user_interactions
user_profiles (1) ──→ (many) content_preferences
user_profiles (1) ──→ (many) profile_affinity
user_profiles (1) ──→ (many) recommendation_cache

content_preferences.content_metadata (jsonb) stores:
{
  "genre_ids": [28, 12, 878],
  "cast": ["Tom Cruise", "Jennifer Connelly"],
  "director": "Joseph Kosinski",
  "release_year": 2022,
  "runtime": 130,
  "original_language": "en"
}
```

---

## User Interface Components

### 1. Like/Dislike Button System

**Placement Options:**

#### A. Detail Page - Primary Actions
**Location:** Below title, next to watchlist buttons
```
[+ Watchlist]  [👍 Like]  [👎 Dislike]
```

**Behavior:**
- Single tap toggles like/dislike
- Long press opens feedback modal with 5 levels + reason tags
- Animated feedback (button pulses, color change)
- Haptic feedback on mobile
- State persists immediately

#### B. Card Hover/Context Menu
**Location:** Media cards in browse/search views
```
[Card with overlay on hover]
  Quick Actions: 👍 👎
```

**Behavior:**
- Quick feedback without leaving browse view
- Appears on hover (desktop) or long-press (mobile)
- Card dims slightly when disliked
- Card brightens when liked

#### C. Post-Watch Prompt
**Location:** Modal after marking content as "Completed"
```
You finished watching "The Batman"!
How did you like it?

[😍 Loved it] [👍 Liked it] [😐 Meh] [👎 Didn't like] [😤 Hated it]

[Optional: Why? Select all that apply]
☐ Great story    ☐ Amazing acting    ☐ Beautiful visuals
☐ Too slow       ☐ Predictable       ☐ Poor pacing

[Skip] [Submit Feedback]
```

#### D. Swipe Gestures (Mobile-First)
```
Swipe Right → Like
Swipe Left → Dislike
Swipe Up → Add to Watchlist
```

### 2. Visual Feedback System

**Button States:**
```typescript
interface ButtonState {
  default: { bg: 'gray-700', icon: 'outline', opacity: 0.7 }
  liked: { bg: 'green-600', icon: 'solid', opacity: 1 }
  loved: { bg: 'green-500', icon: 'solid-double', opacity: 1, scale: 1.1 }
  disliked: { bg: 'red-600', icon: 'solid', opacity: 1 }
  hated: { bg: 'red-700', icon: 'solid-double', opacity: 1, scale: 1.1 }
}
```

**Icons:**
- Like: Thumbs up (outline → filled)
- Love: Double thumbs up or heart with stars
- Dislike: Thumbs down (outline → filled)
- Hate: Double thumbs down or X symbol

**Animations:**
```css
.preference-button {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.preference-button.liked {
  animation: pulse-green 0.5s;
  transform: scale(1.1);
}

@keyframes pulse-green {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
  50% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
}
```

### 3. Feedback Modal (Enhanced Input)

**Component Structure:**
```typescript
interface FeedbackModalProps {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string;
  onSubmit: (feedback: Feedback) => void;
}

interface Feedback {
  preference: 'love' | 'like' | 'neutral' | 'dislike' | 'hate';
  reasons?: string[];
  context?: string;
}
```

**Reason Tags (Predefined):**

Positive:
- great-story
- amazing-acting
- beautiful-visuals
- emotional
- thought-provoking
- fun
- rewatchable
- original
- well-paced

Negative:
- too-slow
- boring
- predictable
- poor-acting
- bad-visuals
- confusing
- too-long
- disappointing
- cliche
- offensive

**Modal Design:**
```
┌─────────────────────────────────────────┐
│  How did you feel about "Inception"?    │
│                                          │
│  [😍] [👍] [😐] [👎] [😤]              │
│  Love  Like  Meh  No  Hate              │
│                                          │
│  ⬇ Optional: Tell us more               │
│                                          │
│  Why? (Select all that apply)           │
│  [✓ Great story] [✓ Thought-provoking]  │
│  [✓ Amazing acting] [ Confusing]        │
│  [Show more...]                          │
│                                          │
│  Additional thoughts (optional)         │
│  ┌─────────────────────────────────┐   │
│  │ Mind-bending and brilliant! │   │   │
│  └─────────────────────────────────┘   │
│                                          │
│  [Skip]              [Submit Feedback]  │
└─────────────────────────────────────────┘
```

### 4. Preference Indicators

**Show user preferences throughout the app:**

#### A. On Media Cards
```
[Poster]
👍 Badge in corner if liked
👎 Badge if disliked
```

#### B. On Detail Page
```
Your rating: 👍 Liked (Jan 15, 2024)
[Edit feedback]
```

#### C. In Lists
```
Filter: [All] [Liked ❤️] [Disliked 💔] [No feedback 📝]
Sort: Most liked first | Most recent
```

### 5. Preference Management Page

**Location:** Profile settings or dedicated "My Preferences" page

**Features:**
- View all liked/disliked content
- Edit past preferences
- Bulk actions (remove all dislikes older than X months)
- Export preference data
- Reset preference learning

**UI Structure:**
```
My Content Preferences

Filters: [Liked] [Disliked] [Movies] [TV Shows] [Sort: Recent]

┌────────────────────────────────────────────┐
│ 👍 The Dark Knight (2008)                  │
│ Liked on Jan 15, 2024                      │
│ Reasons: Great story, Amazing acting       │
│ [Edit] [Remove]                            │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ 👎 Transformers: Age of Extinction (2014)  │
│ Disliked on Jan 10, 2024                   │
│ Reasons: Too long, Boring                  │
│ [Edit] [Remove]                            │
└────────────────────────────────────────────┘
```

---

## Recommendation Algorithm

### 1. Hybrid Recommendation Approach

**Combine three strategies:**

#### A. Content-Based Filtering (60% weight)
Uses user's explicit preferences and affinities

#### B. Collaborative Filtering (25% weight)
Find similar users and recommend what they liked

#### C. Popularity-Based (15% weight)
Include trending/popular content with preference adjustments

### 2. Content-Based Algorithm

**Score Calculation:**

```typescript
interface ContentScore {
  genreMatch: number;      // -1 to 1
  actorMatch: number;      // -1 to 1
  directorMatch: number;   // -1 to 1
  decadeMatch: number;     // -1 to 1
  runtimeMatch: number;    // 0 to 1
  languageMatch: number;   // 0 to 1
  recencyBoost: number;    // 0 to 0.2
  diversityPenalty: number; // 0 to -0.3

  finalScore: number;      // Weighted sum
}

function calculateContentScore(
  content: TMDBContent,
  userAffinities: ProfileAffinity[],
  preferences: ContentPreference[]
): number {
  // 1. Check if already rated
  const existingPref = preferences.find(p =>
    p.tmdb_id === content.id && p.media_type === content.type
  );
  if (existingPref) {
    // Don't recommend content user already gave feedback on
    return -1000;
  }

  // 2. Calculate affinity matches
  const genreScore = calculateGenreMatch(content.genre_ids, userAffinities);
  const actorScore = calculateActorMatch(content.cast, userAffinities);
  const directorScore = calculateDirectorMatch(content.director, userAffinities);
  const decadeScore = calculateDecadeMatch(content.release_year, userAffinities);

  // 3. Apply weights
  const baseScore = (
    genreScore * 0.35 +
    actorScore * 0.25 +
    directorScore * 0.20 +
    decadeScore * 0.20
  );

  // 4. Apply modifiers
  const runtimeBoost = calculateRuntimeMatch(content.runtime, preferences);
  const languageBoost = calculateLanguageMatch(content.language, preferences);
  const recencyBoost = calculateRecencyBoost(content.release_date);
  const diversityPenalty = calculateDiversityPenalty(content, recentRecommendations);

  // 5. Final score
  return baseScore + runtimeBoost + languageBoost + recencyBoost - diversityPenalty;
}

function calculateGenreMatch(
  contentGenres: number[],
  affinities: ProfileAffinity[]
): number {
  const genreAffinities = affinities.filter(a => a.affinity_type === 'genre');

  if (genreAffinities.length === 0) return 0;

  // Calculate average affinity for content's genres
  let totalScore = 0;
  let matchCount = 0;

  for (const genreId of contentGenres) {
    const affinity = genreAffinities.find(a => a.affinity_value === genreId.toString());
    if (affinity) {
      totalScore += affinity.score / 100; // Normalize to -1 to 1
      matchCount++;
    }
  }

  // If no genre matches, slight penalty
  if (matchCount === 0) return -0.1;

  // Return average score
  return totalScore / matchCount;
}

// Similar functions for actor, director, decade matching...

function calculateRecencyBoost(releaseDate: string): number {
  const monthsOld = monthsSince(releaseDate);

  // Boost recent releases (within 6 months)
  if (monthsOld < 6) return 0.15;
  if (monthsOld < 12) return 0.10;
  if (monthsOld < 24) return 0.05;

  return 0;
}

function calculateDiversityPenalty(
  content: TMDBContent,
  recentRecommendations: TMDBContent[]
): number {
  // Penalize if too similar to recently shown recommendations
  let penalty = 0;

  for (const recent of recentRecommendations.slice(0, 20)) {
    const genreOverlap = intersection(content.genre_ids, recent.genre_ids).length;
    const castOverlap = intersection(content.cast, recent.cast).length;

    if (genreOverlap >= 2 && castOverlap >= 1) {
      penalty += 0.05; // Too similar
    }
  }

  return Math.min(penalty, 0.3); // Cap at 0.3
}
```

### 3. Collaborative Filtering Algorithm

**Find Similar Users:**

```typescript
interface UserSimilarity {
  profileId: string;
  similarity: number; // 0 to 1 (cosine similarity)
  commonPreferences: number;
}

function findSimilarUsers(
  targetProfile: string,
  allProfiles: string[],
  limit = 10
): UserSimilarity[] {
  const targetPrefs = getContentPreferences(targetProfile);
  const targetAffinities = getProfileAffinities(targetProfile);

  const similarities: UserSimilarity[] = [];

  for (const profileId of allProfiles) {
    if (profileId === targetProfile) continue;

    const otherPrefs = getContentPreferences(profileId);
    const otherAffinities = getProfileAffinities(profileId);

    // Calculate similarity based on shared preferences
    const commonPrefs = intersection(
      targetPrefs.map(p => `${p.tmdb_id}-${p.preference}`),
      otherPrefs.map(p => `${p.tmdb_id}-${p.preference}`)
    ).length;

    if (commonPrefs < 3) continue; // Need at least 3 common preferences

    // Calculate affinity similarity (cosine similarity)
    const affinitySimilarity = calculateCosineSimilarity(
      targetAffinities,
      otherAffinities
    );

    // Combined similarity score
    const similarity = (
      (commonPrefs / Math.max(targetPrefs.length, otherPrefs.length)) * 0.5 +
      affinitySimilarity * 0.5
    );

    similarities.push({
      profileId,
      similarity,
      commonPreferences: commonPrefs
    });
  }

  // Return top similar users
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

function getCollaborativeRecommendations(
  targetProfile: string,
  limit = 20
): TMDBContent[] {
  const similarUsers = findSimilarUsers(targetProfile);
  const targetLiked = getContentPreferences(targetProfile)
    .filter(p => ['like', 'love'].includes(p.preference))
    .map(p => `${p.tmdb_id}-${p.media_type}`);

  // Weighted voting from similar users
  const contentVotes: Map<string, number> = new Map();

  for (const similarUser of similarUsers) {
    const theirLikes = getContentPreferences(similarUser.profileId)
      .filter(p => ['like', 'love'].includes(p.preference));

    for (const pref of theirLikes) {
      const key = `${pref.tmdb_id}-${pref.media_type}`;

      // Skip if target already has feedback on this content
      if (targetLiked.includes(key)) continue;

      // Add weighted vote
      const preferenceWeight = pref.preference === 'love' ? 1.5 : 1.0;
      const vote = similarUser.similarity * preferenceWeight;

      contentVotes.set(key, (contentVotes.get(key) || 0) + vote);
    }
  }

  // Convert to sorted recommendations
  return Array.from(contentVotes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, score]) => {
      const [tmdbId, mediaType] = key.split('-');
      return { tmdb_id: parseInt(tmdbId), media_type: mediaType, score };
    });
}
```

### 4. Popularity-Based with Preference Adjustment

```typescript
function getPopularityRecommendations(
  targetProfile: string,
  limit = 10
): TMDBContent[] {
  const userAffinities = getProfileAffinities(targetProfile);
  const trendingContent = getTMDBTrending('week'); // TMDB API

  // Filter and adjust scores based on user preferences
  const adjusted = trendingContent.map(content => {
    const genreMatch = calculateGenreMatch(content.genre_ids, userAffinities);

    // Boost or penalize based on genre match
    const adjustedPopularity = content.popularity * (1 + genreMatch * 0.5);

    return {
      ...content,
      adjustedScore: adjustedPopularity
    };
  });

  return adjusted
    .sort((a, b) => b.adjustedScore - a.adjustedScore)
    .slice(0, limit);
}
```

### 5. Final Recommendation Merger

```typescript
async function generateRecommendations(
  profileId: string,
  limit = 50
): Promise<Recommendation[]> {
  // Get recommendations from each strategy
  const [contentBased, collaborative, popular] = await Promise.all([
    getContentBasedRecommendations(profileId, 35),
    getCollaborativeRecommendations(profileId, 15),
    getPopularityRecommendations(profileId, 10)
  ]);

  // Merge with weights
  const merged = [
    ...contentBased.map(r => ({ ...r, source: 'content', weight: 0.6 })),
    ...collaborative.map(r => ({ ...r, source: 'collaborative', weight: 0.25 })),
    ...popular.map(r => ({ ...r, source: 'popular', weight: 0.15 }))
  ];

  // Deduplicate and re-score
  const scoreMap = new Map<string, number>();
  const reasonMap = new Map<string, any>();

  for (const rec of merged) {
    const key = `${rec.tmdb_id}-${rec.media_type}`;
    const weightedScore = rec.score * rec.weight;

    scoreMap.set(key, (scoreMap.get(key) || 0) + weightedScore);

    if (!reasonMap.has(key)) {
      reasonMap.set(key, {
        sources: [],
        genre_match: rec.genre_match,
        actor_match: rec.actor_match
      });
    }
    reasonMap.get(key).sources.push(rec.source);
  }

  // Convert to final list
  const recommendations = Array.from(scoreMap.entries())
    .map(([key, score]) => {
      const [tmdbId, mediaType] = key.split('-');
      return {
        tmdb_id: parseInt(tmdbId),
        media_type: mediaType,
        score,
        match_reasons: reasonMap.get(key)
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Cache results
  await cacheRecommendations(profileId, recommendations);

  return recommendations;
}
```

### 6. Preference Learning Loop

**Automatic affinity updates:**

```typescript
async function updateAffinitiesFromPreference(
  profileId: string,
  preference: ContentPreference
) {
  const metadata = preference.content_metadata;
  const preferenceScore = {
    love: 6,
    like: 3,
    neutral: 0,
    dislike: -3,
    hate: -6
  }[preference.preference];

  // Update genre affinities
  if (metadata.genre_ids) {
    for (const genreId of metadata.genre_ids) {
      await adjustAffinity(
        profileId,
        'genre',
        genreId.toString(),
        preferenceScore
      );
    }
  }

  // Update actor affinities
  if (metadata.cast) {
    for (const actor of metadata.cast.slice(0, 3)) {
      await adjustAffinity(
        profileId,
        'actor',
        actor,
        preferenceScore * 0.8 // Slightly lower weight for actors
      );
    }
  }

  // Update director affinity
  if (metadata.director) {
    await adjustAffinity(
      profileId,
      'director',
      metadata.director,
      preferenceScore * 1.2 // Higher weight for directors
    );
  }

  // Update decade affinity
  if (metadata.release_year) {
    const decade = `${Math.floor(metadata.release_year / 10) * 10}s`;
    await adjustAffinity(
      profileId,
      'decade',
      decade,
      preferenceScore * 0.6
    );
  }

  // Invalidate recommendation cache
  await invalidateRecommendationCache(profileId);
}

async function adjustAffinity(
  profileId: string,
  affinityType: string,
  affinityValue: string,
  adjustment: number
) {
  const existing = await getAffinity(profileId, affinityType, affinityValue);

  if (existing) {
    // Apply exponential moving average for smooth updates
    const alpha = 0.3; // Learning rate
    const newScore = existing.score * (1 - alpha) + adjustment * 10 * alpha;

    await updateAffinity(existing.id, {
      score: Math.max(-100, Math.min(100, newScore)),
      positive_weight: adjustment > 0
        ? existing.positive_weight + adjustment
        : existing.positive_weight,
      negative_weight: adjustment < 0
        ? existing.negative_weight + Math.abs(adjustment)
        : existing.negative_weight,
      interaction_count: existing.interaction_count + 1,
      last_updated_at: new Date().toISOString()
    });
  } else {
    // Create new affinity
    await createAffinity({
      profile_id: profileId,
      affinity_type: affinityType,
      affinity_value: affinityValue,
      score: Math.max(-100, Math.min(100, adjustment * 10)),
      positive_weight: adjustment > 0 ? adjustment : 0,
      negative_weight: adjustment < 0 ? Math.abs(adjustment) : 0,
      interaction_count: 1
    });
  }
}
```

---

## Technical Implementation

### 1. Database Migration

**File:** `supabase/migrations/[timestamp]_add_preference_system.sql`

```sql
/*
  # Add User Preference System

  ## Overview
  Adds explicit user preference tracking (like/dislike) and enhances the
  recommendation system with negative preferences and caching.

  ## New Tables

  ### `content_preferences`
  Explicit user feedback on content
  - `id` (uuid, primary key)
  - `profile_id` (uuid, foreign key to user_profiles)
  - `tmdb_id` (integer) - TMDB content ID
  - `media_type` (text) - 'movie' or 'tv'
  - `preference` (text) - 'love', 'like', 'neutral', 'dislike', 'hate'
  - `reason` (text[]) - Optional reason tags
  - `feedback_context` (text) - Optional free-form feedback
  - `content_metadata` (jsonb) - Cached content data for learning
  - `created_at`, `updated_at` (timestamptz)

  ### `recommendation_cache`
  Pre-computed recommendations for performance
  - `id` (uuid, primary key)
  - `profile_id` (uuid, foreign key to user_profiles)
  - `tmdb_id` (integer)
  - `media_type` (text)
  - `score` (decimal)
  - `match_reasons` (jsonb) - Why recommended
  - `computed_at`, `expires_at` (timestamptz)
  - `shown_count`, `last_shown_at` - Presentation tracking

  ## Modified Tables

  ### `profile_affinity`
  - Extended score range to -100 to 100 (was 0-100)
  - Added positive_weight, negative_weight, interaction_count

  ### `user_interactions`
  - Added new interaction types: liked_content, disliked_content, loved_content, hated_content

  ## Security

  All tables have RLS enabled. Users can only access their own data.
*/

-- 1. Create content_preferences table
CREATE TABLE IF NOT EXISTS content_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text CHECK (media_type IN ('movie', 'tv')) NOT NULL,
  preference text CHECK (preference IN ('love', 'like', 'neutral', 'dislike', 'hate')) NOT NULL,
  reason text[] DEFAULT ARRAY[]::text[],
  feedback_context text DEFAULT '',
  content_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_content_pref UNIQUE(profile_id, tmdb_id, media_type)
);

CREATE INDEX IF NOT EXISTS idx_content_pref_profile ON content_preferences(profile_id);
CREATE INDEX IF NOT EXISTS idx_content_pref_preference ON content_preferences(profile_id, preference);
CREATE INDEX IF NOT EXISTS idx_content_pref_updated ON content_preferences(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_pref_tmdb ON content_preferences(tmdb_id, media_type);

ALTER TABLE content_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content preferences"
  ON content_preferences FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = content_preferences.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own content preferences"
  ON content_preferences FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = content_preferences.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own content preferences"
  ON content_preferences FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = content_preferences.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = content_preferences.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own content preferences"
  ON content_preferences FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = content_preferences.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  );

-- 2. Create recommendation_cache table
CREATE TABLE IF NOT EXISTS recommendation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text CHECK (media_type IN ('movie', 'tv')) NOT NULL,
  score decimal(6,2) NOT NULL,
  match_reasons jsonb DEFAULT '{}'::jsonb,
  computed_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  shown_count integer DEFAULT 0,
  last_shown_at timestamptz,
  CONSTRAINT unique_rec_cache UNIQUE(profile_id, tmdb_id, media_type)
);

CREATE INDEX IF NOT EXISTS idx_rec_cache_profile_score ON recommendation_cache(profile_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_rec_cache_expires ON recommendation_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_rec_cache_shown ON recommendation_cache(profile_id, shown_count ASC, score DESC);

ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendation cache"
  ON recommendation_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = recommendation_cache.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own recommendation cache"
  ON recommendation_cache FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = recommendation_cache.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = recommendation_cache.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  );

-- 3. Modify profile_affinity table
DO $$
BEGIN
  -- Drop old constraint
  ALTER TABLE profile_affinity DROP CONSTRAINT IF EXISTS profile_affinity_score_check;

  -- Change score column type if needed
  ALTER TABLE profile_affinity ALTER COLUMN score TYPE decimal(6,2);

  -- Add new constraint
  ALTER TABLE profile_affinity ADD CONSTRAINT profile_affinity_score_check
    CHECK (score >= -100 AND score <= 100);

  -- Add new columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profile_affinity' AND column_name = 'positive_weight'
  ) THEN
    ALTER TABLE profile_affinity ADD COLUMN positive_weight decimal(6,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profile_affinity' AND column_name = 'negative_weight'
  ) THEN
    ALTER TABLE profile_affinity ADD COLUMN negative_weight decimal(6,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profile_affinity' AND column_name = 'interaction_count'
  ) THEN
    ALTER TABLE profile_affinity ADD COLUMN interaction_count integer DEFAULT 0;
  END IF;
END $$;

-- Create index for negative affinities
CREATE INDEX IF NOT EXISTS idx_affinity_negative ON profile_affinity(profile_id, score ASC)
  WHERE score < 0;

-- 4. Add trigger to auto-update updated_at on content_preferences
CREATE OR REPLACE FUNCTION update_content_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_content_preferences_timestamp_trigger'
  ) THEN
    CREATE TRIGGER update_content_preferences_timestamp_trigger
      BEFORE UPDATE ON content_preferences
      FOR EACH ROW
      EXECUTE FUNCTION update_content_preferences_timestamp();
  END IF;
END $$;

-- 5. Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_recommendations()
RETURNS void AS $$
BEGIN
  DELETE FROM recommendation_cache
  WHERE expires_at < now();
END;
$$ language 'plpgsql';

-- 6. Create function to invalidate cache on preference changes
CREATE OR REPLACE FUNCTION invalidate_recommendation_cache_on_preference()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM recommendation_cache
  WHERE profile_id = NEW.profile_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'invalidate_cache_on_preference_insert'
  ) THEN
    CREATE TRIGGER invalidate_cache_on_preference_insert
      AFTER INSERT ON content_preferences
      FOR EACH ROW
      EXECUTE FUNCTION invalidate_recommendation_cache_on_preference();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'invalidate_cache_on_preference_update'
  ) THEN
    CREATE TRIGGER invalidate_cache_on_preference_update
      AFTER UPDATE ON content_preferences
      FOR EACH ROW
      EXECUTE FUNCTION invalidate_recommendation_cache_on_preference();
  END IF;
END $$;
```

### 2. Service Layer Implementation

**File:** `src/services/preferences.ts`

```typescript
import { supabase } from '../lib/supabase';
import { getTMDBDetails } from './tmdb';

export type PreferenceLevel = 'love' | 'like' | 'neutral' | 'dislike' | 'hate';

export interface ContentPreference {
  id: string;
  profile_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  preference: PreferenceLevel;
  reason: string[];
  feedback_context: string;
  content_metadata: any;
  created_at: string;
  updated_at: string;
}

export interface PreferenceFeedback {
  preference: PreferenceLevel;
  reasons?: string[];
  context?: string;
}

export async function setContentPreference(
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  feedback: PreferenceFeedback
): Promise<ContentPreference | null> {
  try {
    // Fetch content metadata from TMDB
    const tmdbData = await getTMDBDetails(tmdbId, mediaType);

    const contentMetadata = {
      genre_ids: tmdbData.genres?.map((g: any) => g.id) || [],
      cast: tmdbData.credits?.cast?.slice(0, 5).map((c: any) => c.name) || [],
      director: tmdbData.credits?.crew?.find((c: any) => c.job === 'Director')?.name,
      release_year: mediaType === 'movie'
        ? new Date(tmdbData.release_date).getFullYear()
        : new Date(tmdbData.first_air_date).getFullYear(),
      runtime: tmdbData.runtime || tmdbData.episode_run_time?.[0],
      original_language: tmdbData.original_language
    };

    // Upsert preference
    const { data, error } = await supabase
      .from('content_preferences')
      .upsert({
        profile_id: profileId,
        tmdb_id: tmdbId,
        media_type: mediaType,
        preference: feedback.preference,
        reason: feedback.reasons || [],
        feedback_context: feedback.context || '',
        content_metadata: contentMetadata,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'profile_id,tmdb_id,media_type'
      })
      .select()
      .single();

    if (error) throw error;

    // Track interaction
    await trackInteraction(
      profileId,
      tmdbId,
      mediaType,
      `${feedback.preference}_content` as any,
      { preference: feedback.preference }
    );

    // Trigger affinity update (background)
    updateAffinitiesFromPreference(profileId, data);

    return data;
  } catch (error) {
    console.error('Error setting content preference:', error);
    return null;
  }
}

export async function getContentPreference(
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<ContentPreference | null> {
  try {
    const { data, error } = await supabase
      .from('content_preferences')
      .select('*')
      .eq('profile_id', profileId)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching content preference:', error);
    return null;
  }
}

export async function getUserPreferences(
  profileId: string,
  filterPreference?: PreferenceLevel,
  limit = 100
): Promise<ContentPreference[]> {
  try {
    let query = supabase
      .from('content_preferences')
      .select('*')
      .eq('profile_id', profileId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (filterPreference) {
      query = query.eq('preference', filterPreference);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return [];
  }
}

export async function deleteContentPreference(
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('content_preferences')
      .delete()
      .eq('profile_id', profileId)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting content preference:', error);
    return false;
  }
}

async function updateAffinitiesFromPreference(
  profileId: string,
  preference: ContentPreference
) {
  // This runs asynchronously to not block the UI
  const metadata = preference.content_metadata;

  const preferenceScore = {
    love: 6,
    like: 3,
    neutral: 0,
    dislike: -3,
    hate: -6
  }[preference.preference];

  // Update genre affinities
  if (metadata.genre_ids && Array.isArray(metadata.genre_ids)) {
    for (const genreId of metadata.genre_ids) {
      await adjustAffinity(profileId, 'genre', genreId.toString(), preferenceScore);
    }
  }

  // Update actor affinities
  if (metadata.cast && Array.isArray(metadata.cast)) {
    for (const actor of metadata.cast.slice(0, 3)) {
      await adjustAffinity(profileId, 'actor', actor, preferenceScore * 0.8);
    }
  }

  // Update director affinity
  if (metadata.director) {
    await adjustAffinity(profileId, 'director', metadata.director, preferenceScore * 1.2);
  }

  // Update decade affinity
  if (metadata.release_year) {
    const decade = `${Math.floor(metadata.release_year / 10) * 10}s`;
    await adjustAffinity(profileId, 'decade', decade, preferenceScore * 0.6);
  }
}

async function adjustAffinity(
  profileId: string,
  affinityType: string,
  affinityValue: string,
  adjustment: number
) {
  try {
    const { data: existing } = await supabase
      .from('profile_affinity')
      .select('*')
      .eq('profile_id', profileId)
      .eq('affinity_type', affinityType)
      .eq('affinity_value', affinityValue)
      .maybeSingle();

    if (existing) {
      // Exponential moving average
      const alpha = 0.3;
      const newScore = existing.score * (1 - alpha) + adjustment * 10 * alpha;

      await supabase
        .from('profile_affinity')
        .update({
          score: Math.max(-100, Math.min(100, newScore)),
          positive_weight: adjustment > 0
            ? existing.positive_weight + adjustment
            : existing.positive_weight,
          negative_weight: adjustment < 0
            ? existing.negative_weight + Math.abs(adjustment)
            : existing.negative_weight,
          interaction_count: existing.interaction_count + 1,
          last_updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Create new affinity
      await supabase
        .from('profile_affinity')
        .insert({
          profile_id: profileId,
          affinity_type: affinityType,
          affinity_value: affinityValue,
          score: Math.max(-100, Math.min(100, adjustment * 10)),
          positive_weight: adjustment > 0 ? adjustment : 0,
          negative_weight: adjustment < 0 ? Math.abs(adjustment) : 0,
          interaction_count: 1
        });
    }
  } catch (error) {
    console.error('Error adjusting affinity:', error);
  }
}
```

### 3. React Components

**A. Preference Button Component**

**File:** `src/components/preferences/PreferenceButtons.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import {
  getContentPreference,
  setContentPreference,
  type PreferenceLevel
} from '../../services/preferences';
import { useToast } from '../../contexts/ToastContext';

interface PreferenceButtonsProps {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  onFeedbackModalOpen?: () => void;
  compact?: boolean;
}

export function PreferenceButtons({
  tmdbId,
  mediaType,
  title,
  onFeedbackModalOpen,
  compact = false
}: PreferenceButtonsProps) {
  const { currentProfile } = useProfile();
  const { showToast } = useToast();
  const [preference, setPreference] = useState<PreferenceLevel | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPreference();
  }, [tmdbId, mediaType, currentProfile?.id]);

  async function loadPreference() {
    if (!currentProfile) return;

    const pref = await getContentPreference(
      currentProfile.id,
      tmdbId,
      mediaType
    );

    setPreference(pref?.preference || null);
  }

  async function handleQuickPreference(level: 'like' | 'dislike') {
    if (!currentProfile || loading) return;

    setLoading(true);

    try {
      // Toggle off if clicking same preference
      const newPreference = preference === level ? null : level;

      if (newPreference) {
        await setContentPreference(
          currentProfile.id,
          tmdbId,
          mediaType,
          { preference: newPreference }
        );

        setPreference(newPreference);
        showToast(
          newPreference === 'like' ? 'Added to liked content' : 'Added to disliked content',
          'success'
        );
      } else {
        // Remove preference
        await deleteContentPreference(currentProfile.id, tmdbId, mediaType);
        setPreference(null);
        showToast('Preference removed', 'info');
      }
    } catch (error) {
      showToast('Failed to update preference', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleDetailedFeedback() {
    onFeedbackModalOpen?.();
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleQuickPreference('like')}
          disabled={loading}
          className={`p-2 rounded-full transition-all ${
            preference === 'like' || preference === 'love'
              ? 'bg-green-600 text-white scale-110'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Like"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
          </svg>
        </button>

        <button
          onClick={() => handleQuickPreference('dislike')}
          disabled={loading}
          className={`p-2 rounded-full transition-all ${
            preference === 'dislike' || preference === 'hate'
              ? 'bg-red-600 text-white scale-110'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Dislike"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" style={{ transform: 'rotate(180deg)' }}>
            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => handleQuickPreference('like')}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
          preference === 'like' || preference === 'love'
            ? 'bg-green-600 text-white scale-105 shadow-lg'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
        </svg>
        <span className="font-medium">
          {preference === 'like' ? 'Liked' : preference === 'love' ? 'Loved' : 'Like'}
        </span>
      </button>

      <button
        onClick={() => handleQuickPreference('dislike')}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
          preference === 'dislike' || preference === 'hate'
            ? 'bg-red-600 text-white scale-105 shadow-lg'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" style={{ transform: 'rotate(180deg)' }}>
          <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
        </svg>
        <span className="font-medium">
          {preference === 'dislike' ? 'Disliked' : preference === 'hate' ? 'Hated' : 'Dislike'}
        </span>
      </button>

      {onFeedbackModalOpen && (
        <button
          onClick={handleDetailedFeedback}
          className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
        >
          More options...
        </button>
      )}

      {preference && (
        <span className="text-sm text-gray-400 ml-2">
          Your feedback helps improve recommendations
        </span>
      )}
    </div>
  );
}
```

**B. Detailed Feedback Modal**

**File:** `src/components/preferences/FeedbackModal.tsx`

```typescript
// Full implementation with 5-level preference selection + reason tags
// Similar structure to RecommendModal but for giving detailed feedback
// See detailed code in implementation phase
```

### 4. Background Jobs (Optional)

**Using Supabase Edge Functions for scheduled tasks:**

**File:** `supabase/functions/update-recommendations/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Clean up expired cache
    await supabase.rpc('cleanup_expired_recommendations');

    // 2. Get profiles that need cache refresh
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(100); // Process in batches

    if (!profiles) {
      return new Response(
        JSON.stringify({ message: 'No profiles to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Generate recommendations for each profile
    for (const profile of profiles) {
      // Check if cache exists and is fresh
      const { data: cache } = await supabase
        .from('recommendation_cache')
        .select('id')
        .eq('profile_id', profile.id)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (!cache) {
        // Generate new recommendations
        // This would call the recommendation algorithm
        // For now, just log
        console.log(`Need to generate recs for profile ${profile.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Recommendations updated',
        processed: profiles.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
```

---

## Privacy & Security

### 1. Data Privacy Principles

**User Control:**
- Users can view all their preference data
- Users can edit or delete any preference
- Users can export their data
- Users can reset all preferences

**Data Minimization:**
- Only store necessary metadata
- Automatically clean old data (optional setting)
- Don't share preference data with other users

**Transparency:**
- Show users why content is recommended
- Explain how preferences affect recommendations
- Allow users to see their affinity scores

### 2. Row Level Security (RLS) Policies

All tables have strict RLS:
```sql
-- Example: content_preferences
CREATE POLICY "Users can only access own preferences"
  ON content_preferences
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = content_preferences.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  );
```

### 3. Data Retention

**Configurable retention periods:**

```typescript
// Settings in user profile
interface PreferenceSettings {
  retainPreferencesMonths: number; // Default: unlimited (0)
  retainInteractionsMonths: number; // Default: 12
  allowCollaborativeFiltering: boolean; // Default: true
}

// Cleanup function
async function cleanupOldPreferences(profileId: string, settings: PreferenceSettings) {
  if (settings.retainPreferencesMonths > 0) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - settings.retainPreferencesMonths);

    await supabase
      .from('content_preferences')
      .delete()
      .eq('profile_id', profileId)
      .lt('updated_at', cutoffDate.toISOString());
  }
}
```

### 4. Anonymization for Collaborative Filtering

When using collaborative filtering:
- Never expose user IDs to other users
- Aggregate similarity calculations
- Don't reveal specific content other users liked
- Only use preference patterns, not identity

---

## Performance Optimization

### 1. Caching Strategy

**Multi-Level Caching:**

```typescript
// Level 1: Browser memory (React state/context)
// Level 2: LocalStorage (offline support)
// Level 3: Supabase recommendation_cache table
// Level 4: TMDB API results

interface CacheConfig {
  browserCacheTTL: number; // 5 minutes
  localStorageTTL: number; // 30 minutes
  databaseCacheTTL: number; // 24 hours
  tmdbCacheTTL: number; // 7 days
}
```

**Implementation:**

```typescript
class RecommendationCache {
  private memoryCache: Map<string, any> = new Map();

  async getRecommendations(profileId: string): Promise<any[]> {
    // 1. Check memory cache
    const memKey = `recs_${profileId}`;
    if (this.memoryCache.has(memKey)) {
      const cached = this.memoryCache.get(memKey);
      if (cached.expires > Date.now()) {
        return cached.data;
      }
    }

    // 2. Check localStorage
    const localKey = `recs_${profileId}`;
    const localData = localStorage.getItem(localKey);
    if (localData) {
      const parsed = JSON.parse(localData);
      if (parsed.expires > Date.now()) {
        this.memoryCache.set(memKey, parsed);
        return parsed.data;
      }
    }

    // 3. Check database cache
    const { data: dbCache } = await supabase
      .from('recommendation_cache')
      .select('*')
      .eq('profile_id', profileId)
      .gt('expires_at', new Date().toISOString())
      .order('score', { ascending: false })
      .limit(50);

    if (dbCache && dbCache.length > 0) {
      const cacheData = {
        data: dbCache,
        expires: Date.now() + 30 * 60 * 1000 // 30 min
      };
      this.memoryCache.set(memKey, cacheData);
      localStorage.setItem(localKey, JSON.stringify(cacheData));
      return dbCache;
    }

    // 4. Generate fresh recommendations
    const fresh = await generateRecommendations(profileId);

    // Cache at all levels
    const cacheData = {
      data: fresh,
      expires: Date.now() + 30 * 60 * 1000
    };
    this.memoryCache.set(memKey, cacheData);
    localStorage.setItem(localKey, JSON.stringify(cacheData));

    return fresh;
  }

  invalidate(profileId: string) {
    const memKey = `recs_${profileId}`;
    this.memoryCache.delete(memKey);
    localStorage.removeItem(memKey);
  }
}
```

### 2. Database Indexing

**Critical indexes already defined:**
```sql
-- Fast profile lookup
CREATE INDEX idx_content_pref_profile ON content_preferences(profile_id);
CREATE INDEX idx_affinity_profile_type ON profile_affinity(profile_id, affinity_type);

-- Fast score sorting
CREATE INDEX idx_rec_cache_profile_score ON recommendation_cache(profile_id, score DESC);
CREATE INDEX idx_affinity_score ON profile_affinity(profile_id, score DESC);

-- Fast time-based queries
CREATE INDEX idx_content_pref_updated ON content_preferences(updated_at DESC);
CREATE INDEX idx_rec_cache_expires ON recommendation_cache(expires_at);
```

### 3. Batch Operations

**Bulk preference updates:**

```typescript
async function bulkSetPreferences(
  profileId: string,
  preferences: Array<{ tmdbId: number; mediaType: 'movie' | 'tv'; preference: PreferenceLevel }>
) {
  // Fetch all TMDB data in parallel
  const tmdbDataPromises = preferences.map(p =>
    getTMDBDetails(p.tmdbId, p.mediaType)
  );
  const tmdbDataResults = await Promise.allSettled(tmdbDataPromises);

  // Prepare bulk insert
  const records = preferences.map((p, i) => {
    const tmdbData = tmdbDataResults[i].status === 'fulfilled'
      ? tmdbDataResults[i].value
      : null;

    return {
      profile_id: profileId,
      tmdb_id: p.tmdbId,
      media_type: p.mediaType,
      preference: p.preference,
      content_metadata: tmdbData ? extractMetadata(tmdbData) : {}
    };
  });

  // Single bulk upsert
  await supabase
    .from('content_preferences')
    .upsert(records, {
      onConflict: 'profile_id,tmdb_id,media_type'
    });

  // Background affinity update (don't await)
  updateAffinitiesInBatch(profileId, records);
}
```

### 4. Lazy Loading & Pagination

```typescript
// Infinite scroll for preference history
function usePreferenceHistory(profileId: string) {
  const [preferences, setPreferences] = useState<ContentPreference[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const PAGE_SIZE = 20;

  async function loadMore() {
    if (loading || !hasMore) return;

    setLoading(true);

    const { data } = await supabase
      .from('content_preferences')
      .select('*')
      .eq('profile_id', profileId)
      .order('updated_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (data && data.length > 0) {
      setPreferences(prev => [...prev, ...data]);
      setPage(p => p + 1);
      setHasMore(data.length === PAGE_SIZE);
    } else {
      setHasMore(false);
    }

    setLoading(false);
  }

  return { preferences, loadMore, hasMore, loading };
}
```

### 5. Debouncing & Throttling

```typescript
// Debounce preference updates
const debouncedSetPreference = useMemo(
  () => debounce(async (profileId, tmdbId, mediaType, feedback) => {
    await setContentPreference(profileId, tmdbId, mediaType, feedback);
  }, 500),
  []
);

// Throttle affinity recalculation
const throttledUpdateAffinities = useMemo(
  () => throttle(async (profileId) => {
    await updateProfileAffinities(profileId);
  }, 5000), // Max once per 5 seconds
  []
);
```

---

## A/B Testing Framework

### 1. Experiment Infrastructure

**Database Table:**

```sql
CREATE TABLE IF NOT EXISTS ab_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  variants jsonb NOT NULL, -- {"control": {}, "variant_a": {}, "variant_b": {}}
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ab_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid REFERENCES ab_experiments(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  variant text NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  CONSTRAINT unique_assignment UNIQUE(experiment_id, profile_id)
);

CREATE TABLE IF NOT EXISTS ab_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid REFERENCES ab_experiments(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  variant text NOT NULL,
  event_type text NOT NULL, -- "view", "click", "conversion"
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ab_events_experiment ON ab_events(experiment_id, variant, event_type);
CREATE INDEX idx_ab_events_created ON ab_events(created_at DESC);
```

### 2. Experiment Examples

**Experiment 1: Recommendation Algorithm Variants**
```typescript
{
  name: "recommendation_algorithm_v2",
  description: "Test new collaborative filtering weight",
  variants: {
    control: {
      contentWeight: 0.6,
      collaborativeWeight: 0.25,
      popularityWeight: 0.15
    },
    variant_a: {
      contentWeight: 0.5,
      collaborativeWeight: 0.35,
      popularityWeight: 0.15
    },
    variant_b: {
      contentWeight: 0.7,
      collaborativeWeight: 0.2,
      popularityWeight: 0.1
    }
  }
}
```

**Experiment 2: UI Placement**
```typescript
{
  name: "preference_button_placement",
  description: "Test like/dislike button placement",
  variants: {
    control: "below_title", // Current placement
    variant_a: "hover_card", // Show on card hover
    variant_b: "post_complete" // Show after marking complete
  }
}
```

### 3. Implementation

```typescript
class ABTestManager {
  async getVariant(profileId: string, experimentName: string): Promise<string> {
    // Check existing assignment
    const { data: assignment } = await supabase
      .from('ab_assignments')
      .select('variant, ab_experiments!inner(is_active)')
      .eq('profile_id', profileId)
      .eq('ab_experiments.name', experimentName)
      .eq('ab_experiments.is_active', true)
      .maybeSingle();

    if (assignment) {
      return assignment.variant;
    }

    // Get experiment
    const { data: experiment } = await supabase
      .from('ab_experiments')
      .select('*')
      .eq('name', experimentName)
      .eq('is_active', true)
      .maybeSingle();

    if (!experiment) {
      return 'control'; // Default
    }

    // Assign random variant
    const variants = Object.keys(experiment.variants);
    const randomVariant = variants[Math.floor(Math.random() * variants.length)];

    // Save assignment
    await supabase
      .from('ab_assignments')
      .insert({
        experiment_id: experiment.id,
        profile_id: profileId,
        variant: randomVariant
      });

    return randomVariant;
  }

  async trackEvent(
    profileId: string,
    experimentName: string,
    eventType: string,
    eventData?: any
  ) {
    const variant = await this.getVariant(profileId, experimentName);

    const { data: experiment } = await supabase
      .from('ab_experiments')
      .select('id')
      .eq('name', experimentName)
      .maybeSingle();

    if (!experiment) return;

    await supabase
      .from('ab_events')
      .insert({
        experiment_id: experiment.id,
        profile_id: profileId,
        variant,
        event_type: eventType,
        event_data: eventData || {}
      });
  }
}

// Usage
const abTest = new ABTestManager();

// In component
const variant = await abTest.getVariant(profileId, 'preference_button_placement');

// Track events
await abTest.trackEvent(profileId, 'preference_button_placement', 'click', {
  tmdb_id: 12345,
  preference: 'like'
});
```

### 4. Analytics & Reporting

```typescript
async function getExperimentResults(experimentName: string) {
  const { data: experiment } = await supabase
    .from('ab_experiments')
    .select('id, variants')
    .eq('name', experimentName)
    .single();

  const { data: events } = await supabase
    .from('ab_events')
    .select('variant, event_type')
    .eq('experiment_id', experiment.id);

  // Calculate metrics per variant
  const variantStats = {};
  const variants = Object.keys(experiment.variants);

  for (const variant of variants) {
    const variantEvents = events.filter(e => e.variant === variant);

    variantStats[variant] = {
      views: variantEvents.filter(e => e.event_type === 'view').length,
      clicks: variantEvents.filter(e => e.event_type === 'click').length,
      conversions: variantEvents.filter(e => e.event_type === 'conversion').length,
      ctr: 0,
      conversionRate: 0
    };

    if (variantStats[variant].views > 0) {
      variantStats[variant].ctr =
        (variantStats[variant].clicks / variantStats[variant].views) * 100;
      variantStats[variant].conversionRate =
        (variantStats[variant].conversions / variantStats[variant].views) * 100;
    }
  }

  return variantStats;
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Create database migration for content_preferences table
- [ ] Implement RLS policies
- [ ] Create preferences service layer
- [ ] Build basic PreferenceButtons component
- [ ] Add like/dislike to DetailPage
- [ ] Test preference storage and retrieval

### Phase 2: Learning System (Week 3-4)
- [ ] Modify profile_affinity table for negative scores
- [ ] Implement affinity update algorithm
- [ ] Add automatic affinity calculation on preference changes
- [ ] Test preference learning with sample data
- [ ] Verify affinity scores update correctly

### Phase 3: Enhanced Recommendations (Week 5-6)
- [ ] Implement content-based filtering algorithm
- [ ] Create recommendation_cache table
- [ ] Build recommendation generation service
- [ ] Add caching logic (memory, localStorage, database)
- [ ] Integrate recommendations into existing pages

### Phase 4: UI Polish (Week 7-8)
- [ ] Create detailed FeedbackModal component
- [ ] Add animations and transitions
- [ ] Implement swipe gestures for mobile
- [ ] Add preference indicators on cards
- [ ] Build preference management page
- [ ] Add "why recommended" explanations

### Phase 5: Advanced Features (Week 9-10)
- [ ] Implement collaborative filtering
- [ ] Add popularity-based recommendations
- [ ] Build recommendation merging algorithm
- [ ] Create background recommendation generator
- [ ] Add diversity and novelty features

### Phase 6: Optimization (Week 11-12)
- [ ] Performance testing and optimization
- [ ] Add comprehensive indexing
- [ ] Implement batch operations
- [ ] Set up CDN caching for TMDB images
- [ ] Optimize database queries
- [ ] Add monitoring and logging

### Phase 7: A/B Testing (Week 13-14)
- [ ] Create A/B testing infrastructure
- [ ] Set up experiment tracking
- [ ] Run initial experiments
- [ ] Analyze results
- [ ] Implement winning variants

### Phase 8: Polish & Launch (Week 15-16)
- [ ] User acceptance testing
- [ ] Bug fixes
- [ ] Documentation
- [ ] Performance monitoring setup
- [ ] Gradual rollout to users

---

## Success Metrics

**Engagement Metrics:**
- Preference feedback rate (target: >30% of users give feedback)
- Average preferences per user (target: >20)
- Preference diversity (mix of likes and dislikes)

**Recommendation Quality:**
- Click-through rate on recommendations (target: >15%)
- Conversion rate (recommended → added to watchlist) (target: >10%)
- User satisfaction scores (optional survey)

**System Performance:**
- Recommendation generation time (<500ms)
- Cache hit rate (>80%)
- Database query performance (<100ms)

**Business Impact:**
- User retention improvement
- Increased content discovery
- Higher engagement time

---

## Conclusion

This comprehensive preference system will transform WatchTracker from a simple tracking tool into an intelligent recommendation engine that learns from user behavior and provides personalized content suggestions. By combining explicit feedback (likes/dislikes) with implicit signals (viewing history, ratings) and leveraging multiple recommendation strategies, the system will deliver highly relevant suggestions that keep users engaged and help them discover content they'll love.

The phased implementation approach ensures manageable development cycles while allowing for iterative improvements based on real user feedback and A/B testing results.
