// Simplified types that work around the corrupted generated types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          attribute_points_available: number
          id: string
          user_id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          level: number
          experience: number
          experience_at_last_conversion: number
          cash: number
          fame: number
          fans: number
          skill_points_available: number
          last_point_conversion_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          attribute_points_available?: number
          id?: string
          user_id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          level?: number
          experience?: number
          experience_at_last_conversion?: number
          cash?: number
          fame?: number
          fans?: number
          skill_points_available?: number
          last_point_conversion_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          attribute_points_available?: number
          id?: string
          user_id?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          level?: number
          experience?: number
          experience_at_last_conversion?: number
          cash?: number
          fame?: number
          fans?: number
          skill_points_available?: number
          last_point_conversion_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bands: {
        Row: {
          id: string
          name: string
          genre: string | null
          description: string | null
          leader_id: string
          popularity: number
          weekly_fans: number
          max_members: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          genre?: string | null
          description?: string | null
          leader_id: string
          popularity?: number
          weekly_fans?: number
          max_members?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          genre?: string | null
          description?: string | null
          leader_id?: string
          popularity?: number
          weekly_fans?: number
          max_members?: number
          created_at?: string
          updated_at?: string
        }
      }
      band_members: {
        Row: {
          id: string
          band_id: string
          user_id: string
          role: string
          joined_at: string
          salary: number
        }
        Insert: {
          id?: string
          band_id: string
          user_id: string
          role: string
          joined_at?: string
          salary?: number
        }
        Update: {
          id?: string
          band_id?: string
          user_id?: string
          role?: string
          joined_at?: string
          salary?: number
        }
      }
      venues: {
        Row: {
          id: string
          name: string
          location: string | null
          capacity: number | null
          city_id: string | null
          base_payment: number
          venue_type: string | null
          prestige_level: number
          requirements: Json
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          location?: string | null
          capacity?: number | null
          city_id?: string | null
          base_payment?: number
          venue_type?: string | null
          prestige_level?: number
          requirements?: Json
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          location?: string | null
          capacity?: number | null
          city_id?: string | null
          base_payment?: number
          venue_type?: string | null
          prestige_level?: number
          requirements?: Json
          created_at?: string
        }
      }
      gigs: {
        Row: {
          id: string
          band_id: string
          venue_id: string
          scheduled_date: string
          status: string
          payment: number | null
          attendance: number
          fan_gain: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          band_id: string
          venue_id: string
          scheduled_date: string
          status?: string
          payment?: number | null
          attendance?: number
          fan_gain?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          band_id?: string
          venue_id?: string
          scheduled_date?: string
          status?: string
          payment?: number | null
          attendance?: number
          fan_gain?: number
          created_at?: string
          updated_at?: string
        }
      }
      player_attributes: {
        Row: {
          id: string
          profile_id: string
          created_at: string
          updated_at: string
          attribute_points: number
          attribute_points_spent: number
          physical_endurance: number
          mental_focus: number
          stage_presence: number
          crowd_engagement: number
          social_reach: number
          creativity: number
          technical: number
          business: number
          marketing: number
          composition: number
          musical_ability: number
          vocal_talent: number
          rhythm_sense: number
          creative_insight: number
          technical_mastery: number
          business_acumen: number
          marketing_savvy: number
          user_id: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          created_at?: string
          updated_at?: string
          attribute_points?: number
          attribute_points_spent?: number
          physical_endurance?: number
          mental_focus?: number
          stage_presence?: number
          crowd_engagement?: number
          social_reach?: number
          creativity?: number
          technical?: number
          business?: number
          marketing?: number
          composition?: number
          musical_ability?: number
          vocal_talent?: number
          rhythm_sense?: number
          creative_insight?: number
          technical_mastery?: number
          business_acumen?: number
          marketing_savvy?: number
          user_id?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          created_at?: string
          updated_at?: string
          attribute_points?: number
          attribute_points_spent?: number
          physical_endurance?: number
          mental_focus?: number
          stage_presence?: number
          crowd_engagement?: number
          social_reach?: number
          creativity?: number
          technical?: number
          business?: number
          marketing?: number
          composition?: number
          musical_ability?: number
          vocal_talent?: number
          rhythm_sense?: number
          creative_insight?: number
          technical_mastery?: number
          business_acumen?: number
          marketing_savvy?: number
          user_id?: string | null
        }
      }
      player_daily_cats: {
        Row: {
          id: string
          profile_id: string
          activity_date: string
          category: string
          xp_earned: number
          xp_spent: number
          activity_count: number
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          activity_date: string
          category: string
          xp_earned?: number
          xp_spent?: number
          activity_count?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          activity_date?: string
          category?: string
          xp_earned?: number
          xp_spent?: number
          activity_count?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      player_weekly_activity: {
        Row: {
          id: string
          profile_id: string
          week_start: string
          xp_earned: number
          xp_spent: number
          sessions_completed: number
          quests_completed: number
          rehearsals_logged: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          week_start: string
          xp_earned?: number
          xp_spent?: number
          sessions_completed?: number
          quests_completed?: number
          rehearsals_logged?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          week_start?: string
          xp_earned?: number
          xp_spent?: number
          sessions_completed?: number
          quests_completed?: number
          rehearsals_logged?: number
          created_at?: string
          updated_at?: string
        }
      }
      player_xp_wallet: {
        Row: {
          profile_id: string
          xp_balance: number
          lifetime_xp: number
          xp_spent: number
          attribute_points_earned: number
          skill_points_earned: number
          last_recalculated: string
        }
        Insert: {
          profile_id: string
          xp_balance?: number
          lifetime_xp?: number
          xp_spent?: number
          attribute_points_earned?: number
          skill_points_earned?: number
          last_recalculated?: string
        }
        Update: {
          profile_id?: string
          xp_balance?: number
          lifetime_xp?: number
          xp_spent?: number
          attribute_points_earned?: number
          skill_points_earned?: number
          last_recalculated?: string
        }
      }
      attribute_spend: {
        Row: {
          id: string
          profile_id: string
          attribute_key: string
          points_spent: number
          xp_cost: number
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          attribute_key: string
          points_spent: number
          xp_cost: number
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          attribute_key?: string
          points_spent?: number
          xp_cost?: number
          metadata?: Json | null
          created_at?: string
        }
      }
      xp_ledger: {
        Row: {
          id: string
          profile_id: string
          event_type: string
          xp_delta: number
          balance_after: number
          attribute_points_delta: number
          skill_points_delta: number
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          event_type: string
          xp_delta: number
          balance_after: number
          attribute_points_delta?: number
          skill_points_delta?: number
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          event_type?: string
          xp_delta?: number
          balance_after?: number
          attribute_points_delta?: number
          skill_points_delta?: number
          metadata?: Json | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}