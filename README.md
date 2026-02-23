# WatchTracker - Progressive Web App

A comprehensive PWA for tracking movies and TV shows, built with modern web technologies.

## Features

### Core Functionality
- **User Authentication**: Secure email/password authentication with Supabase
- **Search**: Real-time search for movies and TV shows using TMDB API
- **Watchlist Management**: Track content with multiple statuses (watching, completed, plan to watch, dropped)
- **TV Show Progress Tracking**: Episode-by-episode tracking for TV shows with season navigation
- **Custom Lists**: Create and manage personalized collections of content
- **Social Features**: Follow other users, share lists, and discover what others are watching
- **Offline Support**: Service worker caching for offline functionality
- **Mobile-First Design**: Responsive interface optimized for all devices

### Technical Features
- **Progressive Web App**: Installable on mobile and desktop
- **Offline Caching**: TMDB images and API responses cached for offline use
- **Real-time Updates**: Live synchronization with Supabase backend
- **Secure Database**: Row Level Security (RLS) policies protect user data
- **API Proxy**: Edge function proxies TMDB requests to protect API keys

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **React Router** - Client-side routing

### Backend & Infrastructure
- **Supabase**:
  - PostgreSQL database with RLS
  - Authentication system
  - Edge Functions for API proxy
- **TMDB API** - Movie and TV show data

### PWA
- **vite-plugin-pwa** - Service worker and manifest generation
- **Workbox** - Advanced caching strategies

## Project Structure

```
src/
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.tsx      # Route protection
│   ├── layout/
│   │   └── Layout.tsx              # Main layout with navigation
│   ├── media/
│   │   └── MediaCard.tsx           # Movie/TV show card component
│   └── tv/
│       └── EpisodeTracker.tsx      # Episode tracking UI
├── contexts/
│   └── AuthContext.tsx             # Authentication state management
├── lib/
│   └── supabase.ts                 # Supabase client configuration
├── pages/
│   ├── AuthPage.tsx                # Login/register page
│   ├── Dashboard.tsx               # Main dashboard
│   ├── DetailPage.tsx              # Movie/TV show details
│   ├── ListsPage.tsx               # Custom lists management
│   ├── ProfilePage.tsx             # User profile
│   ├── SearchPage.tsx              # Search interface
│   └── SocialPage.tsx              # Social features
├── services/
│   └── tmdb.ts                     # TMDB API service
├── types/
│   └── database.types.ts           # Database type definitions
├── App.tsx                         # Main app component
├── main.tsx                        # App entry point
└── index.css                       # Global styles
```

## Database Schema

### Tables

**profiles**
- User profile information extending auth.users
- Includes username, avatar, and bio

**watchlist_items**
- Tracks user's watching status for content
- Supports multiple statuses and ratings

**tv_show_progress**
- Episode-level tracking for TV shows
- Records watched status and timestamps

**custom_lists**
- User-created lists for organizing content
- Can be public or private

**list_items**
- Items within custom lists
- Supports ordering and notes

**follows**
- User following relationships
- Enables social features

**list_shares**
- Collaborative list sharing
- Supports view and edit permissions

All tables have Row Level Security enabled with restrictive policies.

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (already set up in .env)
4. Run development server (automatically starts):
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Key Features Explained

### PWA Capabilities
The app includes a service worker that caches:
- Static assets (JS, CSS, images)
- TMDB API responses (7 days)
- TMDB images (30 days)

This enables offline browsing of previously viewed content.

### Security
- All database access is secured with RLS policies
- Users can only access their own data
- Public content is explicitly marked
- Shared lists require permission

### Social Features
- Search and follow other users
- View followers and following lists
- Share custom lists with specific users
- Control edit permissions on shared lists

### Episode Tracking
For TV shows, users can:
- Navigate through seasons
- Mark individual episodes as watched
- See episode details and air dates
- Track viewing progress visually

## API Usage

### TMDB API
The app uses TMDB API through an edge function proxy that:
- Protects the API key
- Handles CORS
- Implements rate limiting with exponential backoff
- Respects TMDB's terms of use

**TMDB Compliance**: This application fully complies with TMDB API terms of use including:
- Proper attribution and logo display
- Rate limit handling (429 responses)
- No data caching beyond 6 months
- Non-commercial use licensing

See [TMDB_COMPLIANCE.md](./TMDB_COMPLIANCE.md) for complete compliance documentation.

### Supabase
- Realtime database updates
- Secure authentication
- Row-level security
- Edge functions for serverless logic

## Development

The project uses modern development practices:
- TypeScript for type safety
- Component-based architecture
- Context API for state management
- Custom hooks for reusable logic
- Mobile-first responsive design

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Initial load: < 2s on 3G
- Service worker caching for instant repeat visits
- Lazy loading for images
- Code splitting for optimal bundle size

## Future Enhancements

Potential additions:
- Push notifications for new episodes
- Rating and review system
- Recommendation engine
- Activity feed
- Import/export lists
- Multiple themes

## License

This project is built for educational purposes.
