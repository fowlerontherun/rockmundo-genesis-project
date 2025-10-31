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
      admin_song_gifts: {
        Row: {
          created_at: string | null
          gift_message: string | null
          gifted_by_admin_id: string
          gifted_to_band_id: string | null
          gifted_to_user_id: string | null
          id: string
          song_id: string | null
        }
        Insert: {
          created_at?: string | null
          gift_message?: string | null
          gifted_by_admin_id: string
          gifted_to_band_id?: string | null
          gifted_to_user_id?: string | null
          id?: string
          song_id?: string | null
        }
        Update: {
          created_at?: string | null
          gift_message?: string | null
          gifted_by_admin_id?: string
          gifted_to_band_id?: string | null
          gifted_to_user_id?: string | null
          id?: string
          song_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_song_gifts_gifted_to_band_id_fkey"
            columns: ["gifted_to_band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_song_gifts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "admin_song_gifts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      band_activity_lockouts: {
        Row: {
          activity_type: string
          band_id: string
          created_at: string | null
          id: string
          locked_until: string
          reason: string | null
        }
        Insert: {
          activity_type: string
          band_id: string
          created_at?: string | null
          id?: string
          locked_until: string
          reason?: string | null
        }
        Update: {
          activity_type?: string
          band_id?: string
          created_at?: string | null
          id?: string
          locked_until?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_activity_lockouts_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_chat_messages: {
        Row: {
          band_id: string
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          band_id: string
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          band_id?: string
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_chat_messages_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_chemistry_events: {
        Row: {
          band_id: string
          chemistry_change: number
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
        }
        Insert: {
          band_id: string
          chemistry_change: number
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          band_id?: string
          chemistry_change?: number
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_chemistry_events_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_crew_members: {
        Row: {
          band_id: string
          created_at: string
          crew_type: string
          experience_years: number
          hire_date: string
          id: string
          name: string
          notes: string | null
          salary_per_gig: number
          skill_level: number
          updated_at: string
        }
        Insert: {
          band_id: string
          created_at?: string
          crew_type: string
          experience_years?: number
          hire_date?: string
          id?: string
          name: string
          notes?: string | null
          salary_per_gig?: number
          skill_level?: number
          updated_at?: string
        }
        Update: {
          band_id?: string
          created_at?: string
          crew_type?: string
          experience_years?: number
          hire_date?: string
          id?: string
          name?: string
          notes?: string | null
          salary_per_gig?: number
          skill_level?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_crew_members_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_earnings: {
        Row: {
          amount: number
          band_id: string
          created_at: string
          description: string | null
          earned_by_user_id: string | null
          id: string
          metadata: Json | null
          source: string
        }
        Insert: {
          amount: number
          band_id: string
          created_at?: string
          description?: string | null
          earned_by_user_id?: string | null
          id?: string
          metadata?: Json | null
          source: string
        }
        Update: {
          amount?: number
          band_id?: string
          created_at?: string
          description?: string | null
          earned_by_user_id?: string | null
          id?: string
          metadata?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_earnings_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_fame_events: {
        Row: {
          band_id: string
          created_at: string | null
          event_data: Json | null
          event_type: string
          fame_gained: number
          id: string
        }
        Insert: {
          band_id: string
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          fame_gained: number
          id?: string
        }
        Update: {
          band_id?: string
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          fame_gained?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_fame_events_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_history: {
        Row: {
          band_id: string
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          triggered_by: string | null
        }
        Insert: {
          band_id: string
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          triggered_by?: string | null
        }
        Update: {
          band_id?: string
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_history_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_invitations: {
        Row: {
          band_id: string
          created_at: string
          id: string
          instrument_role: string
          invited_user_id: string
          inviter_user_id: string
          message: string | null
          responded_at: string | null
          status: string
          vocal_role: string | null
        }
        Insert: {
          band_id: string
          created_at?: string
          id?: string
          instrument_role?: string
          invited_user_id: string
          inviter_user_id: string
          message?: string | null
          responded_at?: string | null
          status?: string
          vocal_role?: string | null
        }
        Update: {
          band_id?: string
          created_at?: string
          id?: string
          instrument_role?: string
          invited_user_id?: string
          inviter_user_id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          vocal_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_invitations_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_leadership_votes: {
        Row: {
          band_id: string
          candidate_user_id: string
          created_at: string | null
          id: string
          vote_date: string
          vote_round: number
          voter_user_id: string
        }
        Insert: {
          band_id: string
          candidate_user_id: string
          created_at?: string | null
          id?: string
          vote_date?: string
          vote_round: number
          voter_user_id: string
        }
        Update: {
          band_id?: string
          candidate_user_id?: string
          created_at?: string | null
          id?: string
          vote_date?: string
          vote_round?: number
          voter_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_leadership_votes_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_members: {
        Row: {
          band_id: string
          can_be_leader: boolean | null
          chemistry_contribution: number | null
          id: string
          instrument_role: string
          is_touring_member: boolean | null
          joined_at: string | null
          leadership_votes: number | null
          member_status: string | null
          role: string
          salary: number | null
          skill_contribution: number | null
          touring_member_cost: number | null
          touring_member_tier: number | null
          user_id: string | null
          vocal_role: string | null
        }
        Insert: {
          band_id: string
          can_be_leader?: boolean | null
          chemistry_contribution?: number | null
          id?: string
          instrument_role?: string
          is_touring_member?: boolean | null
          joined_at?: string | null
          leadership_votes?: number | null
          member_status?: string | null
          role: string
          salary?: number | null
          skill_contribution?: number | null
          touring_member_cost?: number | null
          touring_member_tier?: number | null
          user_id?: string | null
          vocal_role?: string | null
        }
        Update: {
          band_id?: string
          can_be_leader?: boolean | null
          chemistry_contribution?: number | null
          id?: string
          instrument_role?: string
          is_touring_member?: boolean | null
          joined_at?: string | null
          leadership_votes?: number | null
          member_status?: string | null
          role?: string
          salary?: number | null
          skill_contribution?: number | null
          touring_member_cost?: number | null
          touring_member_tier?: number | null
          user_id?: string | null
          vocal_role?: string | null
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
      band_rehearsals: {
        Row: {
          band_id: string
          chemistry_gain: number | null
          completed_at: string | null
          created_at: string | null
          duration_hours: number
          familiarity_gained: number | null
          id: string
          rehearsal_room_id: string
          scheduled_end: string
          scheduled_start: string
          selected_song_id: string | null
          status: string
          total_cost: number
          xp_earned: number | null
        }
        Insert: {
          band_id: string
          chemistry_gain?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_hours: number
          familiarity_gained?: number | null
          id?: string
          rehearsal_room_id: string
          scheduled_end: string
          scheduled_start?: string
          selected_song_id?: string | null
          status?: string
          total_cost: number
          xp_earned?: number | null
        }
        Update: {
          band_id?: string
          chemistry_gain?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_hours?: number
          familiarity_gained?: number | null
          id?: string
          rehearsal_room_id?: string
          scheduled_end?: string
          scheduled_start?: string
          selected_song_id?: string | null
          status?: string
          total_cost?: number
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "band_rehearsals_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_rehearsals_rehearsal_room_id_fkey"
            columns: ["rehearsal_room_id"]
            isOneToOne: false
            referencedRelation: "rehearsal_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_rehearsals_selected_song_id_fkey"
            columns: ["selected_song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "band_rehearsals_selected_song_id_fkey"
            columns: ["selected_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      band_song_familiarity: {
        Row: {
          band_id: string
          created_at: string | null
          familiarity_minutes: number
          familiarity_percentage: number | null
          id: string
          last_rehearsed_at: string | null
          rehearsal_stage: string | null
          song_id: string
          updated_at: string | null
        }
        Insert: {
          band_id: string
          created_at?: string | null
          familiarity_minutes?: number
          familiarity_percentage?: number | null
          id?: string
          last_rehearsed_at?: string | null
          rehearsal_stage?: string | null
          song_id: string
          updated_at?: string | null
        }
        Update: {
          band_id?: string
          created_at?: string | null
          familiarity_minutes?: number
          familiarity_percentage?: number | null
          id?: string
          last_rehearsed_at?: string | null
          rehearsal_stage?: string | null
          song_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_song_familiarity_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_song_familiarity_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "band_song_familiarity_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      band_stage_equipment: {
        Row: {
          band_id: string
          condition: string
          created_at: string
          equipment_name: string
          equipment_type: string
          id: string
          notes: string | null
          power_draw: number | null
          purchase_cost: number | null
          purchase_date: string | null
          quality_rating: number
          updated_at: string
        }
        Insert: {
          band_id: string
          condition?: string
          created_at?: string
          equipment_name: string
          equipment_type: string
          id?: string
          notes?: string | null
          power_draw?: number | null
          purchase_cost?: number | null
          purchase_date?: string | null
          quality_rating?: number
          updated_at?: string
        }
        Update: {
          band_id?: string
          condition?: string
          created_at?: string
          equipment_name?: string
          equipment_type?: string
          id?: string
          notes?: string | null
          power_draw?: number | null
          purchase_cost?: number | null
          purchase_date?: string | null
          quality_rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_stage_equipment_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      bands: {
        Row: {
          artist_name: string | null
          band_balance: number | null
          chemistry_level: number | null
          cohesion_score: number | null
          collective_fame_earned: number | null
          created_at: string | null
          days_together: number | null
          description: string | null
          fame: number | null
          fame_multiplier: number | null
          genre: string | null
          hiatus_ends_at: string | null
          hiatus_notification_sent: boolean | null
          hiatus_reason: string | null
          hiatus_started_at: string | null
          hidden_skill_rating: number | null
          id: string
          is_solo_artist: boolean | null
          jam_count: number | null
          last_chemistry_update: string | null
          last_fame_calculation: string | null
          leader_id: string
          leadership_votes_history: Json | null
          logo_url: string | null
          max_members: number | null
          name: string
          next_leadership_vote: string | null
          performance_count: number | null
          popularity: number | null
          status: Database["public"]["Enums"]["band_status"]
          updated_at: string | null
          weekly_fans: number | null
        }
        Insert: {
          artist_name?: string | null
          band_balance?: number | null
          chemistry_level?: number | null
          cohesion_score?: number | null
          collective_fame_earned?: number | null
          created_at?: string | null
          days_together?: number | null
          description?: string | null
          fame?: number | null
          fame_multiplier?: number | null
          genre?: string | null
          hiatus_ends_at?: string | null
          hiatus_notification_sent?: boolean | null
          hiatus_reason?: string | null
          hiatus_started_at?: string | null
          hidden_skill_rating?: number | null
          id?: string
          is_solo_artist?: boolean | null
          jam_count?: number | null
          last_chemistry_update?: string | null
          last_fame_calculation?: string | null
          leader_id: string
          leadership_votes_history?: Json | null
          logo_url?: string | null
          max_members?: number | null
          name: string
          next_leadership_vote?: string | null
          performance_count?: number | null
          popularity?: number | null
          status?: Database["public"]["Enums"]["band_status"]
          updated_at?: string | null
          weekly_fans?: number | null
        }
        Update: {
          artist_name?: string | null
          band_balance?: number | null
          chemistry_level?: number | null
          cohesion_score?: number | null
          collective_fame_earned?: number | null
          created_at?: string | null
          days_together?: number | null
          description?: string | null
          fame?: number | null
          fame_multiplier?: number | null
          genre?: string | null
          hiatus_ends_at?: string | null
          hiatus_notification_sent?: boolean | null
          hiatus_reason?: string | null
          hiatus_started_at?: string | null
          hidden_skill_rating?: number | null
          id?: string
          is_solo_artist?: boolean | null
          jam_count?: number | null
          last_chemistry_update?: string | null
          last_fame_calculation?: string | null
          leader_id?: string
          leadership_votes_history?: Json | null
          logo_url?: string | null
          max_members?: number | null
          name?: string
          next_leadership_vote?: string | null
          performance_count?: number | null
          popularity?: number | null
          status?: Database["public"]["Enums"]["band_status"]
          updated_at?: string | null
          weekly_fans?: number | null
        }
        Relationships: []
      }
      chart_entries: {
        Row: {
          chart_date: string | null
          chart_type: string
          country: string | null
          created_at: string | null
          genre: string | null
          id: string
          plays_count: number | null
          rank: number
          sale_type: string | null
          song_id: string
          trend: string | null
          trend_change: number | null
          weeks_on_chart: number | null
        }
        Insert: {
          chart_date?: string | null
          chart_type: string
          country?: string | null
          created_at?: string | null
          genre?: string | null
          id?: string
          plays_count?: number | null
          rank: number
          sale_type?: string | null
          song_id: string
          trend?: string | null
          trend_change?: number | null
          weeks_on_chart?: number | null
        }
        Update: {
          chart_date?: string | null
          chart_type?: string
          country?: string | null
          created_at?: string | null
          genre?: string | null
          id?: string
          plays_count?: number | null
          rank?: number
          sale_type?: string | null
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
      chord_progressions: {
        Row: {
          created_at: string
          difficulty: number | null
          id: string
          name: string
          progression: string
        }
        Insert: {
          created_at?: string
          difficulty?: number | null
          id?: string
          name: string
          progression: string
        }
        Update: {
          created_at?: string
          difficulty?: number | null
          id?: string
          name?: string
          progression?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          cost_of_living: number | null
          country: string
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
          country: string
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
          country?: string
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
      city_districts: {
        Row: {
          city_id: string
          created_at: string | null
          description: string | null
          id: string
          music_scene_rating: number | null
          name: string
          rent_cost: number | null
          safety_rating: number | null
          vibe: string | null
        }
        Insert: {
          city_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          music_scene_rating?: number | null
          name: string
          rent_cost?: number | null
          safety_rating?: number | null
          vibe?: string | null
        }
        Update: {
          city_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          music_scene_rating?: number | null
          name?: string
          rent_cost?: number | null
          safety_rating?: number | null
          vibe?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_districts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      city_night_clubs: {
        Row: {
          capacity: number | null
          city_id: string
          cover_charge: number | null
          created_at: string | null
          description: string | null
          dj_slot_config: Json | null
          drink_menu: Json | null
          guest_actions: Json | null
          id: string
          metadata: Json | null
          name: string
          npc_profiles: Json | null
          quality_level: number
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          city_id: string
          cover_charge?: number | null
          created_at?: string | null
          description?: string | null
          dj_slot_config?: Json | null
          drink_menu?: Json | null
          guest_actions?: Json | null
          id?: string
          metadata?: Json | null
          name: string
          npc_profiles?: Json | null
          quality_level?: number
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          city_id?: string
          cover_charge?: number | null
          created_at?: string | null
          description?: string | null
          dj_slot_config?: Json | null
          drink_menu?: Json | null
          guest_actions?: Json | null
          id?: string
          metadata?: Json | null
          name?: string
          npc_profiles?: Json | null
          quality_level?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_night_clubs_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      city_studios: {
        Row: {
          available_slots: number | null
          city_id: string
          created_at: string | null
          district_id: string | null
          equipment_rating: number | null
          hourly_rate: number
          id: string
          name: string
          quality_rating: number | null
          specialties: string[] | null
        }
        Insert: {
          available_slots?: number | null
          city_id: string
          created_at?: string | null
          district_id?: string | null
          equipment_rating?: number | null
          hourly_rate: number
          id?: string
          name: string
          quality_rating?: number | null
          specialties?: string[] | null
        }
        Update: {
          available_slots?: number | null
          city_id?: string
          created_at?: string | null
          district_id?: string | null
          equipment_rating?: number | null
          hourly_rate?: number
          id?: string
          name?: string
          quality_rating?: number | null
          specialties?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "city_studios_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_studios_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "city_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      city_transport_routes: {
        Row: {
          base_cost: number
          comfort_rating: number | null
          created_at: string | null
          duration_hours: number
          frequency: string | null
          from_city_id: string
          id: string
          to_city_id: string
          transport_type: string
        }
        Insert: {
          base_cost: number
          comfort_rating?: number | null
          created_at?: string | null
          duration_hours: number
          frequency?: string | null
          from_city_id: string
          id?: string
          to_city_id: string
          transport_type: string
        }
        Update: {
          base_cost?: number
          comfort_rating?: number | null
          created_at?: string | null
          duration_hours?: number
          frequency?: string | null
          from_city_id?: string
          id?: string
          to_city_id?: string
          transport_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "city_transport_routes_from_city_id_fkey"
            columns: ["from_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_transport_routes_to_city_id_fkey"
            columns: ["to_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      education_mentors: {
        Row: {
          attribute_keys: Json
          base_xp: number
          bonus_description: string
          cooldown_hours: number
          cost: number
          created_at: string
          description: string
          difficulty: string
          focus_skill: string
          id: string
          is_active: boolean
          name: string
          required_skill_value: number
          skill_gain_ratio: number
          specialty: string
          updated_at: string
        }
        Insert: {
          attribute_keys?: Json
          base_xp?: number
          bonus_description: string
          cooldown_hours?: number
          cost?: number
          created_at?: string
          description: string
          difficulty?: string
          focus_skill: string
          id?: string
          is_active?: boolean
          name: string
          required_skill_value?: number
          skill_gain_ratio?: number
          specialty: string
          updated_at?: string
        }
        Update: {
          attribute_keys?: Json
          base_xp?: number
          bonus_description?: string
          cooldown_hours?: number
          cost?: number
          created_at?: string
          description?: string
          difficulty?: string
          focus_skill?: string
          id?: string
          is_active?: boolean
          name?: string
          required_skill_value?: number
          skill_gain_ratio?: number
          specialty?: string
          updated_at?: string
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
          addressee_id: string
          created_at: string | null
          id: string
          requestor_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string | null
        }
        Insert: {
          addressee_id: string
          created_at?: string | null
          id?: string
          requestor_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string | null
        }
        Update: {
          addressee_id?: string
          created_at?: string | null
          id?: string
          requestor_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
      game_calendar_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          real_world_days_per_game_month: number
          real_world_days_per_game_year: number
          season_start_months: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          real_world_days_per_game_month?: number
          real_world_days_per_game_year?: number
          season_start_months?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          real_world_days_per_game_month?: number
          real_world_days_per_game_year?: number
          season_start_months?: Json
          updated_at?: string
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
      gig_outcomes: {
        Row: {
          actual_attendance: number
          attendance_percentage: number | null
          band_chemistry_level: number | null
          chemistry_change: number | null
          created_at: string | null
          crew_cost: number
          crew_skill_avg: number | null
          equipment_cost: number
          equipment_quality_avg: number | null
          fame_gained: number | null
          gig_id: string
          id: string
          member_skill_avg: number | null
          merch_items_sold: number | null
          merch_revenue: number
          net_profit: number
          overall_rating: number
          performance_grade: string | null
          ticket_revenue: number
          total_costs: number
          total_revenue: number
          venue_capacity: number | null
          venue_cost: number
          venue_name: string | null
        }
        Insert: {
          actual_attendance: number
          attendance_percentage?: number | null
          band_chemistry_level?: number | null
          chemistry_change?: number | null
          created_at?: string | null
          crew_cost?: number
          crew_skill_avg?: number | null
          equipment_cost?: number
          equipment_quality_avg?: number | null
          fame_gained?: number | null
          gig_id: string
          id?: string
          member_skill_avg?: number | null
          merch_items_sold?: number | null
          merch_revenue?: number
          net_profit?: number
          overall_rating: number
          performance_grade?: string | null
          ticket_revenue?: number
          total_costs?: number
          total_revenue?: number
          venue_capacity?: number | null
          venue_cost?: number
          venue_name?: string | null
        }
        Update: {
          actual_attendance?: number
          attendance_percentage?: number | null
          band_chemistry_level?: number | null
          chemistry_change?: number | null
          created_at?: string | null
          crew_cost?: number
          crew_skill_avg?: number | null
          equipment_cost?: number
          equipment_quality_avg?: number | null
          fame_gained?: number | null
          gig_id?: string
          id?: string
          member_skill_avg?: number | null
          merch_items_sold?: number | null
          merch_revenue?: number
          net_profit?: number
          overall_rating?: number
          performance_grade?: string | null
          ticket_revenue?: number
          total_costs?: number
          total_revenue?: number
          venue_capacity?: number | null
          venue_cost?: number
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gig_outcomes_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
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
      gig_song_performances: {
        Row: {
          chemistry_contrib: number | null
          completed_at: string | null
          created_at: string | null
          crew_contrib: number | null
          crowd_response: string
          equipment_contrib: number | null
          gig_outcome_id: string
          id: string
          member_skill_contrib: number | null
          performance_score: number
          position: number
          rehearsal_contrib: number | null
          song_id: string
          song_quality_contrib: number | null
          song_title: string | null
          started_at: string | null
        }
        Insert: {
          chemistry_contrib?: number | null
          completed_at?: string | null
          created_at?: string | null
          crew_contrib?: number | null
          crowd_response: string
          equipment_contrib?: number | null
          gig_outcome_id: string
          id?: string
          member_skill_contrib?: number | null
          performance_score: number
          position: number
          rehearsal_contrib?: number | null
          song_id: string
          song_quality_contrib?: number | null
          song_title?: string | null
          started_at?: string | null
        }
        Update: {
          chemistry_contrib?: number | null
          completed_at?: string | null
          created_at?: string | null
          crew_contrib?: number | null
          crowd_response?: string
          equipment_contrib?: number | null
          gig_outcome_id?: string
          id?: string
          member_skill_contrib?: number | null
          performance_score?: number
          position?: number
          rehearsal_contrib?: number | null
          song_id?: string
          song_quality_contrib?: number | null
          song_title?: string | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gig_song_performances_gig_outcome_id_fkey"
            columns: ["gig_outcome_id"]
            isOneToOne: false
            referencedRelation: "gig_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_song_performances_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "gig_song_performances_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      gigs: {
        Row: {
          attendance: number | null
          band_id: string
          completed_at: string | null
          created_at: string | null
          current_song_position: number | null
          estimated_attendance: number | null
          estimated_revenue: number | null
          fan_gain: number | null
          id: string
          payment: number | null
          pre_gig_forecast: Json | null
          scheduled_date: string
          setlist_duration_minutes: number | null
          setlist_id: string | null
          show_type: string | null
          slot_attendance_multiplier: number | null
          slot_end_time: string | null
          slot_start_time: string | null
          slot_type: string | null
          started_at: string | null
          status: string | null
          ticket_price: number | null
          time_slot: string | null
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          attendance?: number | null
          band_id: string
          completed_at?: string | null
          created_at?: string | null
          current_song_position?: number | null
          estimated_attendance?: number | null
          estimated_revenue?: number | null
          fan_gain?: number | null
          id?: string
          payment?: number | null
          pre_gig_forecast?: Json | null
          scheduled_date: string
          setlist_duration_minutes?: number | null
          setlist_id?: string | null
          show_type?: string | null
          slot_attendance_multiplier?: number | null
          slot_end_time?: string | null
          slot_start_time?: string | null
          slot_type?: string | null
          started_at?: string | null
          status?: string | null
          ticket_price?: number | null
          time_slot?: string | null
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          attendance?: number | null
          band_id?: string
          completed_at?: string | null
          created_at?: string | null
          current_song_position?: number | null
          estimated_attendance?: number | null
          estimated_revenue?: number | null
          fan_gain?: number | null
          id?: string
          payment?: number | null
          pre_gig_forecast?: Json | null
          scheduled_date?: string
          setlist_duration_minutes?: number | null
          setlist_id?: string | null
          show_type?: string | null
          slot_attendance_multiplier?: number | null
          slot_end_time?: string | null
          slot_start_time?: string | null
          slot_type?: string | null
          started_at?: string | null
          status?: string | null
          ticket_price?: number | null
          time_slot?: string | null
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
            foreignKeyName: "gigs_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
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
          created_at: string | null
          current_participants: number
          description: string | null
          genre: string
          host_id: string
          id: string
          is_private: boolean
          max_participants: number
          name: string
          participant_ids: string[] | null
          skill_requirement: number
          status: string
          tempo: number
          updated_at: string | null
        }
        Insert: {
          access_code?: string | null
          created_at?: string | null
          current_participants?: number
          description?: string | null
          genre: string
          host_id: string
          id?: string
          is_private?: boolean
          max_participants?: number
          name: string
          participant_ids?: string[] | null
          skill_requirement?: number
          status?: string
          tempo?: number
          updated_at?: string | null
        }
        Update: {
          access_code?: string | null
          created_at?: string | null
          current_participants?: number
          description?: string | null
          genre?: string
          host_id?: string
          id?: string
          is_private?: boolean
          max_participants?: number
          name?: string
          participant_ids?: string[] | null
          skill_requirement?: number
          status?: string
          tempo?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jam_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          category: string
          company_name: string
          created_at: string | null
          current_employees: number | null
          description: string | null
          end_time: string
          energy_cost_per_shift: number | null
          fame_impact_per_shift: number | null
          health_impact_per_shift: number | null
          hourly_wage: number
          id: string
          is_active: boolean | null
          max_employees: number | null
          required_level: number | null
          required_skills: Json | null
          start_time: string
          title: string
          updated_at: string | null
          work_days: Json
        }
        Insert: {
          category: string
          company_name: string
          created_at?: string | null
          current_employees?: number | null
          description?: string | null
          end_time: string
          energy_cost_per_shift?: number | null
          fame_impact_per_shift?: number | null
          health_impact_per_shift?: number | null
          hourly_wage: number
          id?: string
          is_active?: boolean | null
          max_employees?: number | null
          required_level?: number | null
          required_skills?: Json | null
          start_time: string
          title: string
          updated_at?: string | null
          work_days: Json
        }
        Update: {
          category?: string
          company_name?: string
          created_at?: string | null
          current_employees?: number | null
          description?: string | null
          end_time?: string
          energy_cost_per_shift?: number | null
          fame_impact_per_shift?: number | null
          health_impact_per_shift?: number | null
          hourly_wage?: number
          id?: string
          is_active?: boolean | null
          max_employees?: number | null
          required_level?: number | null
          required_skills?: Json | null
          start_time?: string
          title?: string
          updated_at?: string | null
          work_days?: Json
        }
        Relationships: []
      }
      manufacturing_costs: {
        Row: {
          cost_per_unit: number
          created_at: string
          format_type: string
          id: string
          max_quantity: number | null
          min_quantity: number
        }
        Insert: {
          cost_per_unit: number
          created_at?: string
          format_type: string
          id?: string
          max_quantity?: number | null
          min_quantity: number
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          format_type?: string
          id?: string
          max_quantity?: number | null
          min_quantity?: number
        }
        Relationships: []
      }
      marketplace_bids: {
        Row: {
          bid_amount: number
          bid_status: string
          bidder_user_id: string
          created_at: string
          id: string
          listing_id: string
        }
        Insert: {
          bid_amount: number
          bid_status?: string
          bidder_user_id: string
          created_at?: string
          id?: string
          listing_id: string
        }
        Update: {
          bid_amount?: number
          bid_status?: string
          bidder_user_id?: string
          created_at?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_bids_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          asking_price: number
          buyout_price: number | null
          created_at: string
          current_bid: number | null
          description: string | null
          expires_at: string | null
          id: string
          listing_status: string
          listing_type: string
          minimum_bid: number | null
          royalty_percentage: number
          seller_band_id: string | null
          seller_user_id: string
          song_id: string
          updated_at: string
        }
        Insert: {
          asking_price: number
          buyout_price?: number | null
          created_at?: string
          current_bid?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          listing_status?: string
          listing_type?: string
          minimum_bid?: number | null
          royalty_percentage?: number
          seller_band_id?: string | null
          seller_user_id: string
          song_id: string
          updated_at?: string
        }
        Update: {
          asking_price?: number
          buyout_price?: number | null
          created_at?: string
          current_bid?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          listing_status?: string
          listing_type?: string
          minimum_bid?: number | null
          royalty_percentage?: number
          seller_band_id?: string | null
          seller_user_id?: string
          song_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_seller_band_id_fkey"
            columns: ["seller_band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "marketplace_listings_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_transactions: {
        Row: {
          buyer_user_id: string
          completed_at: string | null
          created_at: string
          id: string
          listing_id: string
          royalty_percentage: number
          sale_price: number
          seller_user_id: string
          song_id: string
          transaction_status: string
        }
        Insert: {
          buyer_user_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          listing_id: string
          royalty_percentage?: number
          sale_price: number
          seller_user_id: string
          song_id: string
          transaction_status?: string
        }
        Update: {
          buyer_user_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          royalty_percentage?: number
          sale_price?: number
          seller_user_id?: string
          song_id?: string
          transaction_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "marketplace_transactions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestra_bookings: {
        Row: {
          cost: number
          created_at: string | null
          id: string
          musician_count: number
          orchestra_type: string
          quality_bonus: number
          session_id: string
        }
        Insert: {
          cost: number
          created_at?: string | null
          id?: string
          musician_count: number
          orchestra_type: string
          quality_bonus?: number
          session_id: string
        }
        Update: {
          cost?: number
          created_at?: string | null
          id?: string
          musician_count?: number
          orchestra_type?: string
          quality_bonus?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orchestra_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recording_sessions"
            referencedColumns: ["id"]
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
      player_attributes: {
        Row: {
          attribute_points: number | null
          attribute_points_spent: number | null
          charisma: number | null
          created_at: string | null
          creative_insight: number | null
          crowd_engagement: number | null
          id: string
          looks: number | null
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
          charisma?: number | null
          created_at?: string | null
          creative_insight?: number | null
          crowd_engagement?: number | null
          id?: string
          looks?: number | null
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
          charisma?: number | null
          created_at?: string | null
          creative_insight?: number | null
          crowd_engagement?: number | null
          id?: string
          looks?: number | null
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
      player_birthday_rewards: {
        Row: {
          cash_awarded: number
          claimed_at: string
          created_at: string
          game_year: number
          id: string
          profile_id: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          cash_awarded?: number
          claimed_at?: string
          created_at?: string
          game_year: number
          id?: string
          profile_id: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          cash_awarded?: number
          claimed_at?: string
          created_at?: string
          game_year?: number
          id?: string
          profile_id?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      player_book_purchases: {
        Row: {
          book_id: string
          created_at: string
          id: string
          is_read: boolean
          profile_id: string | null
          purchase_price: number
          purchased_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          profile_id?: string | null
          purchase_price: number
          purchased_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          profile_id?: string | null
          purchase_price?: number
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_book_purchases_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "skill_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_book_purchases_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_book_reading_attendance: {
        Row: {
          created_at: string
          id: string
          reading_date: string
          reading_session_id: string
          skill_xp_earned: number
          was_locked_out: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          reading_date: string
          reading_session_id: string
          skill_xp_earned: number
          was_locked_out?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          reading_date?: string
          reading_session_id?: string
          skill_xp_earned?: number
          was_locked_out?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "player_book_reading_attendance_reading_session_id_fkey"
            columns: ["reading_session_id"]
            isOneToOne: false
            referencedRelation: "player_book_reading_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_book_reading_sessions: {
        Row: {
          actual_completion_date: string | null
          auto_read: boolean | null
          book_id: string
          created_at: string
          days_read: number
          id: string
          profile_id: string | null
          purchase_id: string
          scheduled_end_date: string
          started_at: string
          status: Database["public"]["Enums"]["book_reading_status"]
          total_skill_xp_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_completion_date?: string | null
          auto_read?: boolean | null
          book_id: string
          created_at?: string
          days_read?: number
          id?: string
          profile_id?: string | null
          purchase_id: string
          scheduled_end_date: string
          started_at?: string
          status?: Database["public"]["Enums"]["book_reading_status"]
          total_skill_xp_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_completion_date?: string | null
          auto_read?: boolean | null
          book_id?: string
          created_at?: string
          days_read?: number
          id?: string
          profile_id?: string | null
          purchase_id?: string
          scheduled_end_date?: string
          started_at?: string
          status?: Database["public"]["Enums"]["book_reading_status"]
          total_skill_xp_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_book_reading_sessions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "skill_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_book_reading_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_book_reading_sessions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "player_book_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      player_daily_cats: {
        Row: {
          activity_count: number | null
          activity_date: string
          category: string
          created_at: string | null
          id: string
          metadata: Json | null
          profile_id: string
          updated_at: string | null
          xp_earned: number | null
          xp_spent: number | null
        }
        Insert: {
          activity_count?: number | null
          activity_date: string
          category: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          profile_id: string
          updated_at?: string | null
          xp_earned?: number | null
          xp_spent?: number | null
        }
        Update: {
          activity_count?: number | null
          activity_date?: string
          category?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string
          updated_at?: string | null
          xp_earned?: number | null
          xp_spent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_daily_cats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_employment: {
        Row: {
          auto_clock_in: boolean | null
          created_at: string | null
          hired_at: string | null
          id: string
          job_id: string
          last_shift_at: string | null
          profile_id: string
          shifts_completed: number | null
          status: string
          terminated_at: string | null
          total_earnings: number | null
          updated_at: string | null
        }
        Insert: {
          auto_clock_in?: boolean | null
          created_at?: string | null
          hired_at?: string | null
          id?: string
          job_id: string
          last_shift_at?: string | null
          profile_id: string
          shifts_completed?: number | null
          status?: string
          terminated_at?: string | null
          total_earnings?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_clock_in?: boolean | null
          created_at?: string | null
          hired_at?: string | null
          id?: string
          job_id?: string
          last_shift_at?: string | null
          profile_id?: string
          shifts_completed?: number | null
          status?: string
          terminated_at?: string | null
          total_earnings?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_employment_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_employment_profile_id_fkey"
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
      player_mentor_sessions: {
        Row: {
          attribute_gains: Json
          created_at: string
          id: string
          mentor_id: string
          notes: string | null
          profile_id: string
          session_date: string
          skill_value_gained: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          attribute_gains?: Json
          created_at?: string
          id?: string
          mentor_id: string
          notes?: string | null
          profile_id: string
          session_date?: string
          skill_value_gained?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          attribute_gains?: Json
          created_at?: string
          id?: string
          mentor_id?: string
          notes?: string | null
          profile_id?: string
          session_date?: string
          skill_value_gained?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_mentor_sessions_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "education_mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      player_merchandise: {
        Row: {
          band_id: string
          cost_to_produce: number
          created_at: string
          design_name: string
          id: string
          item_type: string
          selling_price: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          band_id: string
          cost_to_produce?: number
          created_at?: string
          design_name: string
          id?: string
          item_type: string
          selling_price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          band_id?: string
          cost_to_produce?: number
          created_at?: string
          design_name?: string
          id?: string
          item_type?: string
          selling_price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_merchandise_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      player_skills: {
        Row: {
          bass: number
          composition: number
          created_at: string
          creativity: number
          drums: number
          guitar: number
          id: string
          performance: number
          songwriting: number
          technical: number
          updated_at: string
          user_id: string
          vocals: number
        }
        Insert: {
          bass?: number
          composition?: number
          created_at?: string
          creativity?: number
          drums?: number
          guitar?: number
          id?: string
          performance?: number
          songwriting?: number
          technical?: number
          updated_at?: string
          user_id: string
          vocals?: number
        }
        Update: {
          bass?: number
          composition?: number
          created_at?: string
          creativity?: number
          drums?: number
          guitar?: number
          id?: string
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
        Relationships: []
      }
      player_travel_history: {
        Row: {
          arrival_time: string
          cost_paid: number
          created_at: string | null
          departure_time: string
          from_city_id: string | null
          id: string
          profile_id: string | null
          to_city_id: string
          transport_type: string
          travel_duration_hours: number
          user_id: string
        }
        Insert: {
          arrival_time: string
          cost_paid: number
          created_at?: string | null
          departure_time: string
          from_city_id?: string | null
          id?: string
          profile_id?: string | null
          to_city_id: string
          transport_type: string
          travel_duration_hours: number
          user_id: string
        }
        Update: {
          arrival_time?: string
          cost_paid?: number
          created_at?: string | null
          departure_time?: string
          from_city_id?: string | null
          id?: string
          profile_id?: string | null
          to_city_id?: string
          transport_type?: string
          travel_duration_hours?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_travel_history_from_city_id_fkey"
            columns: ["from_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_travel_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_travel_history_to_city_id_fkey"
            columns: ["to_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      player_university_attendance: {
        Row: {
          attendance_date: string
          created_at: string | null
          enrollment_id: string
          id: string
          was_locked_out: boolean | null
          xp_earned: number
        }
        Insert: {
          attendance_date: string
          created_at?: string | null
          enrollment_id: string
          id?: string
          was_locked_out?: boolean | null
          xp_earned: number
        }
        Update: {
          attendance_date?: string
          created_at?: string | null
          enrollment_id?: string
          id?: string
          was_locked_out?: boolean | null
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_university_attendance_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "player_university_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      player_university_enrollments: {
        Row: {
          actual_completion_date: string | null
          auto_attend: boolean | null
          course_id: string
          created_at: string | null
          days_attended: number | null
          enrolled_at: string | null
          id: string
          payment_amount: number
          profile_id: string
          scheduled_end_date: string
          status: Database["public"]["Enums"]["enrollment_status"] | null
          total_xp_earned: number | null
          university_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_completion_date?: string | null
          auto_attend?: boolean | null
          course_id: string
          created_at?: string | null
          days_attended?: number | null
          enrolled_at?: string | null
          id?: string
          payment_amount: number
          profile_id: string
          scheduled_end_date: string
          status?: Database["public"]["Enums"]["enrollment_status"] | null
          total_xp_earned?: number | null
          university_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_completion_date?: string | null
          auto_attend?: boolean | null
          course_id?: string
          created_at?: string | null
          days_attended?: number | null
          enrolled_at?: string | null
          id?: string
          payment_amount?: number
          profile_id?: string
          scheduled_end_date?: string
          status?: Database["public"]["Enums"]["enrollment_status"] | null
          total_xp_earned?: number | null
          university_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_university_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "university_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_university_enrollments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_university_enrollments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
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
      playlist_submissions: {
        Row: {
          id: string
          playlist_id: string
          release_id: string
          reviewed_at: string | null
          submission_status: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          id?: string
          playlist_id: string
          release_id: string
          reviewed_at?: string | null
          submission_status?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          id?: string
          playlist_id?: string
          release_id?: string
          reviewed_at?: string | null
          submission_status?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_submissions_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_submissions_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "song_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          acceptance_criteria: Json | null
          boost_multiplier: number
          created_at: string
          curator_type: string
          follower_count: number
          id: string
          platform_id: string
          playlist_name: string
          submission_cost: number | null
        }
        Insert: {
          acceptance_criteria?: Json | null
          boost_multiplier?: number
          created_at?: string
          curator_type?: string
          follower_count?: number
          id?: string
          platform_id: string
          playlist_name: string
          submission_cost?: number | null
        }
        Update: {
          acceptance_criteria?: Json | null
          boost_multiplier?: number
          created_at?: string
          curator_type?: string
          follower_count?: number
          id?: string
          platform_id?: string
          playlist_name?: string
          submission_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "playlists_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "streaming_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_activity_statuses: {
        Row: {
          activity_type: string
          completed_at: string | null
          created_at: string | null
          duration_minutes: number | null
          ends_at: string | null
          id: string
          metadata: Json | null
          profile_id: string
          started_at: string
          status: string
          updated_at: string | null
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          metadata?: Json | null
          profile_id: string
          started_at?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string
          started_at?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_activity_statuses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_daily_xp_grants: {
        Row: {
          created_at: string
          grant_date: string
          id: string
          metadata: Json | null
          profile_id: string
          source: string
          xp_amount: number
        }
        Insert: {
          created_at?: string
          grant_date?: string
          id?: string
          metadata?: Json | null
          profile_id: string
          source: string
          xp_amount?: number
        }
        Update: {
          created_at?: string
          grant_date?: string
          id?: string
          metadata?: Json | null
          profile_id?: string
          source?: string
          xp_amount?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number
          avatar_url: string | null
          bio: string | null
          cash: number | null
          character_birth_date: string | null
          created_at: string | null
          current_activity: string | null
          current_city_id: string | null
          display_name: string | null
          energy: number
          experience: number | null
          experience_at_last_weekly_bonus: number | null
          fame: number | null
          fans: number | null
          health: number
          id: string
          last_health_update: string | null
          last_weekly_bonus_at: string | null
          level: number | null
          rest_required_until: string | null
          updated_at: string | null
          user_id: string
          username: string
          weekly_bonus_metadata: Json | null
          weekly_bonus_streak: number | null
        }
        Insert: {
          age?: number
          avatar_url?: string | null
          bio?: string | null
          cash?: number | null
          character_birth_date?: string | null
          created_at?: string | null
          current_activity?: string | null
          current_city_id?: string | null
          display_name?: string | null
          energy?: number
          experience?: number | null
          experience_at_last_weekly_bonus?: number | null
          fame?: number | null
          fans?: number | null
          health?: number
          id?: string
          last_health_update?: string | null
          last_weekly_bonus_at?: string | null
          level?: number | null
          rest_required_until?: string | null
          updated_at?: string | null
          user_id: string
          username: string
          weekly_bonus_metadata?: Json | null
          weekly_bonus_streak?: number | null
        }
        Update: {
          age?: number
          avatar_url?: string | null
          bio?: string | null
          cash?: number | null
          character_birth_date?: string | null
          created_at?: string | null
          current_activity?: string | null
          current_city_id?: string | null
          display_name?: string | null
          energy?: number
          experience?: number | null
          experience_at_last_weekly_bonus?: number | null
          fame?: number | null
          fans?: number | null
          health?: number
          id?: string
          last_health_update?: string | null
          last_weekly_bonus_at?: string | null
          level?: number | null
          rest_required_until?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string
          weekly_bonus_metadata?: Json | null
          weekly_bonus_streak?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_city_id_fkey"
            columns: ["current_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_playlists: {
        Row: {
          added_at: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          removed_at: string | null
          show_id: string
          song_id: string
          times_played: number | null
          week_start_date: string
        }
        Insert: {
          added_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          removed_at?: string | null
          show_id: string
          song_id: string
          times_played?: number | null
          week_start_date: string
        }
        Update: {
          added_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          removed_at?: string | null
          show_id?: string
          song_id?: string
          times_played?: number | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "radio_playlists_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "radio_shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_playlists_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "radio_playlists_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_plays: {
        Row: {
          created_at: string | null
          hype_gained: number | null
          id: string
          listeners: number
          played_at: string | null
          playlist_id: string
          sales_boost: number | null
          show_id: string
          song_id: string
          station_id: string
          streams_boost: number | null
        }
        Insert: {
          created_at?: string | null
          hype_gained?: number | null
          id?: string
          listeners: number
          played_at?: string | null
          playlist_id: string
          sales_boost?: number | null
          show_id: string
          song_id: string
          station_id: string
          streams_boost?: number | null
        }
        Update: {
          created_at?: string | null
          hype_gained?: number | null
          id?: string
          listeners?: number
          played_at?: string | null
          playlist_id?: string
          sales_boost?: number | null
          show_id?: string
          song_id?: string
          station_id?: string
          streams_boost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "radio_plays_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "radio_playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_plays_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "radio_shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_plays_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "radio_plays_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_plays_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "radio_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_shows: {
        Row: {
          created_at: string | null
          day_of_week: number | null
          description: string | null
          host_name: string
          id: string
          is_active: boolean | null
          listener_multiplier: number | null
          show_genres: string[] | null
          show_name: string
          station_id: string
          time_slot: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week?: number | null
          description?: string | null
          host_name: string
          id?: string
          is_active?: boolean | null
          listener_multiplier?: number | null
          show_genres?: string[] | null
          show_name: string
          station_id: string
          time_slot: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number | null
          description?: string | null
          host_name?: string
          id?: string
          is_active?: boolean | null
          listener_multiplier?: number | null
          show_genres?: string[] | null
          show_name?: string
          station_id?: string
          time_slot?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radio_shows_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "radio_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_stations: {
        Row: {
          accepted_genres: string[] | null
          city_id: string | null
          country: string | null
          created_at: string | null
          description: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          listener_base: number
          name: string
          quality_level: number
          station_type: string
          updated_at: string | null
        }
        Insert: {
          accepted_genres?: string[] | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          listener_base?: number
          name: string
          quality_level?: number
          station_type: string
          updated_at?: string | null
        }
        Update: {
          accepted_genres?: string[] | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          listener_base?: number
          name?: string
          quality_level?: number
          station_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radio_stations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_submissions: {
        Row: {
          band_id: string | null
          created_at: string | null
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          song_id: string
          station_id: string
          status: string | null
          submitted_at: string | null
          user_id: string | null
          week_submitted: string | null
        }
        Insert: {
          band_id?: string | null
          created_at?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          song_id: string
          station_id: string
          status?: string | null
          submitted_at?: string | null
          user_id?: string | null
          week_submitted?: string | null
        }
        Update: {
          band_id?: string | null
          created_at?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          song_id?: string
          station_id?: string
          status?: string | null
          submitted_at?: string | null
          user_id?: string | null
          week_submitted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radio_submissions_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_submissions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "radio_submissions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_submissions_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "radio_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_producers: {
        Row: {
          arrangement_skill: number
          bio: string | null
          cost_per_hour: number
          created_at: string
          grammy_wins: number | null
          id: string
          image_url: string | null
          is_available: boolean
          mastering_skill: number
          mixing_skill: number
          name: string
          past_works: string[] | null
          platinum_records: number | null
          preferred_genres: string[] | null
          quality_bonus: number
          specialty_genre: string
          studio_id: string | null
          tier: string
          updated_at: string
          years_experience: number
        }
        Insert: {
          arrangement_skill?: number
          bio?: string | null
          cost_per_hour?: number
          created_at?: string
          grammy_wins?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          mastering_skill?: number
          mixing_skill?: number
          name: string
          past_works?: string[] | null
          platinum_records?: number | null
          preferred_genres?: string[] | null
          quality_bonus?: number
          specialty_genre: string
          studio_id?: string | null
          tier?: string
          updated_at?: string
          years_experience?: number
        }
        Update: {
          arrangement_skill?: number
          bio?: string | null
          cost_per_hour?: number
          created_at?: string
          grammy_wins?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          mastering_skill?: number
          mixing_skill?: number
          name?: string
          past_works?: string[] | null
          platinum_records?: number | null
          preferred_genres?: string[] | null
          quality_bonus?: number
          specialty_genre?: string
          studio_id?: string | null
          tier?: string
          updated_at?: string
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "recording_producers_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "city_studios"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_sessions: {
        Row: {
          band_id: string | null
          completed_at: string | null
          created_at: string | null
          duration_hours: number
          id: string
          producer_id: string
          quality_improvement: number | null
          recording_version: string | null
          scheduled_end: string
          scheduled_start: string
          song_id: string
          status: string
          studio_id: string
          total_cost: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          band_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration_hours?: number
          id?: string
          producer_id: string
          quality_improvement?: number | null
          recording_version?: string | null
          scheduled_end: string
          scheduled_start?: string
          song_id: string
          status?: string
          studio_id: string
          total_cost: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          band_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration_hours?: number
          id?: string
          producer_id?: string
          quality_improvement?: number | null
          recording_version?: string | null
          scheduled_end?: string
          scheduled_start?: string
          song_id?: string
          status?: string
          studio_id?: string
          total_cost?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_sessions_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_sessions_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "recording_producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_sessions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "recording_sessions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_sessions_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "city_studios"
            referencedColumns: ["id"]
          },
        ]
      }
      rehearsal_rooms: {
        Row: {
          capacity: number | null
          city_id: string | null
          created_at: string | null
          description: string | null
          district_id: string | null
          equipment_quality: number | null
          hourly_rate: number
          id: string
          location: string | null
          name: string
          quality_rating: number | null
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          city_id?: string | null
          created_at?: string | null
          description?: string | null
          district_id?: string | null
          equipment_quality?: number | null
          hourly_rate?: number
          id?: string
          location?: string | null
          name: string
          quality_rating?: number | null
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          city_id?: string | null
          created_at?: string | null
          description?: string | null
          district_id?: string | null
          equipment_quality?: number | null
          hourly_rate?: number
          id?: string
          location?: string | null
          name?: string
          quality_rating?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rehearsal_rooms_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehearsal_rooms_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "city_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      release_formats: {
        Row: {
          created_at: string
          distribution_fee_percentage: number | null
          format_type: string
          id: string
          manufacturing_completion_date: string | null
          manufacturing_cost: number | null
          manufacturing_status: string | null
          quantity: number | null
          release_date: string
          release_id: string
          retail_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          distribution_fee_percentage?: number | null
          format_type: string
          id?: string
          manufacturing_completion_date?: string | null
          manufacturing_cost?: number | null
          manufacturing_status?: string | null
          quantity?: number | null
          release_date: string
          release_id: string
          retail_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          distribution_fee_percentage?: number | null
          format_type?: string
          id?: string
          manufacturing_completion_date?: string | null
          manufacturing_cost?: number | null
          manufacturing_status?: string | null
          quantity?: number | null
          release_date?: string
          release_id?: string
          retail_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_formats_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      release_sales: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          quantity_sold: number
          release_format_id: string
          sale_date: string
          total_amount: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          quantity_sold?: number
          release_format_id: string
          sale_date?: string
          total_amount: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          quantity_sold?: number
          release_format_id?: string
          sale_date?: string
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "release_sales_release_format_id_fkey"
            columns: ["release_format_id"]
            isOneToOne: false
            referencedRelation: "release_formats"
            referencedColumns: ["id"]
          },
        ]
      }
      release_songs: {
        Row: {
          created_at: string
          id: string
          is_b_side: boolean | null
          release_id: string
          song_id: string
          track_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_b_side?: boolean | null
          release_id: string
          song_id: string
          track_number: number
        }
        Update: {
          created_at?: string
          id?: string
          is_b_side?: boolean | null
          release_id?: string
          song_id?: string
          track_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "release_songs_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "release_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      releases: {
        Row: {
          artist_name: string
          artwork_url: string | null
          band_id: string | null
          catalog_number: string | null
          created_at: string
          id: string
          manufacturing_complete_at: string | null
          release_status: string
          release_type: string
          scheduled_release_date: string | null
          title: string
          total_cost: number | null
          total_revenue: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          artist_name: string
          artwork_url?: string | null
          band_id?: string | null
          catalog_number?: string | null
          created_at?: string
          id?: string
          manufacturing_complete_at?: string | null
          release_status?: string
          release_type: string
          scheduled_release_date?: string | null
          title: string
          total_cost?: number | null
          total_revenue?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          artist_name?: string
          artwork_url?: string | null
          band_id?: string | null
          catalog_number?: string | null
          created_at?: string
          id?: string
          manufacturing_complete_at?: string | null
          release_status?: string
          release_type?: string
          scheduled_release_date?: string | null
          title?: string
          total_cost?: number | null
          total_revenue?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "releases_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      season_genre_modifiers: {
        Row: {
          created_at: string
          genre: string
          gig_attendance_multiplier: number
          id: string
          is_active: boolean
          sales_multiplier: number
          season: string
          streams_multiplier: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          genre: string
          gig_attendance_multiplier?: number
          id?: string
          is_active?: boolean
          sales_multiplier?: number
          season: string
          streams_multiplier?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          genre?: string
          gig_attendance_multiplier?: number
          id?: string
          is_active?: boolean
          sales_multiplier?: number
          season?: string
          streams_multiplier?: number
          updated_at?: string
        }
        Relationships: []
      }
      seasonal_weather_patterns: {
        Row: {
          avg_temperature_celsius: number
          city_id: string
          created_at: string
          id: string
          season: string
          travel_disruption_chance: number
          updated_at: string
          weather_conditions: Json
        }
        Insert: {
          avg_temperature_celsius?: number
          city_id: string
          created_at?: string
          id?: string
          season: string
          travel_disruption_chance?: number
          updated_at?: string
          weather_conditions?: Json
        }
        Update: {
          avg_temperature_celsius?: number
          city_id?: string
          created_at?: string
          id?: string
          season?: string
          travel_disruption_chance?: number
          updated_at?: string
          weather_conditions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "seasonal_weather_patterns_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      setlist_production_note_assignments: {
        Row: {
          added_at: string | null
          id: string
          production_note_id: string
          setlist_id: string
        }
        Insert: {
          added_at?: string | null
          id?: string
          production_note_id: string
          setlist_id: string
        }
        Update: {
          added_at?: string | null
          id?: string
          production_note_id?: string
          setlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setlist_production_note_assignments_production_note_id_fkey"
            columns: ["production_note_id"]
            isOneToOne: false
            referencedRelation: "setlist_production_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setlist_production_note_assignments_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
      setlist_production_notes: {
        Row: {
          category: string
          cooldown_shows: number | null
          cost_per_use: number | null
          created_at: string | null
          description: string
          id: string
          impact_type: string
          impact_value: number
          name: string
          rarity: string | null
          required_fame: number | null
          required_skill_slug: string | null
          required_skill_value: number | null
          required_venue_prestige: number | null
        }
        Insert: {
          category: string
          cooldown_shows?: number | null
          cost_per_use?: number | null
          created_at?: string | null
          description: string
          id?: string
          impact_type: string
          impact_value: number
          name: string
          rarity?: string | null
          required_fame?: number | null
          required_skill_slug?: string | null
          required_skill_value?: number | null
          required_venue_prestige?: number | null
        }
        Update: {
          category?: string
          cooldown_shows?: number | null
          cost_per_use?: number | null
          created_at?: string | null
          description?: string
          id?: string
          impact_type?: string
          impact_value?: number
          name?: string
          rarity?: string | null
          required_fame?: number | null
          required_skill_slug?: string | null
          required_skill_value?: number | null
          required_venue_prestige?: number | null
        }
        Relationships: []
      }
      setlist_songs: {
        Row: {
          created_at: string | null
          id: string
          is_encore: boolean | null
          notes: string | null
          position: number
          setlist_id: string
          song_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_encore?: boolean | null
          notes?: string | null
          position: number
          setlist_id: string
          song_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_encore?: boolean | null
          notes?: string | null
          position?: number
          setlist_id?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setlist_songs_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setlist_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "setlist_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      setlists: {
        Row: {
          band_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          setlist_type: string
          updated_at: string | null
        }
        Insert: {
          band_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          setlist_type?: string
          updated_at?: string | null
        }
        Update: {
          band_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          setlist_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setlists_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_history: {
        Row: {
          clock_in_time: string
          clock_out_time: string | null
          created_at: string | null
          earnings: number
          employment_id: string
          fame_impact: number | null
          health_impact: number | null
          id: string
          job_id: string
          profile_id: string
          shift_date: string
          status: string | null
          xp_earned: number | null
        }
        Insert: {
          clock_in_time: string
          clock_out_time?: string | null
          created_at?: string | null
          earnings: number
          employment_id: string
          fame_impact?: number | null
          health_impact?: number | null
          id?: string
          job_id: string
          profile_id: string
          shift_date: string
          status?: string | null
          xp_earned?: number | null
        }
        Update: {
          clock_in_time?: string
          clock_out_time?: string | null
          created_at?: string | null
          earnings?: number
          employment_id?: string
          fame_impact?: number | null
          health_impact?: number | null
          id?: string
          job_id?: string
          profile_id?: string
          shift_date?: string
          status?: string | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_history_employment_id_fkey"
            columns: ["employment_id"]
            isOneToOne: false
            referencedRelation: "player_employment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_books: {
        Row: {
          author: string | null
          base_reading_days: number
          category: string | null
          created_at: string
          daily_reading_time: number
          description: string | null
          id: string
          is_active: boolean
          price: number
          reading_hour: number
          required_skill_level: number
          skill_percentage_gain: number
          skill_slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          base_reading_days?: number
          category?: string | null
          created_at?: string
          daily_reading_time?: number
          description?: string | null
          id?: string
          is_active?: boolean
          price: number
          reading_hour?: number
          required_skill_level?: number
          skill_percentage_gain?: number
          skill_slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          base_reading_days?: number
          category?: string | null
          created_at?: string
          daily_reading_time?: number
          description?: string | null
          id?: string
          is_active?: boolean
          price?: number
          reading_hour?: number
          required_skill_level?: number
          skill_percentage_gain?: number
          skill_slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_books_skill_slug_fkey"
            columns: ["skill_slug"]
            isOneToOne: false
            referencedRelation: "skill_definitions"
            referencedColumns: ["slug"]
          },
        ]
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
      song_market_bids: {
        Row: {
          bid_amount: number
          bid_time: string | null
          bidder_id: string
          id: string
          is_winning: boolean | null
          listing_id: string
        }
        Insert: {
          bid_amount: number
          bid_time?: string | null
          bidder_id: string
          id?: string
          is_winning?: boolean | null
          listing_id: string
        }
        Update: {
          bid_amount?: number
          bid_time?: string | null
          bidder_id?: string
          id?: string
          is_winning?: boolean | null
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_market_bids_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "song_market_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      song_market_listings: {
        Row: {
          auction_end_date: string | null
          buyer_id: string | null
          buyout_price: number | null
          created_at: string | null
          current_bid: number | null
          current_bidder_id: string | null
          id: string
          listing_type: string
          reserve_price: number | null
          seller_id: string
          sold_at: string | null
          sold_price: number | null
          song_id: string
          starting_price: number
          status: string
        }
        Insert: {
          auction_end_date?: string | null
          buyer_id?: string | null
          buyout_price?: number | null
          created_at?: string | null
          current_bid?: number | null
          current_bidder_id?: string | null
          id?: string
          listing_type: string
          reserve_price?: number | null
          seller_id: string
          sold_at?: string | null
          sold_price?: number | null
          song_id: string
          starting_price: number
          status?: string
        }
        Update: {
          auction_end_date?: string | null
          buyer_id?: string | null
          buyout_price?: number | null
          created_at?: string | null
          current_bid?: number | null
          current_bidder_id?: string | null
          id?: string
          listing_type?: string
          reserve_price?: number | null
          seller_id?: string
          sold_at?: string | null
          sold_price?: number | null
          song_id?: string
          starting_price?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_market_listings_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_market_listings_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_rehearsals: {
        Row: {
          band_id: string
          created_at: string
          id: string
          last_rehearsed: string | null
          notes: string | null
          rehearsal_level: number
          song_id: string
          times_rehearsed: number
          updated_at: string
        }
        Insert: {
          band_id: string
          created_at?: string
          id?: string
          last_rehearsed?: string | null
          notes?: string | null
          rehearsal_level?: number
          song_id: string
          times_rehearsed?: number
          updated_at?: string
        }
        Update: {
          band_id?: string
          created_at?: string
          id?: string
          last_rehearsed?: string | null
          notes?: string | null
          rehearsal_level?: number
          song_id?: string
          times_rehearsed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_rehearsals_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_rehearsals_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_rehearsals_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_releases: {
        Row: {
          band_id: string | null
          created_at: string
          id: string
          is_active: boolean
          platform_id: string
          release_date: string
          release_id: string | null
          release_type: string
          song_id: string
          total_revenue: number
          total_streams: number
          updated_at: string
          user_id: string
        }
        Insert: {
          band_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          platform_id: string
          release_date?: string
          release_id?: string | null
          release_type?: string
          song_id: string
          total_revenue?: number
          total_streams?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          band_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          platform_id?: string
          release_date?: string
          release_id?: string | null
          release_type?: string
          song_id?: string
          total_revenue?: number
          total_streams?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_releases_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_releases_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "streaming_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_releases_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_releases_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_releases_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_sales_royalties: {
        Row: {
          buyer_id: string
          id: string
          original_writer_id: string
          royalty_percentage: number
          sale_price: number
          sold_at: string | null
          song_id: string
        }
        Insert: {
          buyer_id: string
          id?: string
          original_writer_id: string
          royalty_percentage?: number
          sale_price: number
          sold_at?: string | null
          song_id: string
        }
        Update: {
          buyer_id?: string
          id?: string
          original_writer_id?: string
          royalty_percentage?: number
          sale_price?: number
          sold_at?: string | null
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_sales_royalties_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_sales_royalties_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_themes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          mood: string | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          mood?: string | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          mood?: string | null
          name?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          ai_generated_lyrics: boolean | null
          arrangement_strength: number | null
          band_id: string | null
          catalog_status: string | null
          chart_position: number | null
          chord_progression_id: string | null
          completed_at: string | null
          created_at: string
          duration_display: string | null
          duration_seconds: number | null
          genre: string
          hype: number | null
          id: string
          last_radio_play: string | null
          lyrics: string | null
          lyrics_progress: number | null
          lyrics_strength: number | null
          market_listing_id: string | null
          melody_strength: number | null
          music_progress: number | null
          original_writer_id: string | null
          ownership_type: string | null
          production_potential: number | null
          profile_id: string | null
          quality_score: number
          rating_revealed_at: string | null
          release_date: string | null
          revenue: number
          rhythm_strength: number | null
          song_rating: number | null
          songwriting_project_id: string | null
          status: string
          streams: number
          theme_id: string | null
          title: string
          total_radio_plays: number | null
          total_sessions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_generated_lyrics?: boolean | null
          arrangement_strength?: number | null
          band_id?: string | null
          catalog_status?: string | null
          chart_position?: number | null
          chord_progression_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_display?: string | null
          duration_seconds?: number | null
          genre: string
          hype?: number | null
          id?: string
          last_radio_play?: string | null
          lyrics?: string | null
          lyrics_progress?: number | null
          lyrics_strength?: number | null
          market_listing_id?: string | null
          melody_strength?: number | null
          music_progress?: number | null
          original_writer_id?: string | null
          ownership_type?: string | null
          production_potential?: number | null
          profile_id?: string | null
          quality_score?: number
          rating_revealed_at?: string | null
          release_date?: string | null
          revenue?: number
          rhythm_strength?: number | null
          song_rating?: number | null
          songwriting_project_id?: string | null
          status?: string
          streams?: number
          theme_id?: string | null
          title: string
          total_radio_plays?: number | null
          total_sessions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_generated_lyrics?: boolean | null
          arrangement_strength?: number | null
          band_id?: string | null
          catalog_status?: string | null
          chart_position?: number | null
          chord_progression_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_display?: string | null
          duration_seconds?: number | null
          genre?: string
          hype?: number | null
          id?: string
          last_radio_play?: string | null
          lyrics?: string | null
          lyrics_progress?: number | null
          lyrics_strength?: number | null
          market_listing_id?: string | null
          melody_strength?: number | null
          music_progress?: number | null
          original_writer_id?: string | null
          ownership_type?: string | null
          production_potential?: number | null
          profile_id?: string | null
          quality_score?: number
          rating_revealed_at?: string | null
          release_date?: string | null
          revenue?: number
          rhythm_strength?: number | null
          song_rating?: number | null
          songwriting_project_id?: string | null
          status?: string
          streams?: number
          theme_id?: string | null
          title?: string
          total_radio_plays?: number | null
          total_sessions?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "songs_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_chord_progression_id_fkey"
            columns: ["chord_progression_id"]
            isOneToOne: false
            referencedRelation: "chord_progressions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_songwriting_project_id_fkey"
            columns: ["songwriting_project_id"]
            isOneToOne: false
            referencedRelation: "songwriting_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "song_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      songwriting_projects: {
        Row: {
          chord_progression_id: string | null
          created_at: string
          creative_brief: Json | null
          estimated_sessions: number | null
          genres: string[] | null
          id: string
          initial_lyrics: string | null
          is_locked: boolean | null
          locked_until: string | null
          lyrics: string | null
          lyrics_progress: number | null
          mode: string | null
          music_progress: number | null
          purpose: string | null
          quality_score: number | null
          sessions_completed: number | null
          song_id: string | null
          song_rating: number | null
          status: string | null
          theme_id: string | null
          title: string
          total_sessions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chord_progression_id?: string | null
          created_at?: string
          creative_brief?: Json | null
          estimated_sessions?: number | null
          genres?: string[] | null
          id?: string
          initial_lyrics?: string | null
          is_locked?: boolean | null
          locked_until?: string | null
          lyrics?: string | null
          lyrics_progress?: number | null
          mode?: string | null
          music_progress?: number | null
          purpose?: string | null
          quality_score?: number | null
          sessions_completed?: number | null
          song_id?: string | null
          song_rating?: number | null
          status?: string | null
          theme_id?: string | null
          title: string
          total_sessions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chord_progression_id?: string | null
          created_at?: string
          creative_brief?: Json | null
          estimated_sessions?: number | null
          genres?: string[] | null
          id?: string
          initial_lyrics?: string | null
          is_locked?: boolean | null
          locked_until?: string | null
          lyrics?: string | null
          lyrics_progress?: number | null
          mode?: string | null
          music_progress?: number | null
          purpose?: string | null
          quality_score?: number | null
          sessions_completed?: number | null
          song_id?: string | null
          song_rating?: number | null
          status?: string | null
          theme_id?: string | null
          title?: string
          total_sessions?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "songwriting_projects_chord_progression_id_fkey"
            columns: ["chord_progression_id"]
            isOneToOne: false
            referencedRelation: "chord_progressions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songwriting_projects_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "songwriting_projects_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songwriting_projects_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "song_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      songwriting_sessions: {
        Row: {
          auto_completed: boolean | null
          completed_at: string | null
          created_at: string
          id: string
          locked_until: string | null
          lyrics_progress_gained: number | null
          music_progress_gained: number | null
          notes: string | null
          project_id: string
          session_end: string | null
          session_start: string
          started_at: string
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          auto_completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          locked_until?: string | null
          lyrics_progress_gained?: number | null
          music_progress_gained?: number | null
          notes?: string | null
          project_id: string
          session_end?: string | null
          session_start?: string
          started_at?: string
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          auto_completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          locked_until?: string | null
          lyrics_progress_gained?: number | null
          music_progress_gained?: number | null
          notes?: string | null
          project_id?: string
          session_end?: string | null
          session_start?: string
          started_at?: string
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "songwriting_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "songwriting_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      streaming_analytics: {
        Row: {
          created_at: string
          date: string
          id: string
          new_followers: number
          playlist_adds: number
          release_id: string
          revenue: number
          streams: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          new_followers?: number
          playlist_adds?: number
          release_id: string
          revenue?: number
          streams?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          new_followers?: number
          playlist_adds?: number
          release_id?: string
          revenue?: number
          streams?: number
        }
        Relationships: [
          {
            foreignKeyName: "streaming_analytics_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "song_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      streaming_analytics_daily: {
        Row: {
          analytics_date: string
          completion_rate: number | null
          created_at: string | null
          daily_revenue: number | null
          daily_streams: number | null
          id: string
          listener_age_group: string | null
          listener_region: string | null
          platform_id: string | null
          platform_name: string | null
          skip_rate: number | null
          song_release_id: string
          unique_listeners: number | null
        }
        Insert: {
          analytics_date?: string
          completion_rate?: number | null
          created_at?: string | null
          daily_revenue?: number | null
          daily_streams?: number | null
          id?: string
          listener_age_group?: string | null
          listener_region?: string | null
          platform_id?: string | null
          platform_name?: string | null
          skip_rate?: number | null
          song_release_id: string
          unique_listeners?: number | null
        }
        Update: {
          analytics_date?: string
          completion_rate?: number | null
          created_at?: string | null
          daily_revenue?: number | null
          daily_streams?: number | null
          id?: string
          listener_age_group?: string | null
          listener_region?: string | null
          platform_id?: string | null
          platform_name?: string | null
          skip_rate?: number | null
          song_release_id?: string
          unique_listeners?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "streaming_analytics_daily_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "streaming_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streaming_analytics_daily_song_release_id_fkey"
            columns: ["song_release_id"]
            isOneToOne: false
            referencedRelation: "song_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      streaming_platforms: {
        Row: {
          base_payout_per_stream: number
          created_at: string
          genre_bonuses: Json | null
          id: string
          is_active: boolean
          min_quality_requirement: number
          platform_icon_url: string | null
          platform_name: string
          quality_multiplier: number
          updated_at: string
        }
        Insert: {
          base_payout_per_stream?: number
          created_at?: string
          genre_bonuses?: Json | null
          id?: string
          is_active?: boolean
          min_quality_requirement?: number
          platform_icon_url?: string | null
          platform_name: string
          quality_multiplier?: number
          updated_at?: string
        }
        Update: {
          base_payout_per_stream?: number
          created_at?: string
          genre_bonuses?: Json | null
          id?: string
          is_active?: boolean
          min_quality_requirement?: number
          platform_icon_url?: string | null
          platform_name?: string
          quality_multiplier?: number
          updated_at?: string
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
      travel_disruption_events: {
        Row: {
          cause: string
          cost_multiplier: number
          created_at: string
          delay_hours: number
          disruption_type: string
          ends_at: string
          id: string
          is_active: boolean
          route_id: string | null
          severity: number
          started_at: string
          updated_at: string
        }
        Insert: {
          cause: string
          cost_multiplier?: number
          created_at?: string
          delay_hours?: number
          disruption_type: string
          ends_at: string
          id?: string
          is_active?: boolean
          route_id?: string | null
          severity?: number
          started_at?: string
          updated_at?: string
        }
        Update: {
          cause?: string
          cost_multiplier?: number
          created_at?: string
          delay_hours?: number
          disruption_type?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          route_id?: string | null
          severity?: number
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_disruption_events_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "city_transport_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      twaat_metrics: {
        Row: {
          clicks: number | null
          impressions: number | null
          likes: number | null
          replies: number | null
          retwaats: number | null
          rsvps: number | null
          sales: number | null
          twaat_id: string
          updated_at: string | null
        }
        Insert: {
          clicks?: number | null
          impressions?: number | null
          likes?: number | null
          replies?: number | null
          retwaats?: number | null
          rsvps?: number | null
          sales?: number | null
          twaat_id: string
          updated_at?: string | null
        }
        Update: {
          clicks?: number | null
          impressions?: number | null
          likes?: number | null
          replies?: number | null
          retwaats?: number | null
          rsvps?: number | null
          sales?: number | null
          twaat_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "twaat_metrics_twaat_id_fkey"
            columns: ["twaat_id"]
            isOneToOne: true
            referencedRelation: "twaats"
            referencedColumns: ["id"]
          },
        ]
      }
      twaat_replies: {
        Row: {
          account_id: string
          body: string
          created_at: string | null
          deleted_at: string | null
          id: string
          parent_twaat_id: string
          sentiment: number | null
        }
        Insert: {
          account_id: string
          body: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          parent_twaat_id: string
          sentiment?: number | null
        }
        Update: {
          account_id?: string
          body?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          parent_twaat_id?: string
          sentiment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "twaat_replies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaat_replies_parent_twaat_id_fkey"
            columns: ["parent_twaat_id"]
            isOneToOne: false
            referencedRelation: "twaats"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_accounts: {
        Row: {
          created_at: string | null
          display_name: string
          fame_score: number | null
          follower_count: number | null
          following_count: number | null
          handle: string
          id: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["twaater_owner_type"]
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          fame_score?: number | null
          follower_count?: number | null
          following_count?: number | null
          handle: string
          id?: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["twaater_owner_type"]
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          fame_score?: number | null
          follower_count?: number | null
          following_count?: number | null
          handle?: string
          id?: string
          owner_id?: string
          owner_type?: Database["public"]["Enums"]["twaater_owner_type"]
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      twaater_daily_awards: {
        Row: {
          account_id: string
          date: string
          twaats_awarded: number | null
          xp_awarded: number | null
        }
        Insert: {
          account_id: string
          date: string
          twaats_awarded?: number | null
          xp_awarded?: number | null
        }
        Update: {
          account_id?: string
          date?: string
          twaats_awarded?: number | null
          xp_awarded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "twaater_daily_awards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_feed_index: {
        Row: {
          account_id: string
          inserted_at: string | null
          rank_bucket: number | null
          score: number
          twaat_id: string
        }
        Insert: {
          account_id: string
          inserted_at?: string | null
          rank_bucket?: number | null
          score: number
          twaat_id: string
        }
        Update: {
          account_id?: string
          inserted_at?: string | null
          rank_bucket?: number | null
          score?: number
          twaat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twaater_feed_index_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_feed_index_twaat_id_fkey"
            columns: ["twaat_id"]
            isOneToOne: false
            referencedRelation: "twaats"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_follows: {
        Row: {
          created_at: string | null
          followed_account_id: string
          follower_account_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          followed_account_id: string
          follower_account_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          followed_account_id?: string
          follower_account_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "twaater_follows_followed_account_id_fkey"
            columns: ["followed_account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_follows_follower_account_id_fkey"
            columns: ["follower_account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_mentions: {
        Row: {
          created_at: string | null
          id: string
          mentioned_account_id: string
          source_twaat_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentioned_account_id: string
          source_twaat_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mentioned_account_id?: string
          source_twaat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twaater_mentions_mentioned_account_id_fkey"
            columns: ["mentioned_account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_mentions_source_twaat_id_fkey"
            columns: ["source_twaat_id"]
            isOneToOne: false
            referencedRelation: "twaats"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_outcome_catalog: {
        Row: {
          code: string
          created_at: string | null
          description_template: string
          effects: Json | null
          outcome_group: Database["public"]["Enums"]["twaater_outcome_group"]
          weight_base: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description_template: string
          effects?: Json | null
          outcome_group: Database["public"]["Enums"]["twaater_outcome_group"]
          weight_base?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description_template?: string
          effects?: Json | null
          outcome_group?: Database["public"]["Enums"]["twaater_outcome_group"]
          weight_base?: number | null
        }
        Relationships: []
      }
      twaater_reactions: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          reaction_type: string
          twaat_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          reaction_type: string
          twaat_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          reaction_type?: string
          twaat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twaater_reactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_reactions_twaat_id_fkey"
            columns: ["twaat_id"]
            isOneToOne: false
            referencedRelation: "twaats"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_suggested_follows: {
        Row: {
          account_id: string
          created_at: string | null
          reason: string
          score: number
          suggested_account_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          reason: string
          score?: number
          suggested_account_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          reason?: string
          score?: number
          suggested_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twaater_suggested_follows_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_suggested_follows_suggested_account_id_fkey"
            columns: ["suggested_account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      twaats: {
        Row: {
          account_id: string
          body: string
          created_at: string | null
          deleted_at: string | null
          id: string
          is_system_review: boolean | null
          lang: string | null
          linked_id: string | null
          linked_type: Database["public"]["Enums"]["twaater_linked_type"] | null
          outcome_code: string | null
          sentiment: number | null
          visibility: Database["public"]["Enums"]["twaater_visibility"] | null
        }
        Insert: {
          account_id: string
          body: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_system_review?: boolean | null
          lang?: string | null
          linked_id?: string | null
          linked_type?:
            | Database["public"]["Enums"]["twaater_linked_type"]
            | null
          outcome_code?: string | null
          sentiment?: number | null
          visibility?: Database["public"]["Enums"]["twaater_visibility"] | null
        }
        Update: {
          account_id?: string
          body?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_system_review?: boolean | null
          lang?: string | null
          linked_id?: string | null
          linked_type?:
            | Database["public"]["Enums"]["twaater_linked_type"]
            | null
          outcome_code?: string | null
          sentiment?: number | null
          visibility?: Database["public"]["Enums"]["twaater_visibility"] | null
        }
        Relationships: [
          {
            foreignKeyName: "twaats_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          city: string | null
          course_cost_modifier: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          prestige: number | null
          quality_of_learning: number | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          course_cost_modifier?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          prestige?: number | null
          quality_of_learning?: number | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          course_cost_modifier?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          prestige?: number | null
          quality_of_learning?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      university_courses: {
        Row: {
          base_duration_days: number | null
          base_price: number
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_enrollments: number | null
          name: string
          required_skill_level: number | null
          skill_slug: string
          university_id: string
          updated_at: string | null
          xp_per_day_max: number | null
          xp_per_day_min: number | null
        }
        Insert: {
          base_duration_days?: number | null
          base_price: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_enrollments?: number | null
          name: string
          required_skill_level?: number | null
          skill_slug: string
          university_id: string
          updated_at?: string | null
          xp_per_day_max?: number | null
          xp_per_day_min?: number | null
        }
        Update: {
          base_duration_days?: number | null
          base_price?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_enrollments?: number | null
          name?: string
          required_skill_level?: number | null
          skill_slug?: string
          university_id?: string
          updated_at?: string | null
          xp_per_day_max?: number | null
          xp_per_day_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "university_courses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
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
      venues: {
        Row: {
          amenities: Json | null
          base_payment: number | null
          capacity: number | null
          city_id: string | null
          created_at: string | null
          description: string | null
          district_id: string | null
          id: string
          image_url: string | null
          location: string | null
          name: string
          prestige_level: number | null
          requirements: Json | null
          slot_config: Json | null
          slots_per_day: number | null
          venue_type: string | null
        }
        Insert: {
          amenities?: Json | null
          base_payment?: number | null
          capacity?: number | null
          city_id?: string | null
          created_at?: string | null
          description?: string | null
          district_id?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          name: string
          prestige_level?: number | null
          requirements?: Json | null
          slot_config?: Json | null
          slots_per_day?: number | null
          venue_type?: string | null
        }
        Update: {
          amenities?: Json | null
          base_payment?: number | null
          capacity?: number | null
          city_id?: string | null
          created_at?: string | null
          description?: string | null
          district_id?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          name?: string
          prestige_level?: number | null
          requirements?: Json | null
          slot_config?: Json | null
          slots_per_day?: number | null
          venue_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "city_districts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      band_gift_notifications: {
        Row: {
          band_name: string | null
          created_at: string | null
          genre: string | null
          gift_message: string | null
          gifted_to_band_id: string | null
          id: string | null
          quality_score: number | null
          song_id: string | null
          song_rating: number | null
          song_title: string | null
          viewed: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_song_gifts_gifted_to_band_id_fkey"
            columns: ["gifted_to_band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      advance_gig_song: { Args: { p_gig_id: string }; Returns: undefined }
      auto_complete_manufacturing: {
        Args: never
        Returns: {
          completed_releases: number
        }[]
      }
      auto_complete_songwriting_sessions: {
        Args: never
        Returns: {
          completed_sessions: number
          converted_projects: number
        }[]
      }
      auto_start_scheduled_gigs: { Args: never; Returns: undefined }
      calculate_setlist_duration: {
        Args: { p_setlist_id: string }
        Returns: number
      }
      calculate_songwriting_progress: {
        Args: {
          p_attr_creative_insight: number
          p_attr_musical_ability: number
          p_current_lyrics: number
          p_current_music: number
          p_skill_composition: number
          p_skill_creativity: number
          p_skill_songwriting: number
        }
        Returns: Json
      }
      get_setlist_total_duration: {
        Args: { p_setlist_id: string }
        Returns: number
      }
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
      increment_release_revenue: {
        Args: { amount: number; release_id: string }
        Returns: undefined
      }
      validate_setlist_for_slot: {
        Args: { p_setlist_id: string; p_slot_type: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      band_status: "active" | "on_hiatus" | "disbanded"
      book_reading_status: "reading" | "completed" | "abandoned"
      chat_participant_status: "online" | "offline" | "typing" | "away"
      enrollment_status: "enrolled" | "in_progress" | "completed" | "dropped"
      friendship_status: "pending" | "accepted" | "declined" | "blocked"
      show_type_enum: "concert" | "festival" | "private" | "street"
      twaater_linked_type: "single" | "album" | "gig" | "tour" | "busking"
      twaater_outcome_group:
        | "engagement"
        | "growth"
        | "commerce"
        | "press"
        | "collab"
        | "backfire"
        | "algo"
        | "serendipity"
      twaater_owner_type: "persona" | "band"
      twaater_visibility: "public" | "followers"
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
      band_status: ["active", "on_hiatus", "disbanded"],
      book_reading_status: ["reading", "completed", "abandoned"],
      chat_participant_status: ["online", "offline", "typing", "away"],
      enrollment_status: ["enrolled", "in_progress", "completed", "dropped"],
      friendship_status: ["pending", "accepted", "declined", "blocked"],
      show_type_enum: ["concert", "festival", "private", "street"],
      twaater_linked_type: ["single", "album", "gig", "tour", "busking"],
      twaater_outcome_group: [
        "engagement",
        "growth",
        "commerce",
        "press",
        "collab",
        "backfire",
        "algo",
        "serendipity",
      ],
      twaater_owner_type: ["persona", "band"],
      twaater_visibility: ["public", "followers"],
    },
  },
} as const
