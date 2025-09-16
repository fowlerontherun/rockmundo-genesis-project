export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          rarity: string | null
          requirements: Json | null
          rewards: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          rarity?: string | null
          requirements?: Json | null
          rewards?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          rarity?: string | null
          requirements?: Json | null
          rewards?: Json | null
        }
        Relationships: []
      }
      activity_feed: {
        Row: {
          activity_type: string
          created_at: string | null
          earnings: number | null
          id: string
          message: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          earnings?: number | null
          id?: string
          message: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          earnings?: number | null
          id?: string
          message?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      chat_participants: {
        Row: {
          channel: string
          id: string
          status: Database["public"]["Enums"]["chat_participant_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          id?: string
          status?: Database["public"]["Enums"]["chat_participant_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          id?: string
          status?: Database["public"]["Enums"]["chat_participant_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      band_invitations: {
        Row: {
          band_id: string
          created_at: string | null
          id: string
          invitee_id: string | null
          inviter_id: string
          responded_at: string | null
          role: string
          salary: number | null
          status: string
        }
        Insert: {
          band_id: string
          created_at?: string | null
          id?: string
          invitee_id?: string | null
          inviter_id: string
          responded_at?: string | null
          role: string
          salary?: number | null
          status?: string
        }
        Update: {
          band_id?: string
          created_at?: string | null
          id?: string
          invitee_id?: string | null
          inviter_id?: string
          responded_at?: string | null
          role?: string
          salary?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_invitations_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          }
        ]
      }
      band_members: {
        Row: {
          band_id: string
          id: string
          joined_at: string | null
          role: string
          salary: number | null
          user_id: string
        }
        Insert: {
          band_id: string
          id?: string
          joined_at?: string | null
          role: string
          salary?: number | null
          user_id: string
        }
        Update: {
          band_id?: string
          id?: string
          joined_at?: string | null
          role?: string
          salary?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_members_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_band_members_band"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      bands: {
        Row: {
          created_at: string | null
          description: string | null
          genre: string | null
          id: string
          leader_id: string
          max_members: number | null
          name: string
          popularity: number | null
          updated_at: string | null
          weekly_fans: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          leader_id: string
          max_members?: number | null
          name: string
          popularity?: number | null
          updated_at?: string | null
          weekly_fans?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          leader_id?: string
          max_members?: number | null
          name?: string
          popularity?: number | null
          updated_at?: string | null
          weekly_fans?: number | null
        }
        Relationships: []
      }
      chart_entries: {
        Row: {
          chart_date: string | null
          chart_type: string
          created_at: string | null
          id: string
          plays_count: number | null
          rank: number
          song_id: string
          trend: string | null
          trend_change: number | null
          weeks_on_chart: number | null
        }
        Insert: {
          chart_date?: string | null
          chart_type: string
          created_at?: string | null
          id?: string
          plays_count?: number | null
          rank: number
          song_id: string
          trend?: string | null
          trend_change?: number | null
          weeks_on_chart?: number | null
        }
        Update: {
          chart_date?: string | null
          chart_type?: string
          created_at?: string | null
          id?: string
          plays_count?: number | null
          rank?: number
          song_id?: string
          trend?: string | null
          trend_change?: number | null
          weeks_on_chart?: number | null
        }
        Relationships: []
      }
      competition_participants: {
        Row: {
          awarded_at: string | null
          competition_id: string
          final_rank: number | null
          id: string
          joined_at: string | null
          prize_amount: number
          profile_id: string
          score: number
        }
        Insert: {
          awarded_at?: string | null
          competition_id: string
          final_rank?: number | null
          id?: string
          joined_at?: string | null
          prize_amount?: number
          profile_id: string
          score?: number
        }
        Update: {
          awarded_at?: string | null
          competition_id?: string
          final_rank?: number | null
          id?: string
          joined_at?: string | null
          prize_amount?: number
          profile_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_participants_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          end_date: string
          entry_fee: number
          id: string
          is_active: boolean
          is_completed: boolean
          max_participants: number
          name: string
          prize_pool: number
          requirements: Json
          start_date: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          end_date: string
          entry_fee?: number
          id?: string
          is_active?: boolean
          is_completed?: boolean
          max_participants?: number
          name: string
          prize_pool?: number
          requirements?: Json
          start_date: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          end_date?: string
          entry_fee?: number
          id?: string
          is_active?: boolean
          is_completed?: boolean
          max_participants?: number
          name?: string
          prize_pool?: number
          requirements?: Json
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          advance_balance: number
          advance_payment: number
          contract_type: string
          created_at: string | null
          duration_months: number
          end_date: string | null
          id: string
          label_id: string | null
          label_name: string
          renewal_option: string | null
          royalty_rate: number
          signed_at: string
          status: string
          termination_reason: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          advance_balance?: number
          advance_payment?: number
          contract_type: string
          created_at?: string | null
          duration_months: number
          end_date?: string | null
          id?: string
          label_id?: string | null
          label_name: string
          renewal_option?: string | null
          royalty_rate: number
          signed_at?: string
          status?: string
          termination_reason?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          advance_balance?: number
          advance_payment?: number
          contract_type?: string
          created_at?: string | null
          duration_months?: number
          end_date?: string | null
          id?: string
          label_id?: string | null
          label_name?: string
          renewal_option?: string | null
          royalty_rate?: number
          signed_at?: string
          status?: string
          termination_reason?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      equipment_items: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          rarity: string | null
          stat_boosts: Json | null
          subcategory: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          rarity?: string | null
          stat_boosts?: Json | null
          subcategory?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          rarity?: string | null
          stat_boosts?: Json | null
          subcategory?: string | null
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          event_id: string
          id: string
          joined_at: string | null
          performance_score: number | null
          rewards_claimed: boolean | null
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          joined_at?: string | null
          performance_score?: number | null
          rewards_claimed?: boolean | null
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          joined_at?: string | null
          performance_score?: number | null
          rewards_claimed?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "game_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_participants_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "game_events"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_demographics: {
        Row: {
          age_18_25: number | null
          age_26_35: number | null
          age_36_45: number | null
          age_45_plus: number | null
          engagement_rate: number | null
          id: string
          platform_instagram: number | null
          platform_tiktok: number | null
          platform_twitter: number | null
          platform_youtube: number | null
          total_fans: number | null
          updated_at: string | null
          user_id: string
          weekly_growth: number | null
        }
        Insert: {
          age_18_25?: number | null
          age_26_35?: number | null
          age_36_45?: number | null
          age_45_plus?: number | null
          engagement_rate?: number | null
          id?: string
          platform_instagram?: number | null
          platform_tiktok?: number | null
          platform_twitter?: number | null
          platform_youtube?: number | null
          total_fans?: number | null
          updated_at?: string | null
          user_id: string
          weekly_growth?: number | null
        }
        Update: {
          age_18_25?: number | null
          age_26_35?: number | null
          age_36_45?: number | null
          age_45_plus?: number | null
          engagement_rate?: number | null
          id?: string
          platform_instagram?: number | null
          platform_tiktok?: number | null
          platform_twitter?: number | null
          platform_youtube?: number | null
          total_fans?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_growth?: number | null
        }
        Relationships: []
      }
      game_events: {
        Row: {
          created_at: string | null
          current_participants: number | null
          description: string | null
          end_date: string
          event_type: string
          id: string
          is_active: boolean | null
          max_participants: number | null
          requirements: Json | null
          rewards: Json | null
          start_date: string
          title: string
        }
        Insert: {
          created_at?: string | null
          current_participants?: number | null
          description?: string | null
          end_date: string
          event_type: string
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          requirements?: Json | null
          rewards?: Json | null
          start_date: string
          title: string
        }
        Update: {
          created_at?: string | null
          current_participants?: number | null
          description?: string | null
          end_date?: string
          event_type?: string
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          requirements?: Json | null
          rewards?: Json | null
          start_date?: string
          title?: string
        }
        Relationships: []
      }
      global_charts: {
        Row: {
          chart_date: string
          chart_type: string
          created_at: string
          id: string
          rank: number
          song_id: string
          total_streams: number
          trend: string
          trend_change: number
          updated_at: string
          weeks_on_chart: number
        }
        Insert: {
          chart_date: string
          chart_type: string
          created_at?: string
          id?: string
          rank: number
          song_id: string
          total_streams?: number
          trend?: string
          trend_change?: number
          updated_at?: string
          weeks_on_chart?: number
        }
        Update: {
          chart_date?: string
          chart_type?: string
          created_at?: string
          id?: string
          rank?: number
          song_id?: string
          total_streams?: number
          trend?: string
          trend_change?: number
          updated_at?: string
          weeks_on_chart?: number
        }
        Relationships: [
          {
            foreignKeyName: "global_charts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_performances: {
        Row: {
          earnings: number | null
          gig_id: string | null
          id: string
          performance_score: number | null
          performed_at: string
          user_id: string
        }
        Insert: {
          earnings?: number | null
          gig_id?: string | null
          id?: string
          performance_score?: number | null
          performed_at?: string
          user_id: string
        }
        Update: {
          earnings?: number | null
          gig_id?: string | null
          id?: string
          performance_score?: number | null
          performed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gigs: {
        Row: {
          attendance: number | null
          band_id: string
          created_at: string | null
          fan_gain: number | null
          id: string
          payment: number | null
          scheduled_date: string
          status: string | null
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          attendance?: number | null
          band_id: string
          created_at?: string | null
          fan_gain?: number | null
          id?: string
          payment?: number | null
          scheduled_date: string
          status?: string | null
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          attendance?: number | null
          band_id?: string
          created_at?: string | null
          fan_gain?: number | null
          id?: string
          payment?: number | null
          scheduled_date?: string
          status?: string | null
          updated_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_gigs_band"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_gigs_venue"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gigs_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gigs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      global_chat: {
        Row: {
          channel: string | null
          created_at: string | null
          id: string
          message: string
          user_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          id?: string
          message: string
          user_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      jam_sessions: {
        Row: {
          access_code: string | null
          created_at: string
          current_participants: number
          description: string | null
          genre: string
          host_id: string
          id: string
          is_private: boolean
          max_participants: number
          name: string
          participant_ids: string[]
          skill_requirement: number
          tempo: number
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          created_at?: string
          current_participants?: number
          description?: string | null
          genre: string
          host_id: string
          id?: string
          is_private?: boolean
          max_participants?: number
          name: string
          participant_ids?: string[]
          skill_requirement?: number
          tempo?: number
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          created_at?: string
          current_participants?: number
          description?: string | null
          genre?: string
          host_id?: string
          id?: string
          is_private?: boolean
          max_participants?: number
          name?: string
          participant_ids?: string[]
          skill_requirement?: number
          tempo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jam_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      player_achievements: {
        Row: {
          achievement_id: string
          id: string
          progress: Json | null
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          progress?: Json | null
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          progress?: Json | null
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_player_achievements_achievement"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      player_rankings: {
        Row: {
          calculated_at: string
          hit_songs: number
          id: string
          profile_id: string
          rank: number
          ranking_type: string
          score: number
          total_plays: number
          trend: string
        }
        Insert: {
          calculated_at?: string
          hit_songs?: number
          id?: string
          profile_id: string
          rank: number
          ranking_type?: string
          score?: number
          total_plays?: number
          trend?: string
        }
        Update: {
          calculated_at?: string
          hit_songs?: number
          id?: string
          profile_id?: string
          rank?: number
          ranking_type?: string
          score?: number
          total_plays?: number
          trend?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_rankings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_equipment: {
        Row: {
          condition: number | null
          created_at: string | null
          equipment_id: string
          equipped: boolean | null
          id: string
          is_equipped: boolean | null
          purchased_at: string | null
          user_id: string
        }
        Insert: {
          condition?: number | null
          created_at?: string | null
          equipment_id: string
          equipped?: boolean | null
          id?: string
          is_equipped?: boolean | null
          purchased_at?: string | null
          user_id: string
        }
        Update: {
          condition?: number | null
          created_at?: string | null
          equipment_id?: string
          equipped?: boolean | null
          id?: string
          is_equipped?: boolean | null
          purchased_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_player_equipment_item"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      player_skills: {
        Row: {
          bass: number | null
          business: number | null
          composition: number | null
          created_at: string | null
          creativity: number | null
          drums: number | null
          guitar: number | null
          id: string
          marketing: number | null
          performance: number | null
          songwriting: number | null
          technical: number | null
          updated_at: string | null
          user_id: string
          vocals: number | null
        }
        Insert: {
          bass?: number | null
          business?: number | null
          composition?: number | null
          created_at?: string | null
          creativity?: number | null
          drums?: number | null
          guitar?: number | null
          id?: string
          marketing?: number | null
          performance?: number | null
          songwriting?: number | null
          technical?: number | null
          updated_at?: string | null
          user_id: string
          vocals?: number | null
        }
        Update: {
          bass?: number | null
          business?: number | null
          composition?: number | null
          created_at?: string | null
          creativity?: number | null
          drums?: number | null
          guitar?: number | null
          id?: string
          marketing?: number | null
          performance?: number | null
          songwriting?: number | null
          technical?: number | null
          updated_at?: string | null
          user_id?: string
          vocals?: number | null
        }
        Relationships: []
      }
      player_streaming_accounts: {
        Row: {
          connected_at: string | null
          followers: number | null
          id: string
          is_connected: boolean | null
          monthly_plays: number | null
          monthly_revenue: number | null
          platform_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          followers?: number | null
          id?: string
          is_connected?: boolean | null
          monthly_plays?: number | null
          monthly_revenue?: number | null
          platform_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          followers?: number | null
          id?: string
          is_connected?: boolean | null
          monthly_plays?: number | null
          monthly_revenue?: number | null
          platform_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_player_streaming_platform"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "streaming_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_streaming_accounts_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "streaming_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_campaigns: {
        Row: {
          budget: number
          campaign_type: string
          created_at: string | null
          id: string
          message: string | null
          new_placements: number | null
          platform_id: string | null
          platform_name: string | null
          playlist_name: string | null
          playlists_targeted: number | null
          song_id: string
          status: string
          stream_increase: number | null
          revenue_generated: number | null
          listeners_generated: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          budget?: number
          campaign_type: string
          created_at?: string | null
          id?: string
          message?: string | null
          new_placements?: number | null
          platform_id?: string | null
          platform_name?: string | null
          playlist_name?: string | null
          playlists_targeted?: number | null
          song_id: string
          status?: string
          stream_increase?: number | null
          revenue_generated?: number | null
          listeners_generated?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          budget?: number
          campaign_type?: string
          created_at?: string | null
          id?: string
          message?: string | null
          new_placements?: number | null
          platform_id?: string | null
          platform_name?: string | null
          playlist_name?: string | null
          playlists_targeted?: number | null
          song_id?: string
          status?: string
          stream_increase?: number | null
          revenue_generated?: number | null
          listeners_generated?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_campaigns_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "streaming_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaigns_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cash: number | null
          created_at: string | null
          display_name: string | null
          engagement_rate: number | null
          experience: number | null
          fame: number | null
          fans: number | null
          followers: number | null
          id: string
          level: number | null
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cash?: number | null
          created_at?: string | null
          display_name?: string | null
          engagement_rate?: number | null
          experience?: number | null
          fame?: number | null
          fans?: number | null
          followers?: number | null
          id?: string
          level?: number | null
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cash?: number | null
          created_at?: string | null
          display_name?: string | null
          engagement_rate?: number | null
          experience?: number | null
          fame?: number | null
          fans?: number | null
          followers?: number | null
          id?: string
          level?: number | null
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      social_campaigns: {
        Row: {
          budget: number
          created_at: string | null
          engagement: number
          end_date: string | null
          id: string
          name: string
          platform: string
          reach: number
          start_date: string | null
          status: "active" | "completed"
          updated_at: string | null
          user_id: string
        }
        Insert: {
          budget?: number
          created_at?: string | null
          engagement?: number
          end_date?: string | null
          id?: string
          name: string
          platform: string
          reach?: number
          start_date?: string | null
          status?: "active" | "completed"
          updated_at?: string | null
          user_id: string
        }
        Update: {
          budget?: number
          created_at?: string | null
          engagement?: number
          end_date?: string | null
          id?: string
          name?: string
          platform?: string
          reach?: number
          start_date?: string | null
          status?: "active" | "completed"
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      social_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          }
        ]
      }
      social_posts: {
        Row: {
          comments: number | null
          content: string
          created_at: string | null
          fan_growth: number | null
          id: string
          likes: number | null
          reposts: number | null
          platform: string
          shares: number | null
          timestamp: string | null
          user_id: string
          views: number | null
        }
        Insert: {
          comments?: number | null
          content: string
          created_at?: string | null
          fan_growth?: number | null
          id?: string
          likes?: number | null
          reposts?: number | null
          platform: string
          shares?: number | null
          timestamp?: string | null
          user_id: string
          views?: number | null
        }
        Update: {
          comments?: number | null
          content?: string
          created_at?: string | null
          fan_growth?: number | null
          id?: string
          likes?: number | null
          reposts?: number | null
          platform?: string
          shares?: number | null
          timestamp?: string | null
          user_id?: string
          views?: number | null
        }
        Relationships: []
      }
      social_reposts: {
        Row: {
          created_at: string
          id: string
          message: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          }
        ]
      }
      songs: {
        Row: {
          chart_position: number | null
          co_writers: string[]
          created_at: string
          genre: string
          id: string
          lyrics: string | null
          master_quality: number | null
          mix_quality: number | null
          production_cost: number | null
          quality_score: number
          release_date: string | null
          marketing_budget: number | null
          revenue: number
          split_percentages: number[]
          status: string
          streams: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chart_position?: number | null
          co_writers?: string[]
          created_at?: string
          genre: string
          id?: string
          lyrics?: string | null
          master_quality?: number | null
          mix_quality?: number | null
          production_cost?: number | null
          quality_score?: number
          release_date?: string | null
          marketing_budget?: number | null
          revenue?: number
          split_percentages?: number[]
          status?: string
          streams?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chart_position?: number | null
          co_writers?: string[]
          created_at?: string
          genre?: string
          id?: string
          lyrics?: string | null
          master_quality?: number | null
          mix_quality?: number | null
          production_cost?: number | null
          quality_score?: number
          release_date?: string | null
          marketing_budget?: number | null
          revenue?: number
          split_percentages?: number[]
          status?: string
          streams?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      streaming_platforms: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          min_followers: number | null
          name: string
          revenue_per_play: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          min_followers?: number | null
          name: string
          revenue_per_play?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          min_followers?: number | null
          name?: string
          revenue_per_play?: number | null
        }
        Relationships: []
      }
      streaming_stats: {
        Row: {
          created_at: string
          id: string
          platform_breakdown: Json
          song_id: string
          total_revenue: number
          total_streams: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform_breakdown?: Json
          song_id: string
          total_revenue?: number
          total_streams?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform_breakdown?: Json
          song_id?: string
          total_revenue?: number
          total_streams?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaming_stats_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          }
        ]
      }
      tour_venues: {
        Row: {
          date: string
          id: string
          revenue: number | null
          status: string | null
          ticket_price: number | null
          tickets_sold: number | null
          tour_id: string
          travel_cost: number | null
          lodging_cost: number | null
          misc_cost: number | null
          travel_time: number | null
          rest_days: number | null
          venue_id: string
        }
        Insert: {
          date: string
          id?: string
          revenue?: number | null
          status?: string | null
          ticket_price?: number | null
          tickets_sold?: number | null
          tour_id: string
          travel_cost?: number | null
          lodging_cost?: number | null
          misc_cost?: number | null
          travel_time?: number | null
          rest_days?: number | null
          venue_id: string
        }
        Update: {
          date?: string
          id?: string
          revenue?: number | null
          status?: string | null
          ticket_price?: number | null
          tickets_sold?: number | null
          tour_id?: string
          travel_cost?: number | null
          lodging_cost?: number | null
          misc_cost?: number | null
          travel_time?: number | null
          rest_days?: number | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tour_venues_tour"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tour_venues_venue"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_venues_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          band_id: string | null
          created_at: string | null
          description: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          status: string | null
          total_revenue: number | null
          user_id: string
        }
        Insert: {
          band_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string | null
          total_revenue?: number | null
          user_id: string
        }
        Update: {
          band_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string | null
          total_revenue?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tours_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venue_bookings: {
        Row: {
          actual_attendance: number | null
          created_at: string | null
          event_date: string
          expected_attendance: number | null
          id: string
          notes: string | null
          revenue: number | null
          status: string
          ticket_price: number | null
          updated_at: string | null
          user_id: string
          venue_id: string
        }
        Insert: {
          actual_attendance?: number | null
          created_at?: string | null
          event_date: string
          expected_attendance?: number | null
          id?: string
          notes?: string | null
          revenue?: number | null
          status?: string
          ticket_price?: number | null
          updated_at?: string | null
          user_id: string
          venue_id: string
        }
        Update: {
          actual_attendance?: number | null
          created_at?: string | null
          event_date?: string
          expected_attendance?: number | null
          id?: string
          notes?: string | null
          revenue?: number | null
          status?: string
          ticket_price?: number | null
          updated_at?: string | null
          user_id?: string
          venue_id?: string
        }
        Relationships: []
      }
      venue_relationships: {
        Row: {
          created_at: string | null
          id: string
          last_interaction_at: string | null
          relationship_level: string | null
          relationship_score: number
          updated_at: string | null
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_interaction_at?: string | null
          relationship_level?: string | null
          relationship_score: number
          updated_at?: string | null
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_interaction_at?: string | null
          relationship_level?: string | null
          relationship_score?: number
          updated_at?: string | null
          user_id?: string
          venue_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          base_payment: number | null
          capacity: number | null
          created_at: string | null
          id: string
          location: string | null
          name: string
          prestige_level: number | null
          requirements: Json | null
          venue_type: string | null
        }
        Insert: {
          base_payment?: number | null
          capacity?: number | null
          created_at?: string | null
          id?: string
          location?: string | null
          name: string
          prestige_level?: number | null
          requirements?: Json | null
          venue_type?: string | null
        }
        Update: {
          base_payment?: number | null
          capacity?: number | null
          created_at?: string | null
          id?: string
          location?: string | null
          name?: string
          prestige_level?: number | null
          requirements?: Json | null
          venue_type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      leaderboards: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          experience: number
          fame: number
          total_achievements: number
          total_gigs: number
          total_revenue: number
          user_id: string
          username: string | null
        }
        Relationships: []
      },
      player_achievement_summary: {
        Row: {
          earned_count: number
          last_unlocked_at: string | null
          remaining_count: number
          total_achievements: number
          user_id: string
        }
        Relationships: []
      }
      weekly_stats: {
        Row: {
          fan_change: number
          fans_change: number
          gigs_change: number
          gigs_performed: number
          previous_fans: number
          previous_gigs: number
          previous_songs: number
          songs_change: number
          songs_created: number
          user_id: string
          week_end: string
          week_start: string
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refresh_global_charts: {
        Args: {
          p_limit?: number | null
        }
        Returns: null
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      chat_participant_status: "online" | "typing" | "muted"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      chat_participant_status: ["online", "typing", "muted"],
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
