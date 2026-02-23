export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          avatar_url: string | null
          bio: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
          bio?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          avatar_url?: string | null
          bio?: string
          created_at?: string
          updated_at?: string
        }
      }
      watchlist_items: {
        Row: {
          id: string
          user_id: string
          profile_id: string | null
          tmdb_id: number
          media_type: 'movie' | 'tv'
          status: 'watching' | 'completed' | 'plan_to_watch' | 'dropped'
          rating: number | null
          notes: string
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          profile_id?: string | null
          tmdb_id: number
          media_type: 'movie' | 'tv'
          status?: 'watching' | 'completed' | 'plan_to_watch' | 'dropped'
          rating?: number | null
          notes?: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          profile_id?: string | null
          tmdb_id?: number
          media_type?: 'movie' | 'tv'
          status?: 'watching' | 'completed' | 'plan_to_watch' | 'dropped'
          rating?: number | null
          notes?: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tv_show_progress: {
        Row: {
          id: string
          user_id: string
          profile_id: string | null
          tmdb_id: number
          season_number: number
          episode_number: number
          watched: boolean
          watched_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          profile_id?: string | null
          tmdb_id: number
          season_number: number
          episode_number: number
          watched?: boolean
          watched_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          profile_id?: string | null
          tmdb_id?: number
          season_number?: number
          episode_number?: number
          watched?: boolean
          watched_at?: string | null
          created_at?: string
        }
      }
      custom_lists: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      list_items: {
        Row: {
          id: string
          list_id: string
          tmdb_id: number
          media_type: 'movie' | 'tv'
          notes: string
          position: number
          added_at: string
        }
        Insert: {
          id?: string
          list_id: string
          tmdb_id: number
          media_type: 'movie' | 'tv'
          notes?: string
          position?: number
          added_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          tmdb_id?: number
          media_type?: 'movie' | 'tv'
          notes?: string
          position?: number
          added_at?: string
        }
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string
        }
      }
      list_shares: {
        Row: {
          id: string
          list_id: string
          shared_with_user_id: string
          can_edit: boolean
          created_at: string
        }
        Insert: {
          id?: string
          list_id: string
          shared_with_user_id: string
          can_edit?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          shared_with_user_id?: string
          can_edit?: boolean
          created_at?: string
        }
      }
      binge_sessions: {
        Row: {
          id: string
          user_id: string
          tmdb_id: number
          started_at: string
          ended_at: string | null
          episodes_watched: number
          total_duration_minutes: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tmdb_id: number
          started_at?: string
          ended_at?: string | null
          episodes_watched?: number
          total_duration_minutes?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tmdb_id?: number
          started_at?: string
          ended_at?: string | null
          episodes_watched?: number
          total_duration_minutes?: number
          created_at?: string
        }
      }
      episode_reminders: {
        Row: {
          id: string
          user_id: string
          tmdb_id: number
          season_number: number
          episode_number: number
          air_date: string
          is_season_finale: boolean
          reminder_sent: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tmdb_id: number
          season_number: number
          episode_number: number
          air_date: string
          is_season_finale?: boolean
          reminder_sent?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tmdb_id?: number
          season_number?: number
          episode_number?: number
          air_date?: string
          is_season_finale?: boolean
          reminder_sent?: boolean
          created_at?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          english_only_filter: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          english_only_filter?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          english_only_filter?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
