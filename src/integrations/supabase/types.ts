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
          profile_id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          earnings?: number | null
          id?: string
          message: string
          metadata?: Json | null
          profile_id: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          earnings?: number | null
          id?: string
          message?: string
          metadata?: Json | null
          profile_id?: string
          user_id?: string
        }
        Relationships: []
      }
      band_conflicts: {
        Row: {
          band_id: string
          conflict_type: string
          created_at: string
          description: string | null
          id: string
          involved_member_ids: string[]
          issue_tags: string[]
          resolved: boolean
          resolved_at: string | null
          resolution_notes: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          band_id: string
          conflict_type: string
          created_at?: string
          description?: string | null
          id?: string
          involved_member_ids?: string[]
          issue_tags?: string[]
          resolved?: boolean
          resolved_at?: string | null
          resolution_notes?: string | null
          severity: string
          updated_at?: string
        }
        Update: {
          band_id?: string
          conflict_type?: string
          created_at?: string
          description?: string | null
          id?: string
          involved_member_ids?: string[]
          issue_tags?: string[]
          resolved?: boolean
          resolved_at?: string | null
          resolution_notes?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_conflicts_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          }
        ]
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
      busking_locations: {
        Row: {
          ambiance: string | null
          base_payout: number
          cooldown_minutes: number
          created_at: string
          description: string | null
          experience_reward: number
          fame_reward: number
          id: string
          name: string
          neighborhood: string | null
          recommended_skill: number
          risk_level: string
        }
        Insert: {
          ambiance?: string | null
          base_payout?: number
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          experience_reward?: number
          fame_reward?: number
          id?: string
          name: string
          neighborhood?: string | null
          recommended_skill?: number
          risk_level?: string
        }
        Update: {
          ambiance?: string | null
          base_payout?: number
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          experience_reward?: number
          fame_reward?: number
          id?: string
          name?: string
          neighborhood?: string | null
          recommended_skill?: number
          risk_level?: string
        }
        Relationships: []
      }
      busking_modifiers: {
        Row: {
          created_at: string
          description: string | null
          experience_bonus: number
          fame_multiplier: number
          id: string
          name: string
          payout_multiplier: number
          rarity: string
          risk_modifier: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          experience_bonus?: number
          fame_multiplier?: number
          id?: string
          name: string
          payout_multiplier?: number
          rarity?: string
          risk_modifier?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          experience_bonus?: number
          fame_multiplier?: number
          id?: string
          name?: string
          payout_multiplier?: number
          rarity?: string
          risk_modifier?: number
        }
        Relationships: []
      }
      busking_sessions: {
        Row: {
          cash_earned: number
          created_at: string
          crowd_reaction: string | null
          duration_minutes: number
          experience_gained: number
          failure_reason: string | null
          fame_gained: number
          id: string
          location_id: string
          modifier_id: string | null
          notes: string | null
          performance_score: number
          risk_level: string | null
          success: boolean
          user_id: string
        }
        Insert: {
          cash_earned?: number
          created_at?: string
          crowd_reaction?: string | null
          duration_minutes?: number
          experience_gained?: number
          failure_reason?: string | null
          fame_gained?: number
          id?: string
          location_id: string
          modifier_id?: string | null
          notes?: string | null
          performance_score?: number
          risk_level?: string | null
          success?: boolean
          user_id: string
        }
        Update: {
          cash_earned?: number
          created_at?: string
          crowd_reaction?: string | null
          duration_minutes?: number
          experience_gained?: number
          failure_reason?: string | null
          fame_gained?: number
          id?: string
          location_id?: string
          modifier_id?: string | null
          notes?: string | null
          performance_score?: number
          risk_level?: string | null
          success?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "busking_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "busking_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "busking_sessions_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "busking_modifiers"
            referencedColumns: ["id"]
          }
        ]
      }
      band_events: {
        Row: {
          band_id: string
          chemistry_change: number
          cost: number
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          morale_change: number
          triggered_by: string
        }
        Insert: {
          band_id: string
          chemistry_change?: number
          cost?: number
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          morale_change?: number
          triggered_by: string
        }
        Update: {
          band_id?: string
          chemistry_change?: number
          cost?: number
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          morale_change?: number
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_events_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          }
        ]
      }
      band_members: {
        Row: {
          chemistry: number
          band_id: string
          id: string
          joined_at: string | null
          morale: number
          role: string
          salary: number | null
          user_id: string
        }
        Insert: {
          chemistry?: number
          band_id: string
          id?: string
          joined_at?: string | null
          morale?: number
          role: string
          salary?: number | null
          user_id: string
        }
        Update: {
          chemistry?: number
          band_id?: string
          id?: string
          joined_at?: string | null
          morale?: number
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
      band_relations: {
        Row: {
          avatar_icon: string | null
          band_id: string
          chemistry: number
          created_at: string
          energy: number
          id: string
          instrument: string
          issues: string[]
          loyalty: number
          skill_rating: number
          member_id: string
          member_name: string
          mood: string
          morale: number
          personality: string | null
          strengths: string[]
          updated_at: string
        }
        Insert: {
          avatar_icon?: string | null
          band_id: string
          chemistry?: number
          created_at?: string
          energy?: number
          id?: string
          instrument: string
          issues?: string[]
          loyalty?: number
          skill_rating?: number
          member_id: string
          member_name: string
          mood?: string
          morale?: number
          personality?: string | null
          strengths?: string[]
          updated_at?: string
        }
        Update: {
          avatar_icon?: string | null
          band_id?: string
          chemistry?: number
          created_at?: string
          energy?: number
          id?: string
          instrument?: string
          issues?: string[]
          loyalty?: number
          skill_rating?: number
          member_id?: string
          member_name?: string
          mood?: string
          morale?: number
          personality?: string | null
          strengths?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_relations_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          }
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
          logo_url: string | null
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
          logo_url?: string | null
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
          logo_url?: string | null
          name?: string
          popularity?: number | null
          updated_at?: string | null
          weekly_fans?: number | null
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
          cultural_events: string[]
          description: string | null
          districts: Json
          dominant_genre: string | null
          famous_resident: string | null
          id: string
          local_bonus: number | null
          music_scene: number | null
          name: string
          population: number | null
          travel_hub: string | null
          travel_nodes: Json
          unlocked: boolean | null
          venues: number | null
        }
        Insert: {
          bonuses?: string | null
          busking_value?: number
          cost_of_living?: number | null
          country: string
          created_at?: string | null
          cultural_events?: string[]
          description?: string | null
          districts?: Json
          dominant_genre?: string | null
          famous_resident?: string | null
          id?: string
          local_bonus?: number | null
          music_scene?: number | null
          name: string
          population?: number | null
          travel_hub?: string | null
          travel_nodes?: Json
          unlocked?: boolean | null
          venues?: number | null
        }
        Update: {
          bonuses?: string | null
          busking_value?: number
          cost_of_living?: number | null
          country?: string
          created_at?: string | null
          cultural_events?: string[]
          description?: string | null
          districts?: Json
          dominant_genre?: string | null
          famous_resident?: string | null
          id?: string
          local_bonus?: number | null
          music_scene?: number | null
          name?: string
          population?: number | null
          travel_hub?: string | null
          travel_nodes?: Json
          unlocked?: boolean | null
          venues?: number | null
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
      city_metadata: {
        Row: {
          aliases: string[] | null
          city_id: string
          created_at: string | null
          famous_resident: string | null
          id: string
          intra_locations: Json | null
          metro_area: string | null
          signature_sound: string | null
          summary: string | null
          timezone: string | null
          travel_modes: Json | null
          updated_at: string | null
        }
        Insert: {
          aliases?: string[] | null
          city_id: string
          created_at?: string | null
          famous_resident?: string | null
          id?: string
          intra_locations?: Json | null
          metro_area?: string | null
          signature_sound?: string | null
          summary?: string | null
          timezone?: string | null
          travel_modes?: Json | null
          updated_at?: string | null
        }
        Update: {
          aliases?: string[] | null
          city_id?: string
          created_at?: string | null
          famous_resident?: string | null
          id?: string
          intra_locations?: Json | null
          metro_area?: string | null
          signature_sound?: string | null
          summary?: string | null
          timezone?: string | null
          travel_modes?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_metadata_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          }
        ]
      }
      cities: {
        Row: {
          cost_of_living: number | null
          country: string | null
          created_at: string | null
          cultural_events: string[] | null
          dominant_genre: string | null
          id: string
          local_bonus: number | null
          music_scene: number | null
          name: string
          population: number | null
          updated_at: string | null
          venues: number | null
        }
        Insert: {
          cost_of_living?: number | null
          country?: string | null
          created_at?: string | null
          cultural_events?: string[] | null
          dominant_genre?: string | null
          id?: string
          local_bonus?: number | null
          music_scene?: number | null
          name: string
          population?: number | null
          updated_at?: string | null
          venues?: number | null
        }
        Update: {
          cost_of_living?: number | null
          country?: string | null
          created_at?: string | null
          cultural_events?: string[] | null
          dominant_genre?: string | null
          id?: string
          local_bonus?: number | null
          music_scene?: number | null
          name?: string
          population?: number | null
          updated_at?: string | null
          venues?: number | null
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
          stock: number
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
          stock?: number
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
          stock?: number
        }
        Relationships: []
      }
      equipment_upgrades: {
        Row: {
          cost: number
          created_at: string | null
          description: string | null
          equipment_id: string
          id: string
          stat_boosts: Json
          tier: number
        }
        Insert: {
          cost: number
          created_at?: string | null
          description?: string | null
          equipment_id: string
          id?: string
          stat_boosts?: Json
          tier: number
        }
        Update: {
          cost?: number
          created_at?: string | null
          description?: string | null
          equipment_id?: string
          id?: string
          stat_boosts?: Json
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_upgrades_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          }
        ]
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
      feature_flags: {
        Row: {
          id: string
          name: string
          description: string | null
          enabled: boolean
          category: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          enabled?: boolean
          category?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          enabled?: boolean
          category?: string | null
          created_at?: string | null
          updated_at?: string | null
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
          digital_sales: number
          id: string
          physical_sales: number
          rank: number
          song_id: string
          total_streams: number
          total_sales: number
          trend: string
          trend_change: number
          updated_at: string
          weeks_on_chart: number
        }
        Insert: {
          chart_date: string
          chart_type: string
          created_at?: string
          digital_sales?: number
          id?: string
          physical_sales?: number
          rank: number
          song_id: string
          total_streams?: number
          total_sales?: number
          trend?: string
          trend_change?: number
          updated_at?: string
          weeks_on_chart?: number
        }
        Update: {
          chart_date?: string
          chart_type?: string
          created_at?: string
          digital_sales?: number
          id?: string
          physical_sales?: number
          rank?: number
          song_id?: string
          total_streams?: number
          total_sales?: number
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
          audience_reaction: Json | null
          earnings: number | null
          failure_reason: string | null
          fame_change: number | null
          gig_id: string | null
          id: string
          penalty_amount: number | null
          penalty_applied: boolean | null
          performance_score: number | null
          performed_at: string
          status: string | null
          user_id: string
        }
        Insert: {
          audience_reaction?: Json | null
          earnings?: number | null
          failure_reason?: string | null
          fame_change?: number | null
          gig_id?: string | null
          id?: string
          penalty_amount?: number | null
          penalty_applied?: boolean | null
          performance_score?: number | null
          performed_at?: string
          status?: string | null
          user_id: string
        }
        Update: {
          audience_reaction?: Json | null
          earnings?: number | null
          failure_reason?: string | null
          fame_change?: number | null
          gig_id?: string | null
          id?: string
          penalty_amount?: number | null
          penalty_applied?: boolean | null
          performance_score?: number | null
          performed_at?: string
          status?: string | null
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
          show_type: Database["public"]["Enums"]["show_type"]
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
          show_type?: Database["public"]["Enums"]["show_type"]
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
          show_type?: Database["public"]["Enums"]["show_type"]
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
          upgrade_level: number
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
          upgrade_level?: number
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
          upgrade_level?: number
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
          created_at: string | null
          creativity: number
          drums: number
          guitar: number
          id: string
          marketing: number
          performance: number
          songwriting: number
          technical: number
          updated_at: string | null
          user_id: string
          vocals: number
        }
        Insert: {
          bass?: number
          business?: number
          composition?: number
          created_at?: string | null
          creativity?: number
          drums?: number
          guitar?: number
          id?: string
          marketing?: number
          performance?: number
          songwriting?: number
          technical?: number
          updated_at?: string | null
          user_id: string
          vocals?: number
        }
        Update: {
          bass?: number
          business?: number
          composition?: number
          created_at?: string | null
          creativity?: number
          drums?: number
          guitar?: number
          id?: string
          marketing?: number
          performance?: number
          songwriting?: number
          technical?: number
          updated_at?: string | null
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
          current_city_id: string | null
          current_location: string
          gender: Database["public"]["Enums"]["profile_gender"]
          city_of_birth: string | null
          age: number
          cash: number | null
          current_activity: string | null
          current_city_id: string | null
          created_at: string | null
          display_name: string | null
          engagement_rate: number | null
          experience: number | null
          fame: number | null
          fans: number | null
          health: number | null
          followers: number | null
          id: string
          is_active: boolean
          level: number | null
          primary_instrument: string | null
          travel_eta: string | null
          travel_mode: string | null
          travel_started_at: string | null
          updated_at: string | null
          unlock_cost: number
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          current_city_id?: string | null
          current_location?: string
          gender?: Database["public"]["Enums"]["profile_gender"]
          city_of_birth?: string | null
          age?: number
          cash?: number | null
          current_activity?: string | null
          current_city_id?: string | null
          created_at?: string | null
          display_name?: string | null
          engagement_rate?: number | null
          experience?: number | null
          fame?: number | null
          fans?: number | null
          health?: number | null
          followers?: number | null
          id?: string
          is_active?: boolean
          level?: number | null
          primary_instrument?: string | null
          travel_eta?: string | null
          travel_mode?: string | null
          travel_started_at?: string | null
          updated_at?: string | null
          unlock_cost?: number
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          current_city_id?: string | null
          current_location?: string
          gender?: Database["public"]["Enums"]["profile_gender"]
          city_of_birth?: string | null
          age?: number
          cash?: number | null
          current_activity?: string | null
          current_city_id?: string | null
          created_at?: string | null
          display_name?: string | null
          engagement_rate?: number | null
          experience?: number | null
          fame?: number | null
          fans?: number | null
          health?: number | null
          followers?: number | null
          id?: string
          is_active?: boolean
          level?: number | null
          primary_instrument?: string | null
          travel_eta?: string | null
          travel_mode?: string | null
          travel_started_at?: string | null
          updated_at?: string | null
          unlock_cost?: number
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_city_id_fkey"
            columns: ["current_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_city_of_birth_fkey"
            columns: ["city_of_birth"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          }
        ]
      }
      seasons: {
        Row: {
          id: string
          name: string
          start_date: string
          end_date: string
          multipliers: Json | null
          active: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          start_date: string
          end_date: string
          multipliers?: Json | null
          active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          start_date?: string
          end_date?: string
          multipliers?: Json | null
          active?: boolean
          created_at?: string | null
          updated_at?: string | null
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
          media_path: string | null
          media_type: string | null
          media_url: string | null
          scheduled_for: string | null
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
          media_path?: string | null
          media_type?: string | null
          media_url?: string | null
          scheduled_for?: string | null
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
          media_path?: string | null
          media_type?: string | null
          media_url?: string | null
          scheduled_for?: string | null
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
          audio_layers: Json | null
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
          audio_layers?: Json | null
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
          audio_layers?: Json | null
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
      recording_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          engineer_id: string | null
          engineer_name: string | null
          id: string
          notes: string | null
          quality_gain: number
          scheduled_start: string | null
          song_id: string
          stage: string
          started_at: string | null
          status: string
          total_cost: number
          total_takes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          engineer_id?: string | null
          engineer_name?: string | null
          id?: string
          notes?: string | null
          quality_gain?: number
          scheduled_start?: string | null
          song_id: string
          stage: string
          started_at?: string | null
          status?: string
          total_cost?: number
          total_takes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          engineer_id?: string | null
          engineer_name?: string | null
          id?: string
          notes?: string | null
          quality_gain?: number
          scheduled_start?: string | null
          song_id?: string
          stage?: string
          started_at?: string | null
          status?: string
          total_cost?: number
          total_takes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_sessions_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recording_sessions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          }
        ]
      }
      production_tracks: {
        Row: {
          cost: number
          created_at: string
          duration_seconds: number
          id: string
          name: string
          notes: string | null
          public_url: string
          quality_rating: number | null
          session_id: string
          song_id: string
          stage: string
          storage_path: string
          take_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          name: string
          notes?: string | null
          public_url: string
          quality_rating?: number | null
          session_id: string
          song_id: string
          stage: string
          storage_path: string
          take_number?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          name?: string
          notes?: string | null
          public_url?: string
          quality_rating?: number | null
          session_id?: string
          song_id?: string
          stage?: string
          storage_path?: string
          take_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_tracks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recording_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_tracks_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_tracks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          }
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
          show_type: Database["public"]["Enums"]["show_type"]
          status: string | null
          ticket_price: number | null
          tickets_sold: number | null
          tour_id: string
          travel_cost: number | null
          lodging_cost: number | null
          misc_cost: number | null
          travel_time: number | null
          rest_days: number | null
          travel_mode: string | null
          travel_comfort: number | null
          venue_id: string
        }
        Insert: {
          date: string
          id?: string
          revenue?: number | null
          show_type?: Database["public"]["Enums"]["show_type"]
          status?: string | null
          ticket_price?: number | null
          tickets_sold?: number | null
          tour_id: string
          travel_cost?: number | null
          lodging_cost?: number | null
          misc_cost?: number | null
          travel_time?: number | null
          rest_days?: number | null
          travel_mode?: string | null
          travel_comfort?: number | null
          venue_id: string
        }
        Update: {
          date?: string
          id?: string
          revenue?: number | null
          show_type?: Database["public"]["Enums"]["show_type"]
          status?: string | null
          ticket_price?: number | null
          tickets_sold?: number | null
          tour_id?: string
          travel_cost?: number | null
          lodging_cost?: number | null
          misc_cost?: number | null
          travel_time?: number | null
          rest_days?: number | null
          travel_mode?: string | null
          travel_comfort?: number | null
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
      user_actions: {
        Row: {
          id: string
          user_id: string | null
          username: string | null
          action: string
          details: string | null
          timestamp: string | null
          created_at: string | null
          severity: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          username?: string | null
          action: string
          details?: string | null
          timestamp?: string | null
          created_at?: string | null
          severity?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          username?: string | null
          action?: string
          details?: string | null
          timestamp?: string | null
          created_at?: string | null
          severity?: string | null
        }
        Relationships: []
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
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          gender: Database["public"]["Enums"]["profile_gender"] | null
          city_of_birth: string | null
          age: number | null
          id: string
          user_id: string
          username: string
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
      schedule_events: {
        Row: {
          created_at: string
          date: string
          description: string | null
          duration_minutes: number
          energy_cost: number | null
          id: string
          last_notified: string | null
          location: string
          recurrence_rule: string | null
          reminder_minutes: number | null
          status: string
          time: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          duration_minutes?: number
          energy_cost?: number | null
          id?: string
          last_notified?: string | null
          location: string
          recurrence_rule?: string | null
          reminder_minutes?: number | null
          status?: string
          time: string
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          duration_minutes?: number
          energy_cost?: number | null
          id?: string
          last_notified?: string | null
          location?: string
          recurrence_rule?: string | null
          reminder_minutes?: number | null
          status?: string
          time?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
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
      purchase_equipment_item: {
        Args: {
          p_equipment_id: string
        }
        Returns: {
          player_equipment_id: string
          remaining_stock: number
          new_cash: number
        }[]
      }
      restock_equipment_items: {
        Args: {
          restock_amount?: number | null
        }
        Returns: number
      }
      reset_player_character: {
        Args: Record<PropertyKey, never>
        Returns: {
          profile: Database["public"]["Tables"]["profiles"]["Row"]
          skills: Database["public"]["Tables"]["player_skills"]["Row"]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      chat_participant_status: "online" | "typing" | "muted"
      profile_gender:
        | "female"
        | "male"
        | "non_binary"
        | "other"
        | "prefer_not_to_say"
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
