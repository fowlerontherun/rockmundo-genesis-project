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
      chat_messages: {
        Row: {
          channel: string
          created_at: string | null
          id: string
          message: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string | null
          id?: string
          message: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string | null
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_participants: {
        Row: {
          channel: string
          created_at: string | null
          id: string
          last_seen: string | null
          status: Database["public"]["Enums"]["chat_participant_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string | null
          id?: string
          last_seen?: string | null
          status?: Database["public"]["Enums"]["chat_participant_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string | null
          id?: string
          last_seen?: string | null
          status?: Database["public"]["Enums"]["chat_participant_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          bonuses: string | null
          busking_value: number
          cost_of_living: number | null
          country: string
          created_at: string | null
          cultural_events: string[] | null
          dominant_genre: string | null
          featured_studios: Json
          featured_venues: Json
          famous_resident: string | null
          id: string
          local_bonus: number | null
          music_scene: number | null
          name: string
          population: number | null
          profile_description: string | null
          transport_links: Json
          travel_hub: string | null
          updated_at: string | null
          unlocked: boolean
          venues: number | null
        }
        Insert: {
          bonuses?: string | null
          busking_value?: number
          cost_of_living?: number | null
          country: string
          created_at?: string | null
          cultural_events?: string[] | null
          dominant_genre?: string | null
          featured_studios?: Json
          featured_venues?: Json
          famous_resident?: string | null
          id?: string
          local_bonus?: number | null
          music_scene?: number | null
          name: string
          population?: number | null
          profile_description?: string | null
          transport_links?: Json
          travel_hub?: string | null
          updated_at?: string | null
          unlocked?: boolean
          venues?: number | null
        }
        Update: {
          bonuses?: string | null
          busking_value?: number
          cost_of_living?: number | null
          country?: string
          created_at?: string | null
          cultural_events?: string[] | null
          dominant_genre?: string | null
          featured_studios?: Json
          featured_venues?: Json
          famous_resident?: string | null
          id?: string
          local_bonus?: number | null
          music_scene?: number | null
          name?: string
          population?: number | null
          profile_description?: string | null
          transport_links?: Json
          travel_hub?: string | null
          updated_at?: string | null
          unlocked?: boolean
          venues?: number | null
        }
        Relationships: []
      }
      education_youtube_resources: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          difficulty_level: number | null
          duration_minutes: number | null
          id: string
          tags: string[] | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty_level?: number | null
          duration_minutes?: number | null
          id?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty_level?: number | null
          duration_minutes?: number | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          video_url?: string
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
      experience_ledger: {
        Row: {
          activity_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          profile_id: string | null
          skill_slug: string | null
          user_id: string
          xp_amount: number
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          skill_slug?: string | null
          user_id: string
          xp_amount?: number
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          skill_slug?: string | null
          user_id?: string
          xp_amount?: number
        }
        Relationships: []
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
      friendships: {
        Row: {
          created_at: string | null
          friend_profile_id: string | null
          friend_user_id: string
          id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string | null
          user_id: string
          user_profile_id: string | null
        }
        Insert: {
          created_at?: string | null
          friend_profile_id?: string | null
          friend_user_id: string
          id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string | null
          user_id: string
          user_profile_id?: string | null
        }
        Update: {
          created_at?: string | null
          friend_profile_id?: string | null
          friend_user_id?: string
          id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string | null
          user_id?: string
          user_profile_id?: string | null
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
          show_type: string | null
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
          show_type?: string | null
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
          show_type?: string | null
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
      player_attributes: {
        Row: {
          attribute_points: number | null
          attribute_points_spent: number | null
          business_acumen: number | null
          charisma: number | null
          created_at: string | null
          creative_insight: number | null
          crowd_engagement: number | null
          id: string
          looks: number | null
          marketing_savvy: number | null
          mental_focus: number | null
          musical_ability: number | null
          musicality: number | null
          physical_endurance: number | null
          profile_id: string | null
          rhythm_sense: number | null
          social_reach: number | null
          stage_presence: number | null
          technical_mastery: number | null
          updated_at: string | null
          user_id: string
          vocal_talent: number | null
        }
        Insert: {
          attribute_points?: number | null
          attribute_points_spent?: number | null
          business_acumen?: number | null
          charisma?: number | null
          created_at?: string | null
          creative_insight?: number | null
          crowd_engagement?: number | null
          id?: string
          looks?: number | null
          marketing_savvy?: number | null
          mental_focus?: number | null
          musical_ability?: number | null
          musicality?: number | null
          physical_endurance?: number | null
          profile_id?: string | null
          rhythm_sense?: number | null
          social_reach?: number | null
          stage_presence?: number | null
          technical_mastery?: number | null
          updated_at?: string | null
          user_id: string
          vocal_talent?: number | null
        }
        Update: {
          attribute_points?: number | null
          attribute_points_spent?: number | null
          business_acumen?: number | null
          charisma?: number | null
          created_at?: string | null
          creative_insight?: number | null
          crowd_engagement?: number | null
          id?: string
          looks?: number | null
          marketing_savvy?: number | null
          mental_focus?: number | null
          musical_ability?: number | null
          musicality?: number | null
          physical_endurance?: number | null
          profile_id?: string | null
          rhythm_sense?: number | null
          social_reach?: number | null
          stage_presence?: number | null
          technical_mastery?: number | null
          updated_at?: string | null
          user_id?: string
          vocal_talent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_attributes_profile_id_fkey"
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
          bass: number
          business: number
          composition: number
          created_at: string
          creativity: number
          drums: number
          guitar: number
          id: string
          marketing: number
          performance: number
          songwriting: number
          technical: number
          updated_at: string
          user_id: string
          vocals: number
        }
        Insert: {
          bass?: number
          business?: number
          composition?: number
          created_at?: string
          creativity?: number
          drums?: number
          guitar?: number
          id?: string
          marketing?: number
          performance?: number
          songwriting?: number
          technical?: number
          updated_at?: string
          user_id: string
          vocals?: number
        }
        Update: {
          bass?: number
          business?: number
          composition?: number
          created_at?: string
          creativity?: number
          drums?: number
          guitar?: number
          id?: string
          marketing?: number
          performance?: number
          songwriting?: number
          technical?: number
          updated_at?: string
          user_id?: string
          vocals?: number
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
      player_xp_wallet: {
        Row: {
          attribute_points_earned: number | null
          last_recalculated: string | null
          lifetime_xp: number | null
          profile_id: string
          skill_points_earned: number | null
          xp_balance: number | null
          xp_spent: number | null
        }
        Insert: {
          attribute_points_earned?: number | null
          last_recalculated?: string | null
          lifetime_xp?: number | null
          profile_id: string
          skill_points_earned?: number | null
          xp_balance?: number | null
          xp_spent?: number | null
        }
        Update: {
          attribute_points_earned?: number | null
          last_recalculated?: string | null
          lifetime_xp?: number | null
          profile_id?: string
          skill_points_earned?: number | null
          xp_balance?: number | null
          xp_spent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_xp_wallet_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_daily_xp_grants: {
        Row: {
          claimed_at: string
          grant_date: string
          id: string
          metadata: Json
          profile_id: string
          xp_awarded: number
        }
        Insert: {
          claimed_at?: string
          grant_date?: string
          id?: string
          metadata?: Json
          profile_id: string
          xp_awarded: number
        }
        Update: {
          claimed_at?: string
          grant_date?: string
          id?: string
          metadata?: Json
          profile_id?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number
          bio: string | null
          cash: number | null
          created_at: string | null
          current_city_id: string | null
          display_name: string | null
          experience: number | null
          experience_at_last_weekly_bonus: number | null
          fame: number | null
          fans: number | null
          id: string
          last_weekly_bonus_at: string | null
          level: number | null
          updated_at: string | null
          user_id: string
          username: string
          weekly_bonus_metadata: Json | null
          weekly_bonus_streak: number | null
        }
        Insert: {
          age?: number
          bio?: string | null
          cash?: number | null
          created_at?: string | null
          current_city_id?: string | null
          display_name?: string | null
          experience?: number | null
          experience_at_last_weekly_bonus?: number | null
          fame?: number | null
          fans?: number | null
          id?: string
          last_weekly_bonus_at?: string | null
          level?: number | null
          updated_at?: string | null
          user_id: string
          username: string
          weekly_bonus_metadata?: Json | null
          weekly_bonus_streak?: number | null
        }
        Update: {
          age?: number
          bio?: string | null
          cash?: number | null
          created_at?: string | null
          current_city_id?: string | null
          display_name?: string | null
          experience?: number | null
          experience_at_last_weekly_bonus?: number | null
          fame?: number | null
          fans?: number | null
          id?: string
          last_weekly_bonus_at?: string | null
          level?: number | null
          updated_at?: string | null
          user_id?: string
          username?: string
          weekly_bonus_metadata?: Json | null
          weekly_bonus_streak?: number | null
        }
        Relationships: []
      }
      skill_definitions: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          slug: string
          tier_caps: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          slug: string
          tier_caps?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          slug?: string
          tier_caps?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      skill_parent_links: {
        Row: {
          created_at: string | null
          id: string
          parent_skill_id: string
          skill_id: string
          unlock_threshold: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_skill_id: string
          skill_id: string
          unlock_threshold?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_skill_id?: string
          skill_id?: string
          unlock_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_parent_links_parent_skill_id_fkey"
            columns: ["parent_skill_id"]
            isOneToOne: false
            referencedRelation: "skill_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_parent_links_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skill_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_progress: {
        Row: {
          created_at: string | null
          current_level: number | null
          current_xp: number | null
          id: string
          last_practiced_at: string | null
          metadata: Json | null
          profile_id: string
          required_xp: number | null
          skill_slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_level?: number | null
          current_xp?: number | null
          id?: string
          last_practiced_at?: string | null
          metadata?: Json | null
          profile_id: string
          required_xp?: number | null
          skill_slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_level?: number | null
          current_xp?: number | null
          id?: string
          last_practiced_at?: string | null
          metadata?: Json | null
          profile_id?: string
          required_xp?: number | null
          skill_slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          comments: number | null
          content: string
          created_at: string | null
          fan_growth: number | null
          id: string
          likes: number | null
          platform: string
          shares: number | null
          user_id: string
        }
        Insert: {
          comments?: number | null
          content: string
          created_at?: string | null
          fan_growth?: number | null
          id?: string
          likes?: number | null
          platform: string
          shares?: number | null
          user_id: string
        }
        Update: {
          comments?: number | null
          content?: string
          created_at?: string | null
          fan_growth?: number | null
          id?: string
          likes?: number | null
          platform?: string
          shares?: number | null
          user_id?: string
        }
        Relationships: []
      }
      songwriting_projects: {
        Row: {
          created_at: string
          id: string
          locked_until: string | null
          lyrics: string | null
          sessions_completed: number
          song_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          locked_until?: string | null
          lyrics?: string | null
          sessions_completed?: number
          song_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          locked_until?: string | null
          lyrics?: string | null
          sessions_completed?: number
          song_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "songwriting_projects_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songwriting_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      songwriting_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          locked_until: string
          notes: string | null
          project_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          locked_until: string
          notes?: string | null
          project_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          locked_until?: string
          notes?: string | null
          project_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "songwriting_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "songwriting_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songwriting_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      songs: {
        Row: {
          audio_layers: Json[] | null
          chart_position: number | null
          created_at: string
          genre: string
          id: string
          lyrics: string | null
          quality_score: number
          release_date: string | null
          revenue: number
          status: string
          streams: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_layers?: Json[] | null
          chart_position?: number | null
          created_at?: string
          genre: string
          id?: string
          lyrics?: string | null
          quality_score?: number
          release_date?: string | null
          revenue?: number
          status?: string
          streams?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_layers?: Json[] | null
          chart_position?: number | null
          created_at?: string
          genre?: string
          id?: string
          lyrics?: string | null
          quality_score?: number
          release_date?: string | null
          revenue?: number
          status?: string
          streams?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_booking_artists: {
        Row: {
          booking_id: string
          character_id: string
          daily_cost: number
          id: string
          role: Database["public"]["Enums"]["studio_booking_artist_role"]
        }
        Insert: {
          booking_id: string
          character_id: string
          daily_cost?: number
          id?: string
          role: Database["public"]["Enums"]["studio_booking_artist_role"]
        }
        Update: {
          booking_id?: string
          character_id?: string
          daily_cost?: number
          id?: string
          role?: Database["public"]["Enums"]["studio_booking_artist_role"]
        }
        Relationships: [
          {
            foreignKeyName: "studio_booking_artists_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "studio_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_booking_artists_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_booking_slots: {
        Row: {
          booking_id: string
          id: string
          is_booked: boolean
          slot: Database["public"]["Enums"]["studio_slot"]
          slot_date: string
        }
        Insert: {
          booking_id: string
          id?: string
          is_booked?: boolean
          slot: Database["public"]["Enums"]["studio_slot"]
          slot_date: string
        }
        Update: {
          booking_id?: string
          id?: string
          is_booked?: boolean
          slot?: Database["public"]["Enums"]["studio_slot"]
          slot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_booking_slots_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "studio_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_booking_songs: {
        Row: {
          booking_id: string
          id: string
          momentum: number
          progress_end: number
          progress_start: number
          song_id: string
        }
        Insert: {
          booking_id: string
          id?: string
          momentum?: number
          progress_end?: number
          progress_start?: number
          song_id: string
        }
        Update: {
          booking_id?: string
          id?: string
          momentum?: number
          progress_end?: number
          progress_start?: number
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_booking_songs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "studio_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_booking_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_bookings: {
        Row: {
          band_id: string
          created_at: string
          end_date: string
          id: string
          mood: Database["public"]["Enums"]["studio_session_mood"]
          producer_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["studio_booking_status"]
          studio_id: string
          total_cost: number
          updated_at: string
        }
        Insert: {
          band_id: string
          created_at?: string
          end_date: string
          id?: string
          mood: Database["public"]["Enums"]["studio_session_mood"]
          producer_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["studio_booking_status"]
          studio_id: string
          total_cost?: number
          updated_at?: string
        }
        Update: {
          band_id?: string
          created_at?: string
          end_date?: string
          id?: string
          mood?: Database["public"]["Enums"]["studio_session_mood"]
          producer_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["studio_booking_status"]
          studio_id?: string
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_bookings_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_bookings_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_bookings_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          city_id: string
          cost_per_day: number
          created_at: string
          engineer_rating: number
          equipment_rating: number
          id: string
          name: string
          quality: number
          updated_at: string
        }
        Insert: {
          city_id: string
          cost_per_day: number
          created_at?: string
          engineer_rating: number
          equipment_rating: number
          id?: string
          name: string
          quality: number
          updated_at?: string
        }
        Update: {
          city_id?: string
          cost_per_day?: number
          created_at?: string
          engineer_rating?: number
          equipment_rating?: number
          id?: string
          name?: string
          quality?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studios_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
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
      tour_venues: {
        Row: {
          date: string
          id: string
          revenue: number | null
          status: string | null
          ticket_price: number | null
          tickets_sold: number | null
          tour_id: string
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
      [_ in never]: never
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
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      chat_participant_status: "online" | "offline" | "typing" | "away"
      friendship_status: "pending" | "accepted" | "declined" | "blocked"
      show_type_enum: "concert" | "festival" | "private" | "street"
      studio_booking_artist_role: "band_member" | "session_musician" | "producer"
      studio_booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      studio_session_mood: "professional" | "party" | "chilled"
      studio_slot: "morning" | "evening"
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
      app_role: ["admin", "moderator", "user"],
      chat_participant_status: ["online", "offline", "typing", "away"],
      friendship_status: ["pending", "accepted", "declined", "blocked"],
      show_type_enum: ["concert", "festival", "private", "street"],
    },
  },
} as const
