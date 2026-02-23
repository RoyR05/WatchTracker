# TMDB API Compliance Documentation

This document outlines how WatchTracker complies with The Movie Database (TMDB) API terms of use and guidelines.

## Attribution Requirements

### Logo and Disclaimer
As required by TMDB's terms of use, WatchTracker displays:

1. **TMDB Logo**: Displayed in the footer of every page
2. **Disclaimer Text**: "This product uses the TMDB API but is not endorsed or certified by TMDB"

**Implementation**: See `src/components/layout/Layout.tsx` (footer section)

The attribution is designed to be less prominent than WatchTracker's own branding while still clearly identifying the use of TMDB data.

## Rate Limiting

### TMDB Rate Limits
- TMDB enforces approximately **40 requests per second**
- Rate limits may change at any time
- HTTP 429 status code indicates rate limit exceeded

### Our Implementation
**Client-Side Handling** (`src/services/tmdb.ts`):
- Automatically detects 429 responses
- Implements exponential backoff retry logic (3 attempts)
- Wait times: 1s, 2s, 4s between retries
- Provides user-friendly error messages

**Edge Function** (`supabase/functions/tmdb-proxy/index.ts`):
- Proxies all TMDB requests to keep API key secure
- Passes through status codes including 429

## Data Caching

### TMDB Cache Policy
- Maximum cache duration: **6 months**
- Data older than 6 months must be refreshed or deleted

### Our Implementation
WatchTracker does NOT cache TMDB data in the database. We only store:
- TMDB IDs (integers)
- User-generated content (ratings, notes, progress)

All movie/TV show details are fetched fresh from TMDB on each request, ensuring compliance with caching policies.

## Commercial Use

### License Type
WatchTracker is designed for **non-commercial use** under TMDB's standard API terms.

### Prohibited Without Commercial License
- Charging users for access
- Displaying advertisements
- Using data in search engines or chatbots
- Reselling or sublicensing API access

### Note
If WatchTracker is used for commercial purposes, a separate written agreement with TMDB is required.

## API Usage Best Practices

### Security
- API key stored in edge function (never exposed to client)
- All requests proxied through Supabase Edge Functions
- Client-side code cannot access or misuse API key

### Respectful Usage
- Minimal requests per page load
- No bulk scraping or excessive bandwidth usage
- Graceful handling of errors and rate limits
- User-initiated requests only (no background polling)

## Compliance Checklist

- [x] TMDB logo displayed on all pages
- [x] Disclaimer text visible and accurate
- [x] Attribution less prominent than own branding
- [x] Rate limiting handling with 429 response detection
- [x] Exponential backoff retry logic
- [x] No TMDB data caching beyond 6 months
- [x] API key secured in edge function
- [x] Non-commercial use only (by default)
- [x] Respectful API usage patterns

## Resources

- [TMDB API Documentation](https://developer.themoviedb.org/docs/getting-started)
- [TMDB Terms of Use](https://www.themoviedb.org/documentation/api/terms-of-use)
- [TMDB Rate Limiting Guide](https://developer.themoviedb.org/docs/rate-limiting)
- [TMDB Support Forum](https://www.themoviedb.org/talk/category/5047958519c29526b50017d6)

## Future Considerations

### If Scaling to Commercial Use
1. Contact TMDB for commercial licensing agreement
2. Review and adjust rate limiting strategy
3. Consider implementing server-side caching with proper expiration
4. Update attribution to reflect commercial agreement terms

### Potential Improvements
- Add TMDB official logo image (download from TMDB branding page)
- Implement more sophisticated rate limiting with request queuing
- Add analytics to monitor API usage patterns
- Create admin dashboard for API usage monitoring

## Last Updated
2026-02-17

## Maintained By
WatchTracker Development Team
