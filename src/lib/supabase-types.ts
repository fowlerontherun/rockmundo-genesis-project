// Simplified types that work around the corrupted generated types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          level: number
          experience: number
          experience_at_last_weekly_bonus: number
          cash: number
          fame: number
          fans: number
          last_weekly_bonus_at: string | null
          weekly_bonus_streak: number
          weekly_bonus_metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          level?: number
          experience?: number
          experience_at_last_weekly_bonus?: number
          cash?: number
          fame?: number
          fans?: number
          last_weekly_bonus_at?: string | null
          weekly_bonus_streak?: number
          weekly_bonus_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          level?: number
          experience?: number
          experience_at_last_weekly_bonus?: number
          cash?: number
          fame?: number
          fans?: number
          last_weekly_bonus_at?: string | null
          weekly_bonus_streak?: number
          weekly_bonus_metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      experience_ledger: {
        Row: {
          id: string
          profile_id: string
          user_id: string
          amount: number
          reason: string
          metadata: Json
          recorded_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          user_id: string
          amount: number
          reason: string
          metadata?: Json
          recorded_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          user_id?: string
          amount?: number
          reason?: string
          metadata?: Json
          recorded_at?: string
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
          city: string | null
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
          city?: string | null
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
          city?: string | null
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
      profile_action_xp_events: {
        Row: {
          id: string
          profile_id: string
          action_type: string
          xp_amount: number
          occurred_at: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          action_type: string
          xp_amount: number
          occurred_at?: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          action_type?: string
          xp_amount?: number
          occurred_at?: string
          metadata?: Json
          created_at?: string
        }
      }
      profile_weekly_bonus_claims: {
        Row: {
          id: string
          profile_id: string
          week_start: string
          bonus_type: string
          xp_awarded: number
          metadata: Json
          claimed_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          week_start: string
          bonus_type: string
          xp_awarded?: number
          metadata?: Json
          claimed_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          week_start?: string
          bonus_type?: string
          xp_awarded?: number
          metadata?: Json
          claimed_at?: string
        }
      }
      profile_attribute_transactions: {
        Row: {
          id: string
          profile_id: string
          transaction_type: string
          attribute_key: string | null
          points_delta: number
          attribute_value_delta: number
          xp_delta: number
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          transaction_type: string
          attribute_key?: string | null
          points_delta: number
          attribute_value_delta?: number
          xp_delta?: number
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          transaction_type?: string
          attribute_key?: string | null
          points_delta?: number
          attribute_value_delta?: number
          xp_delta?: number
          metadata?: Json
          created_at?: string
        }
      }
      profile_respec_events: {
        Row: {
          id: string
          profile_id: string
          attribute_points_refunded: number
          skill_points_refunded: number
          xp_refunded: number
          reset_reason: string | null
          metadata: Json
          initiated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          attribute_points_refunded?: number
          skill_points_refunded?: number
          xp_refunded?: number
          reset_reason?: string | null
          metadata?: Json
          initiated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          attribute_points_refunded?: number
          skill_points_refunded?: number
          xp_refunded?: number
          reset_reason?: string | null
          metadata?: Json
          initiated_by?: string | null
          created_at?: string
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
    Views: {
      profile_action_xp_daily_totals: {
        Row: {
          profile_id: string
          action_type: string
          activity_date: string
          total_xp: number | null
          event_count: number
        }
      }
      profile_action_xp_weekly_totals: {
        Row: {
          profile_id: string
          action_type: string
          week_start: string
          total_xp: number | null
          event_count: number
        }
      }
    }
    Functions: {
      get_profile_action_xp_totals: {
        Args: {
          p_profile_id: string
          p_action: string
          p_reference?: string
        }
        Returns: {
          day_xp: number
          day_events: number
          week_xp: number
          week_events: number
        }[]
      }
      has_claimed_weekly_bonus: {
        Args: {
          p_profile_id: string
          p_week_start: string
          p_bonus_type: string
        }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}