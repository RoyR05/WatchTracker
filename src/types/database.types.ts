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
          approval_status: 'pending' | 'approved' | 'rejected'
          approved_by: string | null
          approved_at: string | null
          can_broadcast: boolean
          onboarded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
          bio?: string
          approval_status?: 'pending' | 'approved' | 'rejected'
          approved_by?: string | null
          approved_at?: string | null
          can_broadcast?: boolean
          onboarded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          avatar_url?: string | null
          bio?: string
          approval_status?: 'pending' | 'approved' | 'rejected'
          approved_by?: string | null
          approved_at?: string | null
          can_broadcast?: boolean
          onboarded_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      watchlist_items: {
        Row: {
          id: string
          user_id: string
          tmdb_id: number
          media_type: 'movie' | 'tv'
          status: 'watching' | 'completed' | 'plan_to_watch' | 'dropped'
          rating: number | null
          notes: string
          note_is_private: boolean
          title: string | null
          poster_path: string | null
          media_year: number | null
          next_air_date: string | null
          last_air_date: string | null
          show_status: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tmdb_id: number
          media_type: 'movie' | 'tv'
          status?: 'watching' | 'completed' | 'plan_to_watch' | 'dropped'
          rating?: number | null
          notes?: string
          note_is_private?: boolean
          title?: string | null
          poster_path?: string | null
          media_year?: number | null
          next_air_date?: string | null
          last_air_date?: string | null
          show_status?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tmdb_id?: number
          media_type?: 'movie' | 'tv'
          status?: 'watching' | 'completed' | 'plan_to_watch' | 'dropped'
          rating?: number | null
          notes?: string
          note_is_private?: boolean
          title?: string | null
          poster_path?: string | null
          media_year?: number | null
          next_air_date?: string | null
          last_air_date?: string | null
          show_status?: string | null
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
          is_curated: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string
          is_public?: boolean
          is_curated?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string
          is_public?: boolean
          is_curated?: boolean
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
          hiatus_hide_weeks: number
          hiatus_show_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          english_only_filter?: boolean
          hiatus_hide_weeks?: number
          hiatus_show_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          english_only_filter?: boolean
          hiatus_hide_weeks?: number
          hiatus_show_days?: number
          created_at?: string
          updated_at?: string
        }
      }
      followed_people: {
        Row: {
          id: string
          user_id: string
          person_id: number
          name: string
          profile_path: string | null
          known_for_department: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          person_id: number
          name: string
          profile_path?: string | null
          known_for_department?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          person_id?: number
          name?: string
          profile_path?: string | null
          known_for_department?: string | null
          created_at?: string
        }
      }
      followed_feed_hidden: {
        Row: {
          id: string
          user_id: string
          tmdb_id: number
          media_type: string
          had_date_when_hidden: boolean
          hidden_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tmdb_id: number
          media_type: string
          had_date_when_hidden?: boolean
          hidden_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tmdb_id?: number
          media_type?: string
          had_date_when_hidden?: boolean
          hidden_at?: string
        }
      }
      followed_feed_cache: {
        Row: {
          user_id: string
          payload: Json
          computed_at: string
        }
        Insert: {
          user_id: string
          payload?: Json
          computed_at?: string
        }
        Update: {
          user_id?: string
          payload?: Json
          computed_at?: string
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
