# RaineyFlixs / WatchTracker — Project Context

## What this is
A personal media tracker PWA called **RaineyFlixs**. Users track movies/TV shows, follow people (actors/directors), browse by streaming service, get episode notifications, and share recommendations with friends.

## Stack
- React 18 + TypeScript + Vite + Tailwind CSS
- Supabase (Auth, DB, Edge Functions, Realtime, Storage)
- TMDB API via Supabase Edge Function proxy (`supabase/functions/tmdb-proxy`)
- Plex integration (`supabase/functions/plex-proxy`)
- PWA via vite-plugin-pwa, deployed to Netlify at rflixs.rainey.app
- TanStack React Query + Framer Motion already installed

## Key architecture rules
- ALL TMDB calls go through the proxy — never call TMDB directly from the client
- Supabase RLS is enforced on every table — always check policies before writing queries
- Auth: email/password + Google OAuth, approval flow (admin approves new users)
- Brand color: `primary-*` = red/crimson (NOT blue/amber/teal)
- `brand-card` = dark card background token

## Plan file
All planned phases live at: `C:\Users\royra\.claude\plans\floating-yawning-dusk.md`
Read this before planning new work — it has detailed specs for all upcoming phases.

## ⚠️ IMPORTANT: Phase numbering is NOT sequential
Phases were NOT completed in numerical order. Some lower-numbered phases (24, 25, 26) were deliberately skipped in favour of higher-priority work and are still pending. Always check both lists below before starting anything.

## Most recently completed: Phase 35 (2026-05-18)
Phase 35 added an icon glossary to the Help panel:
- New file: `src/components/help/iconGlossary.ts` (17 icon entries, 4 groups)
- Updated: `src/components/help/HelpPanel.tsx` (collapsible Icon reference section)

## All completed phases — DO NOT redo any of these
- Phase 1: Security (API key → env var, CORS hardening, endpoint allowlist)
- Phase 2: Performance (watchlist metadata, batch preferences, HorizontalScrollSection)
- Phase 3: Architecture (TanStack Query wired, queryKeys.ts created)
- Phase 4: Design (red/crimson primary palette, Inter font, glassmorphism nav, page transitions)
- Phase 5: Cleanup (dead code removed, docs reorganized)
- Phase 6: Social/Plex UX (mutual-friends recs, Plex check-first flow, notifications)
- Phase 7: Discovery engine (FeelingLucky weighted, stackable moods, episode notifications, dislike filtering)
- Phase 8: Genre preferences UI, MoodDiscovery pipe fix, English Only on profile
- Phase 9: Calendar in mobile bottom nav
- Phase 10: EpisodeTracker — Mark Season Watched + AutoMark persistence
- Phase 11: EpisodeTracker — silent write failure fixes (upsert + batch)
- Phase 12: Auto-fill gaps cross-season backfill
- Phase 13: PWA cache headers (netlify.toml)
- Phase 17: Admin import curated list + ListDetailPage recommend button
- Phase 17b: Import into existing list option
- Phase 18: Follow people, person search, network browse (Phases 18A–18E)
- Phase 19: Paramount+ fix, brand re-skin, CORS hardening deployed
- Phase 20: Onboarding tour + context-aware Help panel
- Phase 21: PWA install prompt (Android native + iOS instructions)
- Phase 22: Mobile nav rebalance (Discovery + My Lists in bottom nav)
- Phase 23: Following icon in mobile header
- Phase 24: Store metadata in watchlist_items (DB + Dashboard N+1 fix)
- Phase 25: Batch preferences to SearchPage & DiscoveryPage
- Phase 26: HorizontalScrollSection Dashboard triple-copy elimination
- Phase 27: Clear notifications (dismiss X + Clear All)
- Phase 28/28b/28c: Avatar upload compression (createImageBitmap)
- Phase 29/29b: Undated titles in followed feed
- Phase 30/30b: Person filter pills + visible hide button on followed feed cards
- Phase 31: Followed feed dislike → persists cross-device
- Phase 32: Auto-complete TV show on last episode watched
- Phase 33: Followed feed hidden items no longer reappear after refresh
- Phase 34: Help content updated for all features through Phase 33
- Phase 35: Icon glossary added to Help panel ← LAST COMPLETED

## Remaining phases — not yet started
- Phase 2.3: Dashboard double-fetch race condition (partially addressed)
- Many more — see the plan file for full specs
