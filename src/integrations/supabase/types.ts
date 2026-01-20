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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "admin_song_gifts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
      age_demographics: {
        Row: {
          age_max: number
          age_min: number
          created_at: string | null
          description: string | null
          genre_preferences: Json | null
          id: string
          name: string
        }
        Insert: {
          age_max: number
          age_min: number
          created_at?: string | null
          description?: string | null
          genre_preferences?: Json | null
          id?: string
          name: string
        }
        Update: {
          age_max?: number
          age_min?: number
          created_at?: string | null
          description?: string | null
          genre_preferences?: Json | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      animation_sets: {
        Row: {
          clip_big_chorus: string | null
          clip_idle: string | null
          clip_intro: string | null
          clip_outro: string | null
          clip_playing: string | null
          created_at: string | null
          id: string
          instrument_type: string
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          clip_big_chorus?: string | null
          clip_idle?: string | null
          clip_intro?: string | null
          clip_outro?: string | null
          clip_playing?: string | null
          created_at?: string | null
          id?: string
          instrument_type: string
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          clip_big_chorus?: string | null
          clip_idle?: string | null
          clip_intro?: string | null
          clip_outro?: string | null
          clip_playing?: string | null
          created_at?: string | null
          id?: string
          instrument_type?: string
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      artist_label_contracts: {
        Row: {
          advance_amount: number | null
          album_quota: number | null
          albums_completed: number | null
          artist_profile_id: string | null
          band_id: string | null
          contract_value: number | null
          created_at: string | null
          deal_type_id: string
          demo_submission_id: string | null
          end_date: string
          id: string
          label_id: string
          manufacturing_covered: boolean | null
          marketing_support: number | null
          masters_owned_by_artist: boolean | null
          recouped_amount: number | null
          release_quota: number
          releases_completed: number | null
          roster_slot_id: string | null
          royalty_artist_pct: number
          royalty_label_pct: number | null
          single_quota: number | null
          singles_completed: number | null
          start_date: string
          status: string | null
          terminated_at: string | null
          termination_fee_paid: number | null
          termination_fee_pct: number | null
          territories: string[] | null
          updated_at: string | null
        }
        Insert: {
          advance_amount?: number | null
          album_quota?: number | null
          albums_completed?: number | null
          artist_profile_id?: string | null
          band_id?: string | null
          contract_value?: number | null
          created_at?: string | null
          deal_type_id: string
          demo_submission_id?: string | null
          end_date: string
          id?: string
          label_id: string
          manufacturing_covered?: boolean | null
          marketing_support?: number | null
          masters_owned_by_artist?: boolean | null
          recouped_amount?: number | null
          release_quota: number
          releases_completed?: number | null
          roster_slot_id?: string | null
          royalty_artist_pct: number
          royalty_label_pct?: number | null
          single_quota?: number | null
          singles_completed?: number | null
          start_date: string
          status?: string | null
          terminated_at?: string | null
          termination_fee_paid?: number | null
          termination_fee_pct?: number | null
          territories?: string[] | null
          updated_at?: string | null
        }
        Update: {
          advance_amount?: number | null
          album_quota?: number | null
          albums_completed?: number | null
          artist_profile_id?: string | null
          band_id?: string | null
          contract_value?: number | null
          created_at?: string | null
          deal_type_id?: string
          demo_submission_id?: string | null
          end_date?: string
          id?: string
          label_id?: string
          manufacturing_covered?: boolean | null
          marketing_support?: number | null
          masters_owned_by_artist?: boolean | null
          recouped_amount?: number | null
          release_quota?: number
          releases_completed?: number | null
          roster_slot_id?: string | null
          royalty_artist_pct?: number
          royalty_label_pct?: number | null
          single_quota?: number | null
          singles_completed?: number | null
          start_date?: string
          status?: string | null
          terminated_at?: string | null
          termination_fee_paid?: number | null
          termination_fee_pct?: number | null
          territories?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_label_contracts_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_label_contracts_deal_type_id_fkey"
            columns: ["deal_type_id"]
            isOneToOne: false
            referencedRelation: "label_deal_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_label_contracts_demo_submission_id_fkey"
            columns: ["demo_submission_id"]
            isOneToOne: false
            referencedRelation: "demo_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_label_contracts_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_label_contracts_roster_slot_id_fkey"
            columns: ["roster_slot_id"]
            isOneToOne: false
            referencedRelation: "label_roster_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_memory: {
        Row: {
          avg_experience_score: number | null
          band_id: string | null
          city_id: string | null
          created_at: string | null
          gigs_attended: number | null
          id: string
          last_gig_date: string | null
          loyalty_level: string | null
          updated_at: string | null
          will_attend_again: boolean | null
        }
        Insert: {
          avg_experience_score?: number | null
          band_id?: string | null
          city_id?: string | null
          created_at?: string | null
          gigs_attended?: number | null
          id?: string
          last_gig_date?: string | null
          loyalty_level?: string | null
          updated_at?: string | null
          will_attend_again?: boolean | null
        }
        Update: {
          avg_experience_score?: number | null
          band_id?: string | null
          city_id?: string | null
          created_at?: string | null
          gigs_attended?: number | null
          id?: string
          last_gig_date?: string | null
          loyalty_level?: string | null
          updated_at?: string | null
          will_attend_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "audience_memory_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audience_memory_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_generation_prompts: {
        Row: {
          created_at: string | null
          id: string
          prompt_text: string
          session_id: string | null
          status: string | null
          target_model: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          prompt_text: string
          session_id?: string | null
          status?: string | null
          target_model?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          prompt_text?: string
          session_id?: string | null
          status?: string | null
          target_model?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_generation_prompts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recording_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_generation_results: {
        Row: {
          audio_url: string | null
          created_at: string | null
          id: string
          is_preferred: boolean | null
          prompt_id: string | null
          quality_score: number | null
          session_id: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          id?: string
          is_preferred?: boolean | null
          prompt_id?: string | null
          quality_score?: number | null
          session_id?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          id?: string
          is_preferred?: boolean | null
          prompt_id?: string | null
          quality_score?: number | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_generation_results_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "audio_generation_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_generation_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recording_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_clothing_items: {
        Row: {
          category: string
          collection_id: string | null
          color_variants: Json | null
          created_at: string | null
          description: string | null
          expiry_date: string | null
          featured: boolean | null
          id: string
          is_limited_edition: boolean | null
          is_premium: boolean | null
          name: string
          price: number | null
          rarity: string | null
          release_date: string | null
          rpm_asset_id: string | null
          shape_config: Json | null
        }
        Insert: {
          category: string
          collection_id?: string | null
          color_variants?: Json | null
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          featured?: boolean | null
          id?: string
          is_limited_edition?: boolean | null
          is_premium?: boolean | null
          name: string
          price?: number | null
          rarity?: string | null
          release_date?: string | null
          rpm_asset_id?: string | null
          shape_config?: Json | null
        }
        Update: {
          category?: string
          collection_id?: string | null
          color_variants?: Json | null
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          featured?: boolean | null
          id?: string
          is_limited_edition?: boolean | null
          is_premium?: boolean | null
          name?: string
          price?: number | null
          rarity?: string | null
          release_date?: string | null
          rpm_asset_id?: string | null
          shape_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "avatar_clothing_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "skin_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_face_options: {
        Row: {
          created_at: string | null
          description: string | null
          feature_type: string
          id: string
          is_premium: boolean | null
          name: string
          price: number | null
          shape_config: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          feature_type: string
          id?: string
          is_premium?: boolean | null
          name: string
          price?: number | null
          shape_config?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          feature_type?: string
          id?: string
          is_premium?: boolean | null
          name?: string
          price?: number | null
          shape_config?: Json | null
        }
        Relationships: []
      }
      avatar_hair_styles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_premium: boolean | null
          name: string
          preview_color: string | null
          price: number | null
          rarity: string | null
          style_key: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_premium?: boolean | null
          name: string
          preview_color?: string | null
          price?: number | null
          rarity?: string | null
          style_key: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_premium?: boolean | null
          name?: string
          preview_color?: string | null
          price?: number | null
          rarity?: string | null
          style_key?: string
        }
        Relationships: []
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
      band_avatar_presets: {
        Row: {
          avatar_model_path: string | null
          band_id: string | null
          created_at: string | null
          default_animation_set_id: string | null
          gear_model_path: string | null
          id: string
          instrument_type: string | null
          member_index: number
          metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_model_path?: string | null
          band_id?: string | null
          created_at?: string | null
          default_animation_set_id?: string | null
          gear_model_path?: string | null
          id?: string
          instrument_type?: string | null
          member_index: number
          metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_model_path?: string | null
          band_id?: string | null
          created_at?: string | null
          default_animation_set_id?: string | null
          gear_model_path?: string | null
          id?: string
          instrument_type?: string | null
          member_index?: number
          metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_avatar_presets_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_avatar_presets_default_animation_set_id_fkey"
            columns: ["default_animation_set_id"]
            isOneToOne: false
            referencedRelation: "animation_sets"
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
      band_city_fans: {
        Row: {
          avg_satisfaction: number | null
          band_id: string
          casual_fans: number
          city_fame: number | null
          city_id: string | null
          city_name: string
          country: string | null
          created_at: string
          dedicated_fans: number
          gigs_in_city: number
          id: string
          last_gig_date: string | null
          superfans: number
          total_fans: number
          updated_at: string
        }
        Insert: {
          avg_satisfaction?: number | null
          band_id: string
          casual_fans?: number
          city_fame?: number | null
          city_id?: string | null
          city_name: string
          country?: string | null
          created_at?: string
          dedicated_fans?: number
          gigs_in_city?: number
          id?: string
          last_gig_date?: string | null
          superfans?: number
          total_fans?: number
          updated_at?: string
        }
        Update: {
          avg_satisfaction?: number | null
          band_id?: string
          casual_fans?: number
          city_fame?: number | null
          city_id?: string | null
          city_name?: string
          country?: string | null
          created_at?: string
          dedicated_fans?: number
          gigs_in_city?: number
          id?: string
          last_gig_date?: string | null
          superfans?: number
          total_fans?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_city_fans_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_city_fans_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      band_conflicts: {
        Row: {
          band_id: string | null
          conflict_type: string
          detected_at: string | null
          gig_id_1: string | null
          gig_id_2: string | null
          id: string
          resolution_note: string | null
          resolved: boolean | null
        }
        Insert: {
          band_id?: string | null
          conflict_type: string
          detected_at?: string | null
          gig_id_1?: string | null
          gig_id_2?: string | null
          id?: string
          resolution_note?: string | null
          resolved?: boolean | null
        }
        Update: {
          band_id?: string | null
          conflict_type?: string
          detected_at?: string | null
          gig_id_1?: string | null
          gig_id_2?: string | null
          id?: string
          resolution_note?: string | null
          resolved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "band_conflicts_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_conflicts_gig_id_1_fkey"
            columns: ["gig_id_1"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_conflicts_gig_id_2_fkey"
            columns: ["gig_id_2"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      band_country_fans: {
        Row: {
          band_id: string
          casual_fans: number | null
          country: string
          created_at: string | null
          dedicated_fans: number | null
          fame: number | null
          id: string
          last_activity_date: string | null
          superfans: number | null
          total_fans: number | null
          updated_at: string | null
        }
        Insert: {
          band_id: string
          casual_fans?: number | null
          country: string
          created_at?: string | null
          dedicated_fans?: number | null
          fame?: number | null
          id?: string
          last_activity_date?: string | null
          superfans?: number | null
          total_fans?: number | null
          updated_at?: string | null
        }
        Update: {
          band_id?: string
          casual_fans?: number | null
          country?: string
          created_at?: string | null
          dedicated_fans?: number | null
          fame?: number | null
          id?: string
          last_activity_date?: string | null
          superfans?: number | null
          total_fans?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_country_fans_band_id_fkey"
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
          catalog_crew_id: string | null
          cohesion_rating: number
          created_at: string
          crew_type: string
          experience_years: number
          gigs_together: number
          hire_date: string
          id: string
          name: string
          notes: string | null
          salary_per_gig: number
          skill_level: number
          star_rating: number | null
          updated_at: string
        }
        Insert: {
          band_id: string
          catalog_crew_id?: string | null
          cohesion_rating?: number
          created_at?: string
          crew_type: string
          experience_years?: number
          gigs_together?: number
          hire_date?: string
          id?: string
          name: string
          notes?: string | null
          salary_per_gig?: number
          skill_level?: number
          star_rating?: number | null
          updated_at?: string
        }
        Update: {
          band_id?: string
          catalog_crew_id?: string | null
          cohesion_rating?: number
          created_at?: string
          crew_type?: string
          experience_years?: number
          gigs_together?: number
          hire_date?: string
          id?: string
          name?: string
          notes?: string | null
          salary_per_gig?: number
          skill_level?: number
          star_rating?: number | null
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
      band_demographic_fans: {
        Row: {
          band_id: string
          city_id: string | null
          country: string | null
          created_at: string | null
          demographic_id: string
          engagement_rate: number | null
          fan_count: number | null
          id: string
          updated_at: string | null
        }
        Insert: {
          band_id: string
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          demographic_id: string
          engagement_rate?: number | null
          fan_count?: number | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          band_id?: string
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          demographic_id?: string
          engagement_rate?: number | null
          fan_count?: number | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_demographic_fans_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_demographic_fans_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_demographic_fans_demographic_id_fkey"
            columns: ["demographic_id"]
            isOneToOne: false
            referencedRelation: "age_demographics"
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
      band_fame_history: {
        Row: {
          band_id: string
          city_id: string | null
          country: string | null
          event_type: string | null
          fame_change: number | null
          fame_value: number
          id: string
          recorded_at: string | null
          scope: string | null
        }
        Insert: {
          band_id: string
          city_id?: string | null
          country?: string | null
          event_type?: string | null
          fame_change?: number | null
          fame_value: number
          id?: string
          recorded_at?: string | null
          scope?: string | null
        }
        Update: {
          band_id?: string
          city_id?: string | null
          country?: string | null
          event_type?: string | null
          fame_change?: number | null
          fame_value?: number
          id?: string
          recorded_at?: string | null
          scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_fame_history_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_fame_history_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
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
      band_media_cooldowns: {
        Row: {
          band_id: string | null
          cooldown_expires_at: string
          created_at: string | null
          id: string
          media_type: string
          outlet_id: string
          show_id: string | null
        }
        Insert: {
          band_id?: string | null
          cooldown_expires_at: string
          created_at?: string | null
          id?: string
          media_type: string
          outlet_id: string
          show_id?: string | null
        }
        Update: {
          band_id?: string | null
          cooldown_expires_at?: string
          created_at?: string | null
          id?: string
          media_type?: string
          outlet_id?: string
          show_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_media_cooldowns_band_id_fkey"
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
          current_city_id: string | null
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
          travels_with_band: boolean | null
          user_id: string | null
          vocal_role: string | null
        }
        Insert: {
          band_id: string
          can_be_leader?: boolean | null
          chemistry_contribution?: number | null
          current_city_id?: string | null
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
          travels_with_band?: boolean | null
          user_id?: string | null
          vocal_role?: string | null
        }
        Update: {
          band_id?: string
          can_be_leader?: boolean | null
          chemistry_contribution?: number | null
          current_city_id?: string | null
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
          travels_with_band?: boolean | null
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
            foreignKeyName: "band_members_current_city_id_fkey"
            columns: ["current_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
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
      band_merch_assets: {
        Row: {
          band_id: string | null
          created_at: string | null
          id: string
          logo_texture_path: string | null
          metadata: Json | null
          tshirt_color_variants: string[] | null
          updated_at: string | null
        }
        Insert: {
          band_id?: string | null
          created_at?: string | null
          id?: string
          logo_texture_path?: string | null
          metadata?: Json | null
          tshirt_color_variants?: string[] | null
          updated_at?: string | null
        }
        Update: {
          band_id?: string | null
          created_at?: string | null
          id?: string
          logo_texture_path?: string | null
          metadata?: Json | null
          tshirt_color_variants?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_merch_assets_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: true
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_ratings: {
        Row: {
          band_id: string
          created_at: string
          id: string
          rating: string
          updated_at: string
          user_id: string
        }
        Insert: {
          band_id: string
          created_at?: string
          id?: string
          rating: string
          updated_at?: string
          user_id: string
        }
        Update: {
          band_id?: string
          created_at?: string
          id?: string
          rating?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_ratings_band_id_fkey"
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
          setlist_id: string | null
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
          setlist_id?: string | null
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
          setlist_id?: string | null
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "band_rehearsals_selected_song_id_fkey"
            columns: ["selected_song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_rehearsals_selected_song_id_fkey"
            columns: ["selected_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_rehearsals_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
      band_rider_items: {
        Row: {
          catalog_item_id: string
          created_at: string | null
          custom_notes: string | null
          id: string
          priority: string
          quantity: number
          rider_id: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string | null
          custom_notes?: string | null
          id?: string
          priority?: string
          quantity?: number
          rider_id: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string | null
          custom_notes?: string | null
          id?: string
          priority?: string
          quantity?: number
          rider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_rider_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "rider_item_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_rider_items_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "band_riders"
            referencedColumns: ["id"]
          },
        ]
      }
      band_riders: {
        Row: {
          band_id: string
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          tier: string
          total_cost_estimate: number | null
          updated_at: string | null
        }
        Insert: {
          band_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          tier?: string
          total_cost_estimate?: number | null
          updated_at?: string | null
        }
        Update: {
          band_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          tier?: string
          total_cost_estimate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_riders_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "band_song_familiarity_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
      band_song_ownership: {
        Row: {
          band_id: string
          created_at: string | null
          id: string
          is_active_member: boolean | null
          original_percentage: number | null
          ownership_percentage: number | null
          role: string | null
          song_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          band_id: string
          created_at?: string | null
          id?: string
          is_active_member?: boolean | null
          original_percentage?: number | null
          ownership_percentage?: number | null
          role?: string | null
          song_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          band_id?: string
          created_at?: string | null
          id?: string
          is_active_member?: boolean | null
          original_percentage?: number | null
          ownership_percentage?: number | null
          role?: string | null
          song_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_song_ownership_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_song_ownership_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "band_song_ownership_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "band_song_ownership_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_song_ownership_song_id_fkey"
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
          condition_rating: number | null
          created_at: string
          equipment_name: string
          equipment_type: string
          id: string
          is_active: boolean | null
          notes: string | null
          power_draw: number | null
          purchase_cost: number | null
          purchase_date: string | null
          quality_rating: number
          size_units: number | null
          updated_at: string
        }
        Insert: {
          band_id: string
          condition?: string
          condition_rating?: number | null
          created_at?: string
          equipment_name: string
          equipment_type: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          power_draw?: number | null
          purchase_cost?: number | null
          purchase_date?: string | null
          quality_rating?: number
          size_units?: number | null
          updated_at?: string
        }
        Update: {
          band_id?: string
          condition?: string
          condition_rating?: number | null
          created_at?: string
          equipment_name?: string
          equipment_type?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          power_draw?: number | null
          purchase_cost?: number | null
          purchase_date?: string | null
          quality_rating?: number
          size_units?: number | null
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
      band_vehicles: {
        Row: {
          band_id: string
          breakdown_risk: number | null
          capacity_units: number | null
          comfort_rating: number | null
          condition_percent: number | null
          created_at: string | null
          id: string
          is_leased: boolean | null
          is_owned: boolean | null
          last_maintenance_km: number | null
          lease_payments_made: number | null
          lease_payments_total: number | null
          name: string
          purchase_date: string | null
          rental_daily_cost: number | null
          rental_end_date: string | null
          rental_start_date: string | null
          speed_modifier: number | null
          total_km_traveled: number | null
          updated_at: string | null
          vehicle_catalog_id: string | null
          vehicle_type: string
        }
        Insert: {
          band_id: string
          breakdown_risk?: number | null
          capacity_units?: number | null
          comfort_rating?: number | null
          condition_percent?: number | null
          created_at?: string | null
          id?: string
          is_leased?: boolean | null
          is_owned?: boolean | null
          last_maintenance_km?: number | null
          lease_payments_made?: number | null
          lease_payments_total?: number | null
          name: string
          purchase_date?: string | null
          rental_daily_cost?: number | null
          rental_end_date?: string | null
          rental_start_date?: string | null
          speed_modifier?: number | null
          total_km_traveled?: number | null
          updated_at?: string | null
          vehicle_catalog_id?: string | null
          vehicle_type?: string
        }
        Update: {
          band_id?: string
          breakdown_risk?: number | null
          capacity_units?: number | null
          comfort_rating?: number | null
          condition_percent?: number | null
          created_at?: string | null
          id?: string
          is_leased?: boolean | null
          is_owned?: boolean | null
          last_maintenance_km?: number | null
          lease_payments_made?: number | null
          lease_payments_total?: number | null
          name?: string
          purchase_date?: string | null
          rental_daily_cost?: number | null
          rental_end_date?: string | null
          rental_start_date?: string | null
          speed_modifier?: number | null
          total_km_traveled?: number | null
          updated_at?: string | null
          vehicle_catalog_id?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_vehicles_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_vehicles_vehicle_catalog_id_fkey"
            columns: ["vehicle_catalog_id"]
            isOneToOne: false
            referencedRelation: "vehicle_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      bands: {
        Row: {
          allow_applications: boolean | null
          artist_name: string | null
          band_balance: number | null
          casual_fans: number | null
          chemistry_level: number | null
          cohesion_score: number | null
          collective_fame_earned: number | null
          created_at: string | null
          days_together: number | null
          dedicated_fans: number | null
          description: string | null
          fame: number | null
          fame_multiplier: number | null
          genre: string | null
          global_fame: number | null
          hiatus_ends_at: string | null
          hiatus_notification_sent: boolean | null
          hiatus_reason: string | null
          hiatus_started_at: string | null
          hidden_skill_rating: number | null
          home_city_id: string | null
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
          regional_fame: Json | null
          sound_description: string | null
          status: Database["public"]["Enums"]["band_status"]
          superfans: number | null
          total_fans: number | null
          updated_at: string | null
          weekly_fans: number | null
        }
        Insert: {
          allow_applications?: boolean | null
          artist_name?: string | null
          band_balance?: number | null
          casual_fans?: number | null
          chemistry_level?: number | null
          cohesion_score?: number | null
          collective_fame_earned?: number | null
          created_at?: string | null
          days_together?: number | null
          dedicated_fans?: number | null
          description?: string | null
          fame?: number | null
          fame_multiplier?: number | null
          genre?: string | null
          global_fame?: number | null
          hiatus_ends_at?: string | null
          hiatus_notification_sent?: boolean | null
          hiatus_reason?: string | null
          hiatus_started_at?: string | null
          hidden_skill_rating?: number | null
          home_city_id?: string | null
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
          regional_fame?: Json | null
          sound_description?: string | null
          status?: Database["public"]["Enums"]["band_status"]
          superfans?: number | null
          total_fans?: number | null
          updated_at?: string | null
          weekly_fans?: number | null
        }
        Update: {
          allow_applications?: boolean | null
          artist_name?: string | null
          band_balance?: number | null
          casual_fans?: number | null
          chemistry_level?: number | null
          cohesion_score?: number | null
          collective_fame_earned?: number | null
          created_at?: string | null
          days_together?: number | null
          dedicated_fans?: number | null
          description?: string | null
          fame?: number | null
          fame_multiplier?: number | null
          genre?: string | null
          global_fame?: number | null
          hiatus_ends_at?: string | null
          hiatus_notification_sent?: boolean | null
          hiatus_reason?: string | null
          hiatus_started_at?: string | null
          hidden_skill_rating?: number | null
          home_city_id?: string | null
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
          regional_fame?: Json | null
          sound_description?: string | null
          status?: Database["public"]["Enums"]["band_status"]
          superfans?: number | null
          total_fans?: number | null
          updated_at?: string | null
          weekly_fans?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bands_home_city_id_fkey"
            columns: ["home_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      character_generations: {
        Row: {
          created_at: string | null
          generation_number: number | null
          id: string
          inherited_cash: number | null
          inherited_skills: Json | null
          parent_character_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          generation_number?: number | null
          id?: string
          inherited_cash?: number | null
          inherited_skills?: Json | null
          parent_character_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          generation_number?: number | null
          id?: string
          inherited_cash?: number | null
          inherited_skills?: Json | null
          parent_character_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_generations_parent_character_id_fkey"
            columns: ["parent_character_id"]
            isOneToOne: false
            referencedRelation: "hall_of_fame"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_entries: {
        Row: {
          chart_date: string | null
          chart_type: string
          combined_score: number | null
          country: string | null
          created_at: string | null
          entry_type: string | null
          genre: string | null
          id: string
          plays_count: number | null
          rank: number
          release_id: string | null
          sale_type: string | null
          song_id: string
          trend: string | null
          trend_change: number | null
          weekly_plays: number | null
          weeks_on_chart: number | null
        }
        Insert: {
          chart_date?: string | null
          chart_type: string
          combined_score?: number | null
          country?: string | null
          created_at?: string | null
          entry_type?: string | null
          genre?: string | null
          id?: string
          plays_count?: number | null
          rank: number
          release_id?: string | null
          sale_type?: string | null
          song_id: string
          trend?: string | null
          trend_change?: number | null
          weekly_plays?: number | null
          weeks_on_chart?: number | null
        }
        Update: {
          chart_date?: string | null
          chart_type?: string
          combined_score?: number | null
          country?: string | null
          created_at?: string | null
          entry_type?: string | null
          genre?: string | null
          id?: string
          plays_count?: number | null
          rank?: number
          release_id?: string | null
          sale_type?: string | null
          song_id?: string
          trend?: string | null
          trend_change?: number | null
          weekly_plays?: number | null
          weeks_on_chart?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_entries_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "chart_albums"
            referencedColumns: ["release_id"]
          },
          {
            foreignKeyName: "chart_entries_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_entries_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "chart_entries_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "chart_entries_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_entries_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_featured_songs: {
        Row: {
          band_id: string | null
          chart_position: number
          chart_type: string
          created_at: string
          extended_generated: boolean | null
          featured_week: string
          id: string
          notes: string | null
          released_to_streaming: boolean | null
          song_id: string | null
          streaming_release_date: string | null
          updated_at: string
        }
        Insert: {
          band_id?: string | null
          chart_position: number
          chart_type: string
          created_at?: string
          extended_generated?: boolean | null
          featured_week: string
          id?: string
          notes?: string | null
          released_to_streaming?: boolean | null
          song_id?: string | null
          streaming_release_date?: string | null
          updated_at?: string
        }
        Update: {
          band_id?: string | null
          chart_position?: number
          chart_type?: string
          created_at?: string
          extended_generated?: boolean | null
          featured_week?: string
          id?: string
          notes?: string | null
          released_to_streaming?: boolean | null
          song_id?: string | null
          streaming_release_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_featured_songs_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_featured_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "chart_featured_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "chart_featured_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_featured_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_number_one_streaks: {
        Row: {
          band_id: string | null
          chart_type: string
          created_at: string | null
          ended_at: string | null
          id: string
          is_active: boolean | null
          song_id: string | null
          started_at: string
          streak_days: number | null
          updated_at: string | null
        }
        Insert: {
          band_id?: string | null
          chart_type: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          song_id?: string | null
          started_at: string
          streak_days?: number | null
          updated_at?: string | null
        }
        Update: {
          band_id?: string | null
          chart_type?: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          song_id?: string | null
          started_at?: string
          streak_days?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_number_one_streaks_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_number_one_streaks_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "chart_number_one_streaks_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "chart_number_one_streaks_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_number_one_streaks_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
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
          has_train_network: boolean | null
          id: string
          is_coastal: boolean | null
          latitude: number | null
          local_bonus: number | null
          longitude: number | null
          music_scene: number | null
          name: string
          population: number | null
          region: string | null
          timezone: string | null
          updated_at: string | null
          venues: number | null
        }
        Insert: {
          cost_of_living?: number | null
          country: string
          created_at?: string | null
          cultural_events?: string[] | null
          dominant_genre?: string | null
          has_train_network?: boolean | null
          id?: string
          is_coastal?: boolean | null
          latitude?: number | null
          local_bonus?: number | null
          longitude?: number | null
          music_scene?: number | null
          name: string
          population?: number | null
          region?: string | null
          timezone?: string | null
          updated_at?: string | null
          venues?: number | null
        }
        Update: {
          cost_of_living?: number | null
          country?: string
          created_at?: string | null
          cultural_events?: string[] | null
          dominant_genre?: string | null
          has_train_network?: boolean | null
          id?: string
          is_coastal?: boolean | null
          latitude?: number | null
          local_bonus?: number | null
          longitude?: number | null
          music_scene?: number | null
          name?: string
          population?: number | null
          region?: string | null
          timezone?: string | null
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
          albums_recorded: number | null
          available_slots: number | null
          city_id: string
          company_id: string | null
          console_type: string | null
          created_at: string | null
          daily_operating_cost: number | null
          district_id: string | null
          equipment_rating: number | null
          has_isolation_booths: number | null
          has_live_room: boolean | null
          hit_songs_recorded: number | null
          hourly_rate: number
          id: string
          is_company_owned: boolean | null
          mastering_capable: boolean | null
          max_tracks: number | null
          monthly_rent: number | null
          name: string
          quality_rating: number | null
          reputation: number | null
          sessions_completed: number | null
          specialties: string[] | null
          total_revenue: number | null
          total_sessions: number | null
        }
        Insert: {
          albums_recorded?: number | null
          available_slots?: number | null
          city_id: string
          company_id?: string | null
          console_type?: string | null
          created_at?: string | null
          daily_operating_cost?: number | null
          district_id?: string | null
          equipment_rating?: number | null
          has_isolation_booths?: number | null
          has_live_room?: boolean | null
          hit_songs_recorded?: number | null
          hourly_rate: number
          id?: string
          is_company_owned?: boolean | null
          mastering_capable?: boolean | null
          max_tracks?: number | null
          monthly_rent?: number | null
          name: string
          quality_rating?: number | null
          reputation?: number | null
          sessions_completed?: number | null
          specialties?: string[] | null
          total_revenue?: number | null
          total_sessions?: number | null
        }
        Update: {
          albums_recorded?: number | null
          available_slots?: number | null
          city_id?: string
          company_id?: string | null
          console_type?: string | null
          created_at?: string | null
          daily_operating_cost?: number | null
          district_id?: string | null
          equipment_rating?: number | null
          has_isolation_booths?: number | null
          has_live_room?: boolean | null
          hit_songs_recorded?: number | null
          hourly_rate?: number
          id?: string
          is_company_owned?: boolean | null
          mastering_capable?: boolean | null
          max_tracks?: number | null
          monthly_rent?: number | null
          name?: string
          quality_rating?: number | null
          reputation?: number | null
          sessions_completed?: number | null
          specialties?: string[] | null
          total_revenue?: number | null
          total_sessions?: number | null
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
            foreignKeyName: "city_studios_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      community_feed_posts: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          id: string
          is_spotlight: boolean | null
          metadata: Json | null
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_spotlight?: boolean | null
          metadata?: Json | null
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_spotlight?: boolean | null
          metadata?: Json | null
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_feed_posts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_feed_posts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      community_mentorship_goals: {
        Row: {
          created_at: string | null
          goal_text: string
          id: string
          match_id: string
          status: string | null
          target_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          goal_text: string
          id?: string
          match_id: string
          status?: string | null
          target_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          goal_text?: string
          id?: string
          match_id?: string
          status?: string | null
          target_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_mentorship_goals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "community_mentorship_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      community_mentorship_matches: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          match_date: string | null
          mentee_profile_id: string
          mentor_profile_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          match_date?: string | null
          mentee_profile_id: string
          mentor_profile_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          match_date?: string | null
          mentee_profile_id?: string
          mentor_profile_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_mentorship_matches_mentee_profile_id_fkey"
            columns: ["mentee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_mentorship_matches_mentee_profile_id_fkey"
            columns: ["mentee_profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_mentorship_matches_mentor_profile_id_fkey"
            columns: ["mentor_profile_id"]
            isOneToOne: false
            referencedRelation: "community_mentorship_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_mentorship_profiles: {
        Row: {
          availability_status: string | null
          created_at: string | null
          experience_level: string | null
          focus_areas: string[] | null
          headline: string | null
          id: string
          is_open_to_mentor: boolean | null
          mentor_capacity: number | null
          mentorship_style: string | null
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          availability_status?: string | null
          created_at?: string | null
          experience_level?: string | null
          focus_areas?: string[] | null
          headline?: string | null
          id?: string
          is_open_to_mentor?: boolean | null
          mentor_capacity?: number | null
          mentorship_style?: string | null
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          availability_status?: string | null
          created_at?: string | null
          experience_level?: string | null
          focus_areas?: string[] | null
          headline?: string | null
          id?: string
          is_open_to_mentor?: boolean | null
          mentor_capacity?: number | null
          mentorship_style?: string | null
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_mentorship_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_mentorship_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      community_service_assignments: {
        Row: {
          completed_sessions: number
          created_at: string
          deadline: string
          debt_amount: number
          id: string
          required_busking_sessions: number
          status: string
          user_id: string
        }
        Insert: {
          completed_sessions?: number
          created_at?: string
          deadline: string
          debt_amount: number
          id?: string
          required_busking_sessions?: number
          status?: string
          user_id: string
        }
        Update: {
          completed_sessions?: number
          created_at?: string
          deadline?: string
          debt_amount?: number
          id?: string
          required_busking_sessions?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          balance: number
          bankruptcy_date: string | null
          company_type: string
          created_at: string
          description: string | null
          founded_at: string
          headquarters_city_id: string | null
          id: string
          is_bankrupt: boolean
          logo_url: string | null
          name: string
          negative_balance_since: string | null
          owner_id: string
          parent_company_id: string | null
          reputation_score: number
          status: string
          updated_at: string
          weekly_operating_costs: number
        }
        Insert: {
          balance?: number
          bankruptcy_date?: string | null
          company_type: string
          created_at?: string
          description?: string | null
          founded_at?: string
          headquarters_city_id?: string | null
          id?: string
          is_bankrupt?: boolean
          logo_url?: string | null
          name: string
          negative_balance_since?: string | null
          owner_id: string
          parent_company_id?: string | null
          reputation_score?: number
          status?: string
          updated_at?: string
          weekly_operating_costs?: number
        }
        Update: {
          balance?: number
          bankruptcy_date?: string | null
          company_type?: string
          created_at?: string
          description?: string | null
          founded_at?: string
          headquarters_city_id?: string | null
          id?: string
          is_bankrupt?: boolean
          logo_url?: string | null
          name?: string
          negative_balance_since?: string | null
          owner_id?: string
          parent_company_id?: string | null
          reputation_score?: number
          status?: string
          updated_at?: string
          weekly_operating_costs?: number
        }
        Relationships: [
          {
            foreignKeyName: "companies_headquarters_city_id_fkey"
            columns: ["headquarters_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_employees: {
        Row: {
          company_id: string
          created_at: string
          hired_at: string
          id: string
          performance_rating: number | null
          profile_id: string
          role: string
          salary: number
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          hired_at?: string
          id?: string
          performance_rating?: number | null
          profile_id: string
          role: string
          salary?: number
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          hired_at?: string
          id?: string
          performance_rating?: number | null
          profile_id?: string
          role?: string
          salary?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      company_financial_reports: {
        Row: {
          capital_expenditure: number | null
          closing_balance: number | null
          company_id: string
          created_at: string | null
          employee_costs: number | null
          expense_breakdown: Json | null
          generated_at: string | null
          id: string
          net_profit: number | null
          opening_balance: number | null
          operating_costs: number | null
          report_period: string
          report_type: string
          revenue_breakdown: Json | null
          subsidiary_performance: Json | null
          total_expenses: number | null
          total_revenue: number | null
        }
        Insert: {
          capital_expenditure?: number | null
          closing_balance?: number | null
          company_id: string
          created_at?: string | null
          employee_costs?: number | null
          expense_breakdown?: Json | null
          generated_at?: string | null
          id?: string
          net_profit?: number | null
          opening_balance?: number | null
          operating_costs?: number | null
          report_period: string
          report_type?: string
          revenue_breakdown?: Json | null
          subsidiary_performance?: Json | null
          total_expenses?: number | null
          total_revenue?: number | null
        }
        Update: {
          capital_expenditure?: number | null
          closing_balance?: number | null
          company_id?: string
          created_at?: string | null
          employee_costs?: number | null
          expense_breakdown?: Json | null
          generated_at?: string | null
          id?: string
          net_profit?: number | null
          opening_balance?: number | null
          operating_costs?: number | null
          report_period?: string
          report_type?: string
          revenue_breakdown?: Json | null
          subsidiary_performance?: Json | null
          total_expenses?: number | null
          total_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_financial_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_goals: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string | null
          current_value: number | null
          deadline: string | null
          description: string | null
          goal_type: string
          id: string
          reward_type: string | null
          reward_value: number | null
          status: string | null
          target_value: number
          title: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type: string
          id?: string
          reward_type?: string | null
          reward_value?: number | null
          status?: string | null
          target_value: number
          title: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          reward_type?: string | null
          reward_value?: number | null
          status?: string | null
          target_value?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_internal_services: {
        Row: {
          company_id: string
          consumer_entity_id: string
          consumer_type: string
          created_at: string | null
          discount_applied: number | null
          final_cost: number
          id: string
          notes: string | null
          original_cost: number
          provider_entity_id: string
          provider_type: string
          service_date: string | null
          service_type: string
        }
        Insert: {
          company_id: string
          consumer_entity_id: string
          consumer_type: string
          created_at?: string | null
          discount_applied?: number | null
          final_cost: number
          id?: string
          notes?: string | null
          original_cost: number
          provider_entity_id: string
          provider_type: string
          service_date?: string | null
          service_type: string
        }
        Update: {
          company_id?: string
          consumer_entity_id?: string
          consumer_type?: string
          created_at?: string | null
          discount_applied?: number | null
          final_cost?: number
          id?: string
          notes?: string | null
          original_cost?: number
          provider_entity_id?: string
          provider_type?: string
          service_date?: string | null
          service_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_internal_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_kpis: {
        Row: {
          company_id: string
          created_at: string | null
          customer_satisfaction_avg: number | null
          growth_rate_monthly: number | null
          id: string
          liquidity_ratio: number | null
          market_share_estimate: number | null
          metric_date: string
          reputation_avg: number | null
          total_contracts_active: number | null
          total_contracts_completed: number | null
          total_employees: number | null
          total_subsidiaries: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          customer_satisfaction_avg?: number | null
          growth_rate_monthly?: number | null
          id?: string
          liquidity_ratio?: number | null
          market_share_estimate?: number | null
          metric_date?: string
          reputation_avg?: number | null
          total_contracts_active?: number | null
          total_contracts_completed?: number | null
          total_employees?: number | null
          total_subsidiaries?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          customer_satisfaction_avg?: number | null
          growth_rate_monthly?: number | null
          id?: string
          liquidity_ratio?: number | null
          market_share_estimate?: number | null
          metric_date?: string
          reputation_avg?: number | null
          total_contracts_active?: number | null
          total_contracts_completed?: number | null
          total_employees?: number | null
          total_subsidiaries?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_kpis_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_notifications: {
        Row: {
          company_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_dismissed: boolean | null
          is_read: boolean | null
          message: string | null
          notification_type: string
          priority: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message?: string | null
          notification_type: string
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message?: string | null
          notification_type?: string
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          allow_subsidiary_creation: boolean | null
          auto_pay_salaries: boolean | null
          company_id: string
          created_at: string | null
          dividend_payout_percent: number | null
          max_subsidiaries: number | null
          notification_threshold_critical: number | null
          notification_threshold_low: number | null
          reinvestment_percent: number | null
          updated_at: string | null
        }
        Insert: {
          allow_subsidiary_creation?: boolean | null
          auto_pay_salaries?: boolean | null
          company_id: string
          created_at?: string | null
          dividend_payout_percent?: number | null
          max_subsidiaries?: number | null
          notification_threshold_critical?: number | null
          notification_threshold_low?: number | null
          reinvestment_percent?: number | null
          updated_at?: string | null
        }
        Update: {
          allow_subsidiary_creation?: boolean | null
          auto_pay_salaries?: boolean | null
          company_id?: string
          created_at?: string | null
          dividend_payout_percent?: number | null
          max_subsidiaries?: number | null
          notification_threshold_critical?: number | null
          notification_threshold_low?: number | null
          reinvestment_percent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_synergies: {
        Row: {
          activated_at: string | null
          company_id: string
          created_at: string | null
          discount_percent: number | null
          id: string
          is_active: boolean | null
          requirements_met: boolean | null
          synergy_type: string
        }
        Insert: {
          activated_at?: string | null
          company_id: string
          created_at?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          requirements_met?: boolean | null
          synergy_type: string
        }
        Update: {
          activated_at?: string | null
          company_id?: string
          created_at?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          requirements_met?: boolean | null
          synergy_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_synergies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_transactions: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          description: string | null
          id: string
          related_entity_id: string | null
          related_entity_type: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_clauses: {
        Row: {
          clause_key: string
          contract_type: string
          created_at: string | null
          default_terms: Json | null
          description: string | null
          id: string
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          clause_key: string
          contract_type: string
          created_at?: string | null
          default_terms?: Json | null
          description?: string | null
          id?: string
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          clause_key?: string
          contract_type?: string
          created_at?: string | null
          default_terms?: Json | null
          description?: string | null
          id?: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contract_negotiations: {
        Row: {
          clause_id: string
          contract_id: string
          counter_terms: Json | null
          created_at: string | null
          id: string
          last_action_by: string | null
          proposed_terms: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          clause_id: string
          contract_id: string
          counter_terms?: Json | null
          created_at?: string | null
          id?: string
          last_action_by?: string | null
          proposed_terms?: Json | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          clause_id?: string
          contract_id?: string
          counter_terms?: Json | null
          created_at?: string | null
          id?: string
          last_action_by?: string | null
          proposed_terms?: Json | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_negotiations_clause_id_fkey"
            columns: ["clause_id"]
            isOneToOne: false
            referencedRelation: "contract_clauses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_negotiations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "artist_label_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_catalog: {
        Row: {
          assignment: string
          background: string
          city: string | null
          created_at: string
          experience: number
          focus: string
          headline: string
          hired_by_band_id: string | null
          id: string
          loyalty: number
          min_fame_required: number
          morale: string
          name: string
          openings: number
          role: string
          salary: number
          skill: number
          specialties: string[]
          star_rating: number
          traits: string[]
          updated_at: string
        }
        Insert: {
          assignment: string
          background: string
          city?: string | null
          created_at?: string
          experience: number
          focus: string
          headline: string
          hired_by_band_id?: string | null
          id: string
          loyalty: number
          min_fame_required?: number
          morale: string
          name: string
          openings?: number
          role: string
          salary: number
          skill: number
          specialties?: string[]
          star_rating?: number
          traits?: string[]
          updated_at?: string
        }
        Update: {
          assignment?: string
          background?: string
          city?: string | null
          created_at?: string
          experience?: number
          focus?: string
          headline?: string
          hired_by_band_id?: string | null
          id?: string
          loyalty?: number
          min_fame_required?: number
          morale?: string
          name?: string
          openings?: number
          role?: string
          salary?: number
          skill?: number
          specialties?: string[]
          star_rating?: number
          traits?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_catalog_hired_by_band_id_fkey"
            columns: ["hired_by_band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_job_config: {
        Row: {
          allow_manual_trigger: boolean | null
          created_at: string | null
          description: string | null
          display_name: string
          edge_function_name: string
          is_active: boolean | null
          job_name: string
          schedule: string
          updated_at: string | null
        }
        Insert: {
          allow_manual_trigger?: boolean | null
          created_at?: string | null
          description?: string | null
          display_name: string
          edge_function_name: string
          is_active?: boolean | null
          job_name: string
          schedule: string
          updated_at?: string | null
        }
        Update: {
          allow_manual_trigger?: boolean | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          edge_function_name?: string
          is_active?: boolean | null
          job_name?: string
          schedule?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cron_job_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_count: number | null
          error_message: string | null
          id: string
          job_name: string
          processed_count: number | null
          result_summary: Json | null
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_count?: number | null
          error_message?: string | null
          id?: string
          job_name: string
          processed_count?: number | null
          result_summary?: Json | null
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_count?: number | null
          error_message?: string | null
          id?: string
          job_name?: string
          processed_count?: number | null
          result_summary?: Json | null
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      crowd_animation_presets: {
        Row: {
          allowed_in_zones: string[] | null
          animation_clip_path: string | null
          created_at: string | null
          energy_level: number | null
          id: string
          intensity: number | null
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          allowed_in_zones?: string[] | null
          animation_clip_path?: string | null
          created_at?: string | null
          energy_level?: number | null
          id?: string
          intensity?: number | null
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          allowed_in_zones?: string[] | null
          animation_clip_path?: string | null
          created_at?: string | null
          energy_level?: number | null
          id?: string
          intensity?: number | null
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      crowd_instances: {
        Row: {
          animation_profile_id: string | null
          created_at: string | null
          crowd_zone: string
          density: number | null
          id: string
          max_instances: number | null
          metadata: Json | null
          stage_template_id: string | null
          updated_at: string | null
        }
        Insert: {
          animation_profile_id?: string | null
          created_at?: string | null
          crowd_zone: string
          density?: number | null
          id?: string
          max_instances?: number | null
          metadata?: Json | null
          stage_template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          animation_profile_id?: string | null
          created_at?: string | null
          crowd_zone?: string
          density?: number | null
          id?: string
          max_instances?: number | null
          metadata?: Json | null
          stage_template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crowd_instances_animation_profile_id_fkey"
            columns: ["animation_profile_id"]
            isOneToOne: false
            referencedRelation: "crowd_animation_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crowd_instances_stage_template_id_fkey"
            columns: ["stage_template_id"]
            isOneToOne: false
            referencedRelation: "stage_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_tokens: {
        Row: {
          created_at: string | null
          current_price: number
          description: string | null
          id: string
          market_cap: number | null
          name: string
          price_history: Json | null
          symbol: string
          updated_at: string | null
          volume_24h: number | null
        }
        Insert: {
          created_at?: string | null
          current_price?: number
          description?: string | null
          id?: string
          market_cap?: number | null
          name: string
          price_history?: Json | null
          symbol: string
          updated_at?: string | null
          volume_24h?: number | null
        }
        Update: {
          created_at?: string | null
          current_price?: number
          description?: string | null
          id?: string
          market_cap?: number | null
          name?: string
          price_history?: Json | null
          symbol?: string
          updated_at?: string | null
          volume_24h?: number | null
        }
        Relationships: []
      }
      demo_submissions: {
        Row: {
          artist_profile_id: string | null
          band_id: string | null
          contract_offer_id: string | null
          created_at: string | null
          id: string
          label_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          song_id: string
          status: string | null
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          artist_profile_id?: string | null
          band_id?: string | null
          contract_offer_id?: string | null
          created_at?: string | null
          id?: string
          label_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          song_id: string
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          artist_profile_id?: string | null
          band_id?: string | null
          contract_offer_id?: string | null
          created_at?: string | null
          id?: string
          label_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          song_id?: string
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_submissions_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_submissions_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_submissions_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_submissions_contract_offer_fk"
            columns: ["contract_offer_id"]
            isOneToOne: false
            referencedRelation: "artist_label_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_submissions_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_submissions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "demo_submissions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "demo_submissions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_submissions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      dikcok_challenge_entries: {
        Row: {
          band_id: string
          challenge_id: string
          created_at: string | null
          id: string
          score: number | null
          video_id: string
        }
        Insert: {
          band_id: string
          challenge_id: string
          created_at?: string | null
          id?: string
          score?: number | null
          video_id: string
        }
        Update: {
          band_id?: string
          challenge_id?: string
          created_at?: string | null
          id?: string
          score?: number | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dikcok_challenge_entries_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dikcok_challenge_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "dikcok_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dikcok_challenge_entries_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "dikcok_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      dikcok_challenges: {
        Row: {
          created_at: string | null
          cross_game_hook: string | null
          ends_at: string
          id: string
          is_active: boolean | null
          name: string
          requirements: string[] | null
          rewards: string[] | null
          sponsor: string | null
          starts_at: string
          theme: string
        }
        Insert: {
          created_at?: string | null
          cross_game_hook?: string | null
          ends_at: string
          id?: string
          is_active?: boolean | null
          name: string
          requirements?: string[] | null
          rewards?: string[] | null
          sponsor?: string | null
          starts_at: string
          theme: string
        }
        Update: {
          created_at?: string | null
          cross_game_hook?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          requirements?: string[] | null
          rewards?: string[] | null
          sponsor?: string | null
          starts_at?: string
          theme?: string
        }
        Relationships: []
      }
      dikcok_comments: {
        Row: {
          body: string
          created_at: string | null
          id: string
          likes: number | null
          user_id: string
          video_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          likes?: number | null
          user_id: string
          video_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          likes?: number | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dikcok_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "dikcok_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      dikcok_fan_missions: {
        Row: {
          band_id: string
          created_at: string | null
          description: string
          expires_at: string
          id: string
          is_completed: boolean | null
          mission_type: string
          rewards: string[] | null
          target_count: number | null
        }
        Insert: {
          band_id: string
          created_at?: string | null
          description: string
          expires_at: string
          id?: string
          is_completed?: boolean | null
          mission_type: string
          rewards?: string[] | null
          target_count?: number | null
        }
        Update: {
          band_id?: string
          created_at?: string | null
          description?: string
          expires_at?: string
          id?: string
          is_completed?: boolean | null
          mission_type?: string
          rewards?: string[] | null
          target_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dikcok_fan_missions_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      dikcok_forecasts: {
        Row: {
          confidence: number | null
          created_at: string | null
          expires_at: string
          id: string
          prediction_window: string
          projected_outcome: string
          trend_tag: string
          wager_range: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          expires_at: string
          id?: string
          prediction_window: string
          projected_outcome: string
          trend_tag: string
          wager_range?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          prediction_window?: string
          projected_outcome?: string
          trend_tag?: string
          wager_range?: string | null
        }
        Relationships: []
      }
      dikcok_reactions: {
        Row: {
          created_at: string | null
          id: string
          reaction_type: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reaction_type: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reaction_type?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dikcok_reactions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "dikcok_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      dikcok_video_types: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          difficulty: string
          duration_hint: string | null
          id: string
          name: string
          signature_effects: string[] | null
          unlock_requirement: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          difficulty: string
          duration_hint?: string | null
          id?: string
          name: string
          signature_effects?: string[] | null
          unlock_requirement?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          difficulty?: string
          duration_hint?: string | null
          id?: string
          name?: string
          signature_effects?: string[] | null
          unlock_requirement?: string | null
        }
        Relationships: []
      }
      dikcok_videos: {
        Row: {
          band_id: string
          best_for_feeds: string[] | null
          created_at: string | null
          creator_user_id: string
          description: string | null
          engagement_velocity: string | null
          fan_gain: number | null
          hype_gained: number | null
          id: string
          title: string
          track_id: string | null
          trending_tag: string | null
          updated_at: string | null
          video_type_id: string
          views: number | null
        }
        Insert: {
          band_id: string
          best_for_feeds?: string[] | null
          created_at?: string | null
          creator_user_id: string
          description?: string | null
          engagement_velocity?: string | null
          fan_gain?: number | null
          hype_gained?: number | null
          id?: string
          title: string
          track_id?: string | null
          trending_tag?: string | null
          updated_at?: string | null
          video_type_id: string
          views?: number | null
        }
        Update: {
          band_id?: string
          best_for_feeds?: string[] | null
          created_at?: string | null
          creator_user_id?: string
          description?: string | null
          engagement_velocity?: string | null
          fan_gain?: number | null
          hype_gained?: number | null
          id?: string
          title?: string
          track_id?: string | null
          trending_tag?: string | null
          updated_at?: string | null
          video_type_id?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dikcok_videos_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dikcok_videos_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "dikcok_videos_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "dikcok_videos_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dikcok_videos_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dikcok_videos_video_type_id_fkey"
            columns: ["video_type_id"]
            isOneToOne: false
            referencedRelation: "dikcok_video_types"
            referencedColumns: ["id"]
          },
        ]
      }
      education_mentors: {
        Row: {
          attribute_keys: Json
          available_seasons: string[] | null
          base_xp: number
          bonus_description: string | null
          cooldown_hours: number
          cost: number
          created_at: string
          current_students: number | null
          description: string
          difficulty: string
          focus_skill: string
          id: string
          is_active: boolean
          max_students: number | null
          name: string
          required_skill_value: number
          skill_gain_ratio: number
          specialty: string
          updated_at: string
        }
        Insert: {
          attribute_keys?: Json
          available_seasons?: string[] | null
          base_xp?: number
          bonus_description?: string | null
          cooldown_hours?: number
          cost?: number
          created_at?: string
          current_students?: number | null
          description: string
          difficulty?: string
          focus_skill: string
          id?: string
          is_active?: boolean
          max_students?: number | null
          name: string
          required_skill_value?: number
          skill_gain_ratio?: number
          specialty: string
          updated_at?: string
        }
        Update: {
          attribute_keys?: Json
          available_seasons?: string[] | null
          base_xp?: number
          bonus_description?: string | null
          cooldown_hours?: number
          cost?: number
          created_at?: string
          current_students?: number | null
          description?: string
          difficulty?: string
          focus_skill?: string
          id?: string
          is_active?: boolean
          max_students?: number | null
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
      equipment_3d_models: {
        Row: {
          color_accent: string | null
          color_primary: string | null
          color_secondary: string | null
          created_at: string | null
          equipment_id: string
          id: string
          model_type: string
          rarity_effect: string | null
          shape_config: Json | null
          updated_at: string | null
        }
        Insert: {
          color_accent?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          created_at?: string | null
          equipment_id: string
          id?: string
          model_type: string
          rarity_effect?: string | null
          shape_config?: Json | null
          updated_at?: string | null
        }
        Update: {
          color_accent?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          created_at?: string | null
          equipment_id?: string
          id?: string
          model_type?: string
          rarity_effect?: string | null
          shape_config?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_3d_models_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: true
            referencedRelation: "equipment_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_catalog: {
        Row: {
          base_price: number
          brand: string | null
          category: string
          created_at: string | null
          description: string | null
          durability: number | null
          id: string
          image_url: string | null
          is_available: boolean | null
          max_stock: number | null
          model: string | null
          name: string
          quality_rating: number | null
          rarity: string | null
          required_level: number | null
          stat_boosts: Json | null
          stock_quantity: number | null
          subcategory: string | null
          updated_at: string | null
        }
        Insert: {
          base_price: number
          brand?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          durability?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          max_stock?: number | null
          model?: string | null
          name: string
          quality_rating?: number | null
          rarity?: string | null
          required_level?: number | null
          stat_boosts?: Json | null
          stock_quantity?: number | null
          subcategory?: string | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          brand?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          durability?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          max_stock?: number | null
          model?: string | null
          name?: string
          quality_rating?: number | null
          rarity?: string | null
          required_level?: number | null
          stat_boosts?: Json | null
          stock_quantity?: number | null
          subcategory?: string | null
          updated_at?: string | null
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
          stock: number | null
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
          stock?: number | null
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
          stock?: number | null
          subcategory?: string | null
        }
        Relationships: []
      }
      eurovision_entries: {
        Row: {
          band_id: string
          country: string
          created_at: string
          event_id: string
          final_rank: number | null
          id: string
          song_id: string
          vote_count: number
        }
        Insert: {
          band_id: string
          country: string
          created_at?: string
          event_id: string
          final_rank?: number | null
          id?: string
          song_id: string
          vote_count?: number
        }
        Update: {
          band_id?: string
          country?: string
          created_at?: string
          event_id?: string
          final_rank?: number | null
          id?: string
          song_id?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "eurovision_entries_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eurovision_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "eurovision_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eurovision_entries_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "eurovision_entries_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "eurovision_entries_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eurovision_entries_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      eurovision_events: {
        Row: {
          created_at: string
          host_city: string | null
          host_country: string | null
          id: string
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          host_city?: string | null
          host_country?: string | null
          id?: string
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          host_city?: string | null
          host_country?: string | null
          id?: string
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      eurovision_votes: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          voter_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eurovision_votes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "eurovision_entries"
            referencedColumns: ["id"]
          },
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
      fan_campaigns: {
        Row: {
          band_id: string | null
          budget: number | null
          campaign_name: string
          campaign_type: string
          cost_per_fan: number | null
          created_at: string | null
          end_date: string
          engagement_rate: number | null
          id: string
          new_fans: number | null
          reach: number | null
          start_date: string
          status: string | null
          target_audience: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          band_id?: string | null
          budget?: number | null
          campaign_name: string
          campaign_type: string
          cost_per_fan?: number | null
          created_at?: string | null
          end_date: string
          engagement_rate?: number | null
          id?: string
          new_fans?: number | null
          reach?: number | null
          start_date: string
          status?: string | null
          target_audience?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          band_id?: string | null
          budget?: number | null
          campaign_name?: string
          campaign_type?: string
          cost_per_fan?: number | null
          created_at?: string | null
          end_date?: string
          engagement_rate?: number | null
          id?: string
          new_fans?: number | null
          reach?: number | null
          start_date?: string
          status?: string | null
          target_audience?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fan_campaigns_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
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
      fan_interactions: {
        Row: {
          created_at: string | null
          fan_id: string | null
          id: string
          interaction_data: Json | null
          interaction_type: string
          sentiment: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          fan_id?: string | null
          id?: string
          interaction_data?: Json | null
          interaction_type: string
          sentiment?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          fan_id?: string | null
          id?: string
          interaction_data?: Json | null
          interaction_type?: string
          sentiment?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fan_segments: {
        Row: {
          avg_engagement: number | null
          created_at: string | null
          fan_count: number | null
          id: string
          segment_criteria: Json
          segment_name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avg_engagement?: number | null
          created_at?: string | null
          fan_count?: number | null
          id?: string
          segment_criteria: Json
          segment_name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avg_engagement?: number | null
          created_at?: string | null
          fan_count?: number | null
          id?: string
          segment_criteria?: Json
          segment_name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      festival_participants: {
        Row: {
          band_id: string
          created_at: string | null
          event_id: string
          id: string
          payout_amount: number | null
          performance_date: string | null
          slot_type: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          band_id: string
          created_at?: string | null
          event_id: string
          id?: string
          payout_amount?: number | null
          performance_date?: string | null
          slot_type: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          band_id?: string
          created_at?: string | null
          event_id?: string
          id?: string
          payout_amount?: number | null
          performance_date?: string | null
          slot_type?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_participants_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "game_events"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_revenue_streams: {
        Row: {
          amount: number | null
          created_at: string | null
          event_id: string
          id: string
          stream_type: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          event_id: string
          id?: string
          stream_type: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          event_id?: string
          id?: string
          stream_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "festival_revenue_streams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "game_events"
            referencedColumns: ["id"]
          },
        ]
      }
      film_productions: {
        Row: {
          compensation_max: number | null
          compensation_min: number | null
          created_at: string | null
          description: string | null
          fame_boost: number | null
          fan_boost: number | null
          film_type: string | null
          filming_duration_days: number | null
          genre: string | null
          id: string
          is_available: boolean | null
          min_fame_required: number | null
          studio_id: string | null
          title: string
        }
        Insert: {
          compensation_max?: number | null
          compensation_min?: number | null
          created_at?: string | null
          description?: string | null
          fame_boost?: number | null
          fan_boost?: number | null
          film_type?: string | null
          filming_duration_days?: number | null
          genre?: string | null
          id?: string
          is_available?: boolean | null
          min_fame_required?: number | null
          studio_id?: string | null
          title: string
        }
        Update: {
          compensation_max?: number | null
          compensation_min?: number | null
          created_at?: string | null
          description?: string | null
          fame_boost?: number | null
          fan_boost?: number | null
          film_type?: string | null
          filming_duration_days?: number | null
          genre?: string | null
          id?: string
          is_available?: boolean | null
          min_fame_required?: number | null
          studio_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_productions_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "film_studios"
            referencedColumns: ["id"]
          },
        ]
      }
      film_studios: {
        Row: {
          country: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          min_fame_required: number | null
          name: string
          prestige_level: number | null
          studio_type: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          min_fame_required?: number | null
          name: string
          prestige_level?: number | null
          studio_type?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          min_fame_required?: number | null
          name?: string
          prestige_level?: number | null
          studio_type?: string | null
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
      game_activity_logs: {
        Row: {
          activity_category: string
          activity_type: string
          after_state: Json | null
          amount: number | null
          band_id: string | null
          before_state: Json | null
          created_at: string | null
          description: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          activity_category: string
          activity_type: string
          after_state?: Json | null
          amount?: number | null
          band_id?: string | null
          before_state?: Json | null
          created_at?: string | null
          description: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          activity_category?: string
          activity_type?: string
          after_state?: Json | null
          amount?: number | null
          band_id?: string | null
          before_state?: Json | null
          created_at?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_activity_logs_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      game_balance_config: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          max_value: number | null
          min_value: number | null
          unit: string | null
          updated_at: string
          value: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          max_value?: number | null
          min_value?: number | null
          unit?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          max_value?: number | null
          min_value?: number | null
          unit?: string | null
          updated_at?: string
          value?: number
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
      gettit_comment_votes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
          vote_type: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gettit_comment_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "gettit_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_comment_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_comment_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      gettit_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          downvotes: number | null
          id: string
          is_deleted: boolean | null
          parent_id: string | null
          post_id: string
          updated_at: string
          upvotes: number | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          downvotes?: number | null
          id?: string
          is_deleted?: boolean | null
          parent_id?: string | null
          post_id: string
          updated_at?: string
          upvotes?: number | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          downvotes?: number | null
          id?: string
          is_deleted?: boolean | null
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gettit_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "gettit_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "gettit_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      gettit_post_votes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gettit_post_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "gettit_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_post_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_post_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      gettit_posts: {
        Row: {
          author_id: string
          comment_count: number | null
          content: string | null
          created_at: string
          downvotes: number | null
          flair: string | null
          id: string
          is_pinned: boolean | null
          media_url: string | null
          subreddit_id: string | null
          title: string
          updated_at: string
          upvotes: number | null
        }
        Insert: {
          author_id: string
          comment_count?: number | null
          content?: string | null
          created_at?: string
          downvotes?: number | null
          flair?: string | null
          id?: string
          is_pinned?: boolean | null
          media_url?: string | null
          subreddit_id?: string | null
          title: string
          updated_at?: string
          upvotes?: number | null
        }
        Update: {
          author_id?: string
          comment_count?: number | null
          content?: string | null
          created_at?: string
          downvotes?: number | null
          flair?: string | null
          id?: string
          is_pinned?: boolean | null
          media_url?: string | null
          subreddit_id?: string | null
          title?: string
          updated_at?: string
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gettit_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_posts_subreddit_id_fkey"
            columns: ["subreddit_id"]
            isOneToOne: false
            referencedRelation: "gettit_subreddits"
            referencedColumns: ["id"]
          },
        ]
      }
      gettit_subreddit_members: {
        Row: {
          id: string
          joined_at: string
          role: string | null
          subreddit_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string | null
          subreddit_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string | null
          subreddit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gettit_subreddit_members_subreddit_id_fkey"
            columns: ["subreddit_id"]
            isOneToOne: false
            referencedRelation: "gettit_subreddits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_subreddit_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_subreddit_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      gettit_subreddits: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          icon: string | null
          id: string
          is_nsfw: boolean | null
          is_official: boolean | null
          member_count: number | null
          name: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_nsfw?: boolean | null
          is_official?: boolean | null
          member_count?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_nsfw?: boolean | null
          is_official?: boolean | null
          member_count?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gettit_subreddits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gettit_subreddits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_analytics: {
        Row: {
          compared_to_previous: Json | null
          created_at: string | null
          crowd_reaction_highlights: string[] | null
          energy_curve: Json | null
          gig_id: string | null
          id: string
          mishap_events: Json | null
          performance_breakdown: Json | null
          social_buzz_count: number | null
          twaater_sentiment: number | null
        }
        Insert: {
          compared_to_previous?: Json | null
          created_at?: string | null
          crowd_reaction_highlights?: string[] | null
          energy_curve?: Json | null
          gig_id?: string | null
          id?: string
          mishap_events?: Json | null
          performance_breakdown?: Json | null
          social_buzz_count?: number | null
          twaater_sentiment?: number | null
        }
        Update: {
          compared_to_previous?: Json | null
          created_at?: string | null
          crowd_reaction_highlights?: string[] | null
          energy_curve?: Json | null
          gig_id?: string | null
          id?: string
          mishap_events?: Json | null
          performance_breakdown?: Json | null
          social_buzz_count?: number | null
          twaater_sentiment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gig_analytics_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_crowd_sounds: {
        Row: {
          audio_url: string
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          intensity_level: number | null
          is_active: boolean | null
          name: string
          sound_type: string
          updated_at: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          intensity_level?: number | null
          is_active?: boolean | null
          name: string
          sound_type: string
          updated_at?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          intensity_level?: number | null
          is_active?: boolean | null
          name?: string
          sound_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gig_fan_conversions: {
        Row: {
          attendance_count: number
          band_id: string
          conversion_rate: number | null
          created_at: string
          fan_demographics: Json | null
          gig_id: string
          id: string
          new_fans_gained: number
          repeat_fans: number
          superfans_converted: number
        }
        Insert: {
          attendance_count?: number
          band_id: string
          conversion_rate?: number | null
          created_at?: string
          fan_demographics?: Json | null
          gig_id: string
          id?: string
          new_fans_gained?: number
          repeat_fans?: number
          superfans_converted?: number
        }
        Update: {
          attendance_count?: number
          band_id?: string
          conversion_rate?: number | null
          created_at?: string
          fan_demographics?: Json | null
          gig_id?: string
          id?: string
          new_fans_gained?: number
          repeat_fans?: number
          superfans_converted?: number
        }
        Relationships: [
          {
            foreignKeyName: "gig_fan_conversions_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_fan_conversions_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: true
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_milestones: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          milestone_type: string
          name: string
          threshold_value: number
          xp_reward: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          milestone_type: string
          name: string
          threshold_value: number
          xp_reward?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          milestone_type?: string
          name?: string
          threshold_value?: number
          xp_reward?: number
        }
        Relationships: []
      }
      gig_offers: {
        Row: {
          band_id: string | null
          base_payout: number | null
          created_at: string | null
          expires_at: string
          id: string
          metadata: Json | null
          offer_reason: string | null
          offered_date: string
          promoter_id: string | null
          slot_type: string | null
          status: string | null
          ticket_price: number | null
          venue_id: string | null
        }
        Insert: {
          band_id?: string | null
          base_payout?: number | null
          created_at?: string | null
          expires_at: string
          id?: string
          metadata?: Json | null
          offer_reason?: string | null
          offered_date: string
          promoter_id?: string | null
          slot_type?: string | null
          status?: string | null
          ticket_price?: number | null
          venue_id?: string | null
        }
        Update: {
          band_id?: string | null
          base_payout?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          offer_reason?: string | null
          offered_date?: string
          promoter_id?: string | null
          slot_type?: string | null
          status?: string | null
          ticket_price?: number | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gig_offers_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_offers_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "promoters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_offers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_outcomes: {
        Row: {
          actual_attendance: number
          attendance_percentage: number | null
          audience_memory_impact: number | null
          band_chemistry_level: number | null
          band_id: string | null
          band_synergy_modifier: number | null
          casual_fans_gained: number | null
          chemistry_change: number | null
          completed_at: string | null
          created_at: string | null
          crew_cost: number
          crew_skill_avg: number | null
          crowd_energy_peak: number | null
          dedicated_fans_gained: number | null
          equipment_cost: number
          equipment_quality_avg: number | null
          fame_gained: number | null
          fan_conversions: number | null
          gig_id: string
          highlight_moments: Json | null
          id: string
          member_skill_avg: number | null
          merch_items_sold: number | null
          merch_revenue: number
          net_profit: number
          new_followers: number | null
          overall_rating: number | null
          performance_grade: string | null
          promoter_modifier: number | null
          repeat_attendees: number | null
          skill_performance_avg: number | null
          social_buzz_impact: number | null
          superfans_gained: number | null
          ticket_revenue: number
          total_costs: number
          total_revenue: number
          total_xp_awarded: number | null
          venue_capacity: number | null
          venue_cost: number
          venue_id: string | null
          venue_loyalty_bonus: number | null
          venue_name: string | null
          xp_breakdown: Json | null
        }
        Insert: {
          actual_attendance: number
          attendance_percentage?: number | null
          audience_memory_impact?: number | null
          band_chemistry_level?: number | null
          band_id?: string | null
          band_synergy_modifier?: number | null
          casual_fans_gained?: number | null
          chemistry_change?: number | null
          completed_at?: string | null
          created_at?: string | null
          crew_cost?: number
          crew_skill_avg?: number | null
          crowd_energy_peak?: number | null
          dedicated_fans_gained?: number | null
          equipment_cost?: number
          equipment_quality_avg?: number | null
          fame_gained?: number | null
          fan_conversions?: number | null
          gig_id: string
          highlight_moments?: Json | null
          id?: string
          member_skill_avg?: number | null
          merch_items_sold?: number | null
          merch_revenue?: number
          net_profit?: number
          new_followers?: number | null
          overall_rating?: number | null
          performance_grade?: string | null
          promoter_modifier?: number | null
          repeat_attendees?: number | null
          skill_performance_avg?: number | null
          social_buzz_impact?: number | null
          superfans_gained?: number | null
          ticket_revenue?: number
          total_costs?: number
          total_revenue?: number
          total_xp_awarded?: number | null
          venue_capacity?: number | null
          venue_cost?: number
          venue_id?: string | null
          venue_loyalty_bonus?: number | null
          venue_name?: string | null
          xp_breakdown?: Json | null
        }
        Update: {
          actual_attendance?: number
          attendance_percentage?: number | null
          audience_memory_impact?: number | null
          band_chemistry_level?: number | null
          band_id?: string | null
          band_synergy_modifier?: number | null
          casual_fans_gained?: number | null
          chemistry_change?: number | null
          completed_at?: string | null
          created_at?: string | null
          crew_cost?: number
          crew_skill_avg?: number | null
          crowd_energy_peak?: number | null
          dedicated_fans_gained?: number | null
          equipment_cost?: number
          equipment_quality_avg?: number | null
          fame_gained?: number | null
          fan_conversions?: number | null
          gig_id?: string
          highlight_moments?: Json | null
          id?: string
          member_skill_avg?: number | null
          merch_items_sold?: number | null
          merch_revenue?: number
          net_profit?: number
          new_followers?: number | null
          overall_rating?: number | null
          performance_grade?: string | null
          promoter_modifier?: number | null
          repeat_attendees?: number | null
          skill_performance_avg?: number | null
          social_buzz_impact?: number | null
          superfans_gained?: number | null
          ticket_revenue?: number
          total_costs?: number
          total_revenue?: number
          total_xp_awarded?: number | null
          venue_capacity?: number | null
          venue_cost?: number
          venue_id?: string | null
          venue_loyalty_bonus?: number | null
          venue_name?: string | null
          xp_breakdown?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "gig_outcomes_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_outcomes_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_outcomes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
      gig_rider_fulfillment: {
        Row: {
          backstage_fulfillment: number | null
          created_at: string | null
          fulfillment_percentage: number | null
          gig_id: string
          hospitality_fulfillment: number | null
          id: string
          items_fulfilled: Json | null
          items_missing: Json | null
          items_substituted: Json | null
          morale_modifier: number | null
          negotiation_notes: string | null
          performance_modifier: number | null
          rider_id: string | null
          technical_fulfillment: number | null
          total_rider_cost: number | null
          updated_at: string | null
        }
        Insert: {
          backstage_fulfillment?: number | null
          created_at?: string | null
          fulfillment_percentage?: number | null
          gig_id: string
          hospitality_fulfillment?: number | null
          id?: string
          items_fulfilled?: Json | null
          items_missing?: Json | null
          items_substituted?: Json | null
          morale_modifier?: number | null
          negotiation_notes?: string | null
          performance_modifier?: number | null
          rider_id?: string | null
          technical_fulfillment?: number | null
          total_rider_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          backstage_fulfillment?: number | null
          created_at?: string | null
          fulfillment_percentage?: number | null
          gig_id?: string
          hospitality_fulfillment?: number | null
          id?: string
          items_fulfilled?: Json | null
          items_missing?: Json | null
          items_substituted?: Json | null
          morale_modifier?: number | null
          negotiation_notes?: string | null
          performance_modifier?: number | null
          rider_id?: string | null
          technical_fulfillment?: number | null
          total_rider_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gig_rider_fulfillment_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: true
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_rider_fulfillment_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "band_riders"
            referencedColumns: ["id"]
          },
        ]
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
          item_type: string | null
          member_skill_contrib: number | null
          performance_item_id: string | null
          performance_item_name: string | null
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
          item_type?: string | null
          member_skill_contrib?: number | null
          performance_item_id?: string | null
          performance_item_name?: string | null
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
          item_type?: string | null
          member_skill_contrib?: number | null
          performance_item_id?: string | null
          performance_item_name?: string | null
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
            foreignKeyName: "gig_song_performances_performance_item_id_fkey"
            columns: ["performance_item_id"]
            isOneToOne: false
            referencedRelation: "performance_items"
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "gig_song_performances_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
      gig_stage_instances: {
        Row: {
          created_at: string | null
          crowd_mood_weights: Json | null
          gig_id: string | null
          id: string
          metadata: Json | null
          performance_quality: number | null
          stage_template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          crowd_mood_weights?: Json | null
          gig_id?: string | null
          id?: string
          metadata?: Json | null
          performance_quality?: number | null
          stage_template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          crowd_mood_weights?: Json | null
          gig_id?: string | null
          id?: string
          metadata?: Json | null
          performance_quality?: number | null
          stage_template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gig_stage_instances_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: true
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_stage_instances_stage_template_id_fkey"
            columns: ["stage_template_id"]
            isOneToOne: false
            referencedRelation: "stage_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      gigs: {
        Row: {
          attendance: number | null
          band_id: string
          booking_fee: number | null
          completed_at: string | null
          created_at: string | null
          crowd_engagement: number | null
          current_song_position: number | null
          estimated_attendance: number | null
          estimated_revenue: number | null
          failure_reason: string | null
          fan_gain: number | null
          id: string
          last_ticket_update: string | null
          payment: number | null
          performance_calculation: Json | null
          pre_gig_forecast: Json | null
          predicted_tickets: number | null
          promoter_id: string | null
          rider_id: string | null
          scheduled_date: string
          setlist_duration_minutes: number | null
          setlist_id: string | null
          setlist_quality_score: number | null
          show_type: string | null
          slot_attendance_multiplier: number | null
          slot_end_time: string | null
          slot_start_time: string | null
          slot_type: string | null
          started_at: string | null
          status: string | null
          ticket_price: number | null
          tickets_sold: number | null
          time_slot: string | null
          tour_id: string | null
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          attendance?: number | null
          band_id: string
          booking_fee?: number | null
          completed_at?: string | null
          created_at?: string | null
          crowd_engagement?: number | null
          current_song_position?: number | null
          estimated_attendance?: number | null
          estimated_revenue?: number | null
          failure_reason?: string | null
          fan_gain?: number | null
          id?: string
          last_ticket_update?: string | null
          payment?: number | null
          performance_calculation?: Json | null
          pre_gig_forecast?: Json | null
          predicted_tickets?: number | null
          promoter_id?: string | null
          rider_id?: string | null
          scheduled_date: string
          setlist_duration_minutes?: number | null
          setlist_id?: string | null
          setlist_quality_score?: number | null
          show_type?: string | null
          slot_attendance_multiplier?: number | null
          slot_end_time?: string | null
          slot_start_time?: string | null
          slot_type?: string | null
          started_at?: string | null
          status?: string | null
          ticket_price?: number | null
          tickets_sold?: number | null
          time_slot?: string | null
          tour_id?: string | null
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          attendance?: number | null
          band_id?: string
          booking_fee?: number | null
          completed_at?: string | null
          created_at?: string | null
          crowd_engagement?: number | null
          current_song_position?: number | null
          estimated_attendance?: number | null
          estimated_revenue?: number | null
          failure_reason?: string | null
          fan_gain?: number | null
          id?: string
          last_ticket_update?: string | null
          payment?: number | null
          performance_calculation?: Json | null
          pre_gig_forecast?: Json | null
          predicted_tickets?: number | null
          promoter_id?: string | null
          rider_id?: string | null
          scheduled_date?: string
          setlist_duration_minutes?: number | null
          setlist_id?: string | null
          setlist_quality_score?: number | null
          show_type?: string | null
          slot_attendance_multiplier?: number | null
          slot_end_time?: string | null
          slot_start_time?: string | null
          slot_type?: string | null
          started_at?: string | null
          status?: string | null
          ticket_price?: number | null
          tickets_sold?: number | null
          time_slot?: string | null
          tour_id?: string | null
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
            foreignKeyName: "gigs_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "promoters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gigs_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "band_riders"
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
            foreignKeyName: "gigs_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
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
      hall_of_fame: {
        Row: {
          avatar_url: string | null
          character_name: string
          final_age: number
          final_attributes: Json | null
          final_skills: Json | null
          generation_number: number | null
          id: string
          notable_achievements: Json | null
          peak_chart_position: number | null
          retired_at: string | null
          retirement_type: string | null
          total_albums: number | null
          total_cash_earned: number | null
          total_fame: number | null
          total_gigs: number | null
          total_songs: number | null
          user_id: string | null
          years_active: number
        }
        Insert: {
          avatar_url?: string | null
          character_name: string
          final_age: number
          final_attributes?: Json | null
          final_skills?: Json | null
          generation_number?: number | null
          id?: string
          notable_achievements?: Json | null
          peak_chart_position?: number | null
          retired_at?: string | null
          retirement_type?: string | null
          total_albums?: number | null
          total_cash_earned?: number | null
          total_fame?: number | null
          total_gigs?: number | null
          total_songs?: number | null
          user_id?: string | null
          years_active: number
        }
        Update: {
          avatar_url?: string | null
          character_name?: string
          final_age?: number
          final_attributes?: Json | null
          final_skills?: Json | null
          generation_number?: number | null
          id?: string
          notable_achievements?: Json | null
          peak_chart_position?: number | null
          retired_at?: string | null
          retirement_type?: string | null
          total_albums?: number | null
          total_cash_earned?: number | null
          total_fame?: number | null
          total_gigs?: number | null
          total_songs?: number | null
          user_id?: string | null
          years_active?: number
        }
        Relationships: []
      }
      hospitals: {
        Row: {
          city_id: string
          cost_per_day: number
          created_at: string
          description: string | null
          effectiveness_rating: number
          id: string
          is_free: boolean
          name: string
          updated_at: string
        }
        Insert: {
          city_id: string
          cost_per_day?: number
          created_at?: string
          description?: string | null
          effectiveness_rating?: number
          id?: string
          is_free?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          city_id?: string
          cost_per_day?: number
          created_at?: string
          description?: string | null
          effectiveness_rating?: number
          id?: string
          is_free?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospitals_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: true
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      jam_gifted_song_log: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          session_id: string
          song_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          session_id: string
          song_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          session_id?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jam_gifted_song_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_gifted_song_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_gifted_song_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "jam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_gifted_song_log_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "jam_gifted_song_log_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "jam_gifted_song_log_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_gifted_song_log_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      jam_session_chat: {
        Row: {
          created_at: string | null
          id: string
          message: string
          message_type: string | null
          profile_id: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          message_type?: string | null
          profile_id: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          message_type?: string | null
          profile_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jam_session_chat_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_chat_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_chat_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "jam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      jam_session_commentary: {
        Row: {
          commentary: string
          created_at: string | null
          event_type: string
          id: string
          is_important: boolean | null
          participant_id: string | null
          session_id: string
        }
        Insert: {
          commentary: string
          created_at?: string | null
          event_type: string
          id?: string
          is_important?: boolean | null
          participant_id?: string | null
          session_id: string
        }
        Update: {
          commentary?: string
          created_at?: string | null
          event_type?: string
          id?: string
          is_important?: boolean | null
          participant_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jam_session_commentary_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_commentary_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_commentary_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "jam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      jam_session_messages: {
        Row: {
          created_at: string | null
          id: string
          jam_session_id: string
          message: string
          sender_profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          jam_session_id: string
          message: string
          sender_profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          jam_session_id?: string
          message?: string
          sender_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jam_session_messages_jam_session_id_fkey"
            columns: ["jam_session_id"]
            isOneToOne: false
            referencedRelation: "jam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      jam_session_outcomes: {
        Row: {
          chemistry_gained: number
          created_at: string
          gifted_song_id: string | null
          id: string
          participant_id: string
          performance_rating: number | null
          session_id: string
          skill_slug: string | null
          skill_xp_gained: number
          xp_earned: number
        }
        Insert: {
          chemistry_gained?: number
          created_at?: string
          gifted_song_id?: string | null
          id?: string
          participant_id: string
          performance_rating?: number | null
          session_id: string
          skill_slug?: string | null
          skill_xp_gained?: number
          xp_earned?: number
        }
        Update: {
          chemistry_gained?: number
          created_at?: string
          gifted_song_id?: string | null
          id?: string
          participant_id?: string
          performance_rating?: number | null
          session_id?: string
          skill_slug?: string | null
          skill_xp_gained?: number
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "jam_session_outcomes_gifted_song_id_fkey"
            columns: ["gifted_song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "jam_session_outcomes_gifted_song_id_fkey"
            columns: ["gifted_song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "jam_session_outcomes_gifted_song_id_fkey"
            columns: ["gifted_song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_outcomes_gifted_song_id_fkey"
            columns: ["gifted_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_outcomes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_outcomes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_outcomes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "jam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      jam_session_participants: {
        Row: {
          co_play_count: number | null
          cost_paid: number | null
          id: string
          instrument_skill_slug: string | null
          is_ready: boolean | null
          jam_session_id: string
          joined_at: string | null
          left_at: string | null
          participation_percentage: number | null
          profile_id: string
          reward_multiplier: number | null
          skill_tier: string | null
          updated_at: string | null
        }
        Insert: {
          co_play_count?: number | null
          cost_paid?: number | null
          id?: string
          instrument_skill_slug?: string | null
          is_ready?: boolean | null
          jam_session_id: string
          joined_at?: string | null
          left_at?: string | null
          participation_percentage?: number | null
          profile_id: string
          reward_multiplier?: number | null
          skill_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          co_play_count?: number | null
          cost_paid?: number | null
          id?: string
          instrument_skill_slug?: string | null
          is_ready?: boolean | null
          jam_session_id?: string
          joined_at?: string | null
          left_at?: string | null
          participation_percentage?: number | null
          profile_id?: string
          reward_multiplier?: number | null
          skill_tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jam_session_participants_jam_session_id_fkey"
            columns: ["jam_session_id"]
            isOneToOne: false
            referencedRelation: "jam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_session_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      jam_sessions: {
        Row: {
          access_code: string | null
          city_id: string | null
          completed_at: string | null
          cost_per_participant: number | null
          created_at: string | null
          creator_profile_id: string | null
          current_participants: number
          description: string | null
          duration_hours: number | null
          genre: string
          gifted_song_id: string | null
          host_id: string
          id: string
          is_private: boolean
          max_participants: number
          mood_score: number | null
          name: string
          participant_ids: string[] | null
          rehearsal_room_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          skill_requirement: number
          started_at: string | null
          status: string
          synergy_score: number | null
          tempo: number
          total_cost: number | null
          total_xp_awarded: number | null
          updated_at: string | null
        }
        Insert: {
          access_code?: string | null
          city_id?: string | null
          completed_at?: string | null
          cost_per_participant?: number | null
          created_at?: string | null
          creator_profile_id?: string | null
          current_participants?: number
          description?: string | null
          duration_hours?: number | null
          genre: string
          gifted_song_id?: string | null
          host_id: string
          id?: string
          is_private?: boolean
          max_participants?: number
          mood_score?: number | null
          name: string
          participant_ids?: string[] | null
          rehearsal_room_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          skill_requirement?: number
          started_at?: string | null
          status?: string
          synergy_score?: number | null
          tempo?: number
          total_cost?: number | null
          total_xp_awarded?: number | null
          updated_at?: string | null
        }
        Update: {
          access_code?: string | null
          city_id?: string | null
          completed_at?: string | null
          cost_per_participant?: number | null
          created_at?: string | null
          creator_profile_id?: string | null
          current_participants?: number
          description?: string | null
          duration_hours?: number | null
          genre?: string
          gifted_song_id?: string | null
          host_id?: string
          id?: string
          is_private?: boolean
          max_participants?: number
          mood_score?: number | null
          name?: string
          participant_ids?: string[] | null
          rehearsal_room_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          skill_requirement?: number
          started_at?: string | null
          status?: string
          synergy_score?: number | null
          tempo?: number
          total_cost?: number | null
          total_xp_awarded?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jam_sessions_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_sessions_creator_profile_id_fkey"
            columns: ["creator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_sessions_creator_profile_id_fkey"
            columns: ["creator_profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_sessions_gifted_song_id_fkey"
            columns: ["gifted_song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "jam_sessions_gifted_song_id_fkey"
            columns: ["gifted_song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "jam_sessions_gifted_song_id_fkey"
            columns: ["gifted_song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_sessions_gifted_song_id_fkey"
            columns: ["gifted_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jam_sessions_rehearsal_room_id_fkey"
            columns: ["rehearsal_room_id"]
            isOneToOne: false
            referencedRelation: "rehearsal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          base_fame_impact: number | null
          category: string
          city_id: string | null
          company_name: string
          created_at: string | null
          current_employees: number | null
          description: string | null
          end_time: string
          energy_cost_per_shift: number | null
          fame_impact_per_shift: number | null
          fame_penalty_tier: string | null
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
          base_fame_impact?: number | null
          category: string
          city_id?: string | null
          company_name: string
          created_at?: string | null
          current_employees?: number | null
          description?: string | null
          end_time: string
          energy_cost_per_shift?: number | null
          fame_impact_per_shift?: number | null
          fame_penalty_tier?: string | null
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
          base_fame_impact?: number | null
          category?: string
          city_id?: string | null
          company_name?: string
          created_at?: string | null
          current_employees?: number | null
          description?: string | null
          end_time?: string
          energy_cost_per_shift?: number | null
          fame_impact_per_shift?: number | null
          fame_penalty_tier?: string | null
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
        Relationships: [
          {
            foreignKeyName: "jobs_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      label_deal_types: {
        Row: {
          advance_max: number | null
          advance_min: number | null
          created_at: string | null
          default_artist_royalty: number | null
          default_label_royalty: number | null
          default_release_quota: number | null
          default_term_months: number | null
          description: string | null
          id: string
          includes_advance: boolean | null
          masters_owned_by_artist: boolean | null
          name: string
          royalty_artist_pct: number
        }
        Insert: {
          advance_max?: number | null
          advance_min?: number | null
          created_at?: string | null
          default_artist_royalty?: number | null
          default_label_royalty?: number | null
          default_release_quota?: number | null
          default_term_months?: number | null
          description?: string | null
          id?: string
          includes_advance?: boolean | null
          masters_owned_by_artist?: boolean | null
          name: string
          royalty_artist_pct: number
        }
        Update: {
          advance_max?: number | null
          advance_min?: number | null
          created_at?: string | null
          default_artist_royalty?: number | null
          default_label_royalty?: number | null
          default_release_quota?: number | null
          default_term_months?: number | null
          description?: string | null
          id?: string
          includes_advance?: boolean | null
          masters_owned_by_artist?: boolean | null
          name?: string
          royalty_artist_pct?: number
        }
        Relationships: []
      }
      label_distribution_deals: {
        Row: {
          advance_amount: number | null
          created_at: string
          deal_type: string
          distributor_name: string
          end_date: string | null
          id: string
          is_active: boolean | null
          label_id: string | null
          minimum_releases: number | null
          revenue_share_pct: number
          start_date: string
          territories: string[] | null
          updated_at: string
        }
        Insert: {
          advance_amount?: number | null
          created_at?: string
          deal_type: string
          distributor_name: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          label_id?: string | null
          minimum_releases?: number | null
          revenue_share_pct: number
          start_date?: string
          territories?: string[] | null
          updated_at?: string
        }
        Update: {
          advance_amount?: number | null
          created_at?: string
          deal_type?: string
          distributor_name?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          label_id?: string | null
          minimum_releases?: number | null
          revenue_share_pct?: number
          start_date?: string
          territories?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_distribution_deals_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      label_financial_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          label_id: string | null
          related_band_id: string | null
          related_contract_id: string | null
          related_release_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          label_id?: string | null
          related_band_id?: string | null
          related_contract_id?: string | null
          related_release_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          label_id?: string | null
          related_band_id?: string | null
          related_contract_id?: string | null
          related_release_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_financial_transactions_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_financial_transactions_related_band_id_fkey"
            columns: ["related_band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_financial_transactions_related_contract_id_fkey"
            columns: ["related_contract_id"]
            isOneToOne: false
            referencedRelation: "artist_label_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_financial_transactions_related_release_id_fkey"
            columns: ["related_release_id"]
            isOneToOne: false
            referencedRelation: "chart_albums"
            referencedColumns: ["release_id"]
          },
          {
            foreignKeyName: "label_financial_transactions_related_release_id_fkey"
            columns: ["related_release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      label_promotion_campaigns: {
        Row: {
          budget: number
          campaign_type: string
          channels: string[] | null
          created_at: string | null
          effectiveness: number | null
          end_date: string
          id: string
          notes: string | null
          release_id: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          budget: number
          campaign_type: string
          channels?: string[] | null
          created_at?: string | null
          effectiveness?: number | null
          end_date: string
          id?: string
          notes?: string | null
          release_id: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          budget?: number
          campaign_type?: string
          channels?: string[] | null
          created_at?: string | null
          effectiveness?: number | null
          end_date?: string
          id?: string
          notes?: string | null
          release_id?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "label_promotion_campaigns_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "label_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      label_releases: {
        Row: {
          contract_id: string
          created_at: string | null
          id: string
          marketing_budget: number | null
          masters_cost: number | null
          notes: string | null
          promotion_budget: number | null
          release_date: string | null
          release_id: string | null
          release_type: string | null
          revenue_generated: number | null
          scheduled_date: string | null
          status: string | null
          territory_strategy: string | null
          title: string
          units_sold: number | null
          updated_at: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          id?: string
          marketing_budget?: number | null
          masters_cost?: number | null
          notes?: string | null
          promotion_budget?: number | null
          release_date?: string | null
          release_id?: string | null
          release_type?: string | null
          revenue_generated?: number | null
          scheduled_date?: string | null
          status?: string | null
          territory_strategy?: string | null
          title: string
          units_sold?: number | null
          updated_at?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          id?: string
          marketing_budget?: number | null
          masters_cost?: number | null
          notes?: string | null
          promotion_budget?: number | null
          release_date?: string | null
          release_id?: string | null
          release_type?: string | null
          revenue_generated?: number | null
          scheduled_date?: string | null
          status?: string | null
          territory_strategy?: string | null
          title?: string
          units_sold?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "label_releases_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "artist_label_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_releases_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "chart_albums"
            referencedColumns: ["release_id"]
          },
          {
            foreignKeyName: "label_releases_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      label_roster_slots: {
        Row: {
          contract_id: string | null
          created_at: string | null
          focus_genre: string | null
          id: string
          label_id: string
          slot_number: number
          status: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          focus_genre?: string | null
          id?: string
          label_id: string
          slot_number: number
          status?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          focus_genre?: string | null
          id?: string
          label_id?: string
          slot_number?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "label_roster_slots_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      label_royalty_statements: {
        Row: {
          advance_deduction: number | null
          artist_share: number
          contract_id: string
          created_at: string | null
          gross_revenue: number
          id: string
          label_share: number
          net_payout: number
          paid: boolean | null
          paid_at: string | null
          period_end: string
          period_start: string
          release_id: string | null
        }
        Insert: {
          advance_deduction?: number | null
          artist_share: number
          contract_id: string
          created_at?: string | null
          gross_revenue: number
          id?: string
          label_share: number
          net_payout: number
          paid?: boolean | null
          paid_at?: string | null
          period_end: string
          period_start: string
          release_id?: string | null
        }
        Update: {
          advance_deduction?: number | null
          artist_share?: number
          contract_id?: string
          created_at?: string | null
          gross_revenue?: number
          id?: string
          label_share?: number
          net_payout?: number
          paid?: boolean | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          release_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "label_royalty_statements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "artist_label_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_royalty_statements_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "label_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      label_staff: {
        Row: {
          created_at: string
          hired_at: string
          id: string
          label_id: string | null
          name: string
          performance_rating: number | null
          role: string
          salary_monthly: number
          skill_level: number
          specialty_genre: string | null
        }
        Insert: {
          created_at?: string
          hired_at?: string
          id?: string
          label_id?: string | null
          name: string
          performance_rating?: number | null
          role: string
          salary_monthly?: number
          skill_level?: number
          specialty_genre?: string | null
        }
        Update: {
          created_at?: string
          hired_at?: string
          id?: string
          label_id?: string | null
          name?: string
          performance_rating?: number | null
          role?: string
          salary_monthly?: number
          skill_level?: number
          specialty_genre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "label_staff_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      label_territories: {
        Row: {
          created_at: string | null
          id: string
          label_id: string
          territory_code: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label_id: string
          territory_code: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label_id?: string
          territory_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_territories_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_territories_territory_code_fkey"
            columns: ["territory_code"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["code"]
          },
        ]
      }
      label_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          initiated_by: string | null
          label_id: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          initiated_by?: string | null
          label_id: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          initiated_by?: string | null
          label_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_transactions_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_transactions_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_transactions_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      label_upgrades: {
        Row: {
          id: string
          label_id: string
          purchased_at: string | null
          upgrade_level: number | null
          upgrade_type: string
        }
        Insert: {
          id?: string
          label_id: string
          purchased_at?: string | null
          upgrade_level?: number | null
          upgrade_type: string
        }
        Update: {
          id?: string
          label_id?: string
          purchased_at?: string | null
          upgrade_level?: number | null
          upgrade_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_upgrades_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          a_and_r_budget: number | null
          advance_pool: number | null
          balance: number | null
          balance_went_negative_at: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          distribution_cut_pct: number | null
          distribution_deal: string | null
          genre_focus: string[] | null
          headquarters_city: string | null
          headquarters_city_id: string | null
          id: string
          is_bankrupt: boolean | null
          is_subsidiary: boolean | null
          logo_url: string | null
          market_share: number | null
          marketing_budget: number | null
          monthly_overhead: number | null
          name: string
          operating_budget: number | null
          owner_id: string | null
          reputation_score: number | null
          roster_slot_capacity: number | null
          royalty_default_pct: number | null
          total_expenses_lifetime: number | null
          total_revenue_lifetime: number | null
          updated_at: string | null
        }
        Insert: {
          a_and_r_budget?: number | null
          advance_pool?: number | null
          balance?: number | null
          balance_went_negative_at?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          distribution_cut_pct?: number | null
          distribution_deal?: string | null
          genre_focus?: string[] | null
          headquarters_city?: string | null
          headquarters_city_id?: string | null
          id?: string
          is_bankrupt?: boolean | null
          is_subsidiary?: boolean | null
          logo_url?: string | null
          market_share?: number | null
          marketing_budget?: number | null
          monthly_overhead?: number | null
          name: string
          operating_budget?: number | null
          owner_id?: string | null
          reputation_score?: number | null
          roster_slot_capacity?: number | null
          royalty_default_pct?: number | null
          total_expenses_lifetime?: number | null
          total_revenue_lifetime?: number | null
          updated_at?: string | null
        }
        Update: {
          a_and_r_budget?: number | null
          advance_pool?: number | null
          balance?: number | null
          balance_went_negative_at?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          distribution_cut_pct?: number | null
          distribution_deal?: string | null
          genre_focus?: string[] | null
          headquarters_city?: string | null
          headquarters_city_id?: string | null
          id?: string
          is_bankrupt?: boolean | null
          is_subsidiary?: boolean | null
          logo_url?: string | null
          market_share?: number | null
          marketing_budget?: number | null
          monthly_overhead?: number | null
          name?: string
          operating_budget?: number | null
          owner_id?: string | null
          reputation_score?: number | null
          roster_slot_capacity?: number | null
          royalty_default_pct?: number | null
          total_expenses_lifetime?: number | null
          total_revenue_lifetime?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labels_headquarters_city_id_fkey"
            columns: ["headquarters_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_badge_awards: {
        Row: {
          awarded_at: string
          badge_id: string
          created_at: string
          id: string
          metadata: Json | null
          profile_id: string | null
          rank: number | null
          season_id: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          rank?: number | null
          season_id?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          rank?: number | null
          season_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_badge_awards_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_badge_awards_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_badges: {
        Row: {
          code: string
          created_at: string
          criteria: Json | null
          description: string | null
          icon: string
          id: string
          name: string
          rarity: string
          season_id: string | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          criteria?: Json | null
          description?: string | null
          icon?: string
          id?: string
          name: string
          rarity?: string
          season_id?: string | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          criteria?: Json | null
          description?: string | null
          icon?: string
          id?: string
          name?: string
          rarity?: string
          season_id?: string | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_badges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_season_snapshots: {
        Row: {
          awarded_badges: string[] | null
          breakdown: Json | null
          created_at: string
          division: string
          experience: number | null
          fame: number | null
          final_rank: number | null
          final_score: number | null
          id: string
          instrument: string
          profile_id: string | null
          recorded_at: string
          region: string
          season_id: string
          tier: string | null
          total_achievements: number | null
          total_gigs: number | null
          total_revenue: number | null
          user_id: string | null
        }
        Insert: {
          awarded_badges?: string[] | null
          breakdown?: Json | null
          created_at?: string
          division: string
          experience?: number | null
          fame?: number | null
          final_rank?: number | null
          final_score?: number | null
          id?: string
          instrument: string
          profile_id?: string | null
          recorded_at?: string
          region: string
          season_id: string
          tier?: string | null
          total_achievements?: number | null
          total_gigs?: number | null
          total_revenue?: number | null
          user_id?: string | null
        }
        Update: {
          awarded_badges?: string[] | null
          breakdown?: Json | null
          created_at?: string
          division?: string
          experience?: number | null
          fame?: number | null
          final_rank?: number | null
          final_score?: number | null
          id?: string
          instrument?: string
          profile_id?: string | null
          recorded_at?: string
          region?: string
          season_id?: string
          tier?: string | null
          total_achievements?: number | null
          total_gigs?: number | null
          total_revenue?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_season_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_seasons: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          reward_pool: Json | null
          season_number: number | null
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          reward_pool?: Json | null
          season_number?: number | null
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          reward_pool?: Json | null
          season_number?: number | null
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      lifestyle_properties: {
        Row: {
          area_sq_ft: number | null
          available: boolean | null
          base_price: number
          bathrooms: number
          bedrooms: number
          city: string
          created_at: string | null
          description: string | null
          district: string | null
          energy_rating: string | null
          highlight_features: string[] | null
          id: string
          image_url: string | null
          lifestyle_fit: Json | null
          lot_size_sq_ft: number | null
          name: string
          property_type: string
          rating: number | null
          updated_at: string | null
        }
        Insert: {
          area_sq_ft?: number | null
          available?: boolean | null
          base_price: number
          bathrooms: number
          bedrooms: number
          city: string
          created_at?: string | null
          description?: string | null
          district?: string | null
          energy_rating?: string | null
          highlight_features?: string[] | null
          id?: string
          image_url?: string | null
          lifestyle_fit?: Json | null
          lot_size_sq_ft?: number | null
          name: string
          property_type: string
          rating?: number | null
          updated_at?: string | null
        }
        Update: {
          area_sq_ft?: number | null
          available?: boolean | null
          base_price?: number
          bathrooms?: number
          bedrooms?: number
          city?: string
          created_at?: string | null
          description?: string | null
          district?: string | null
          energy_rating?: string | null
          highlight_features?: string[] | null
          id?: string
          image_url?: string | null
          lifestyle_fit?: Json | null
          lot_size_sq_ft?: number | null
          name?: string
          property_type?: string
          rating?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lifestyle_property_features: {
        Row: {
          created_at: string | null
          description: string | null
          feature_name: string
          feature_type: string
          id: string
          impact: Json | null
          property_id: string
          upgrade_cost: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          feature_name: string
          feature_type: string
          id?: string
          impact?: Json | null
          property_id: string
          upgrade_cost?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          feature_name?: string
          feature_type?: string
          id?: string
          impact?: Json | null
          property_id?: string
          upgrade_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "lifestyle_property_features_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "lifestyle_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      lifestyle_property_financing_options: {
        Row: {
          closing_cost_pct: number | null
          created_at: string | null
          description: string | null
          down_payment_pct: number
          id: string
          interest_rate: number
          name: string
          property_id: string
          requirements: Json | null
          term_months: number
        }
        Insert: {
          closing_cost_pct?: number | null
          created_at?: string | null
          description?: string | null
          down_payment_pct: number
          id?: string
          interest_rate: number
          name: string
          property_id: string
          requirements?: Json | null
          term_months: number
        }
        Update: {
          closing_cost_pct?: number | null
          created_at?: string | null
          description?: string | null
          down_payment_pct?: number
          id?: string
          interest_rate?: number
          name?: string
          property_id?: string
          requirements?: Json | null
          term_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "lifestyle_property_financing_options_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "lifestyle_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      lifestyle_property_purchases: {
        Row: {
          created_at: string | null
          financing_option_id: string | null
          id: string
          notes: string | null
          property_id: string
          purchase_price: number
          selected_features: Json | null
          status: string | null
          total_upgrade_cost: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          financing_option_id?: string | null
          id?: string
          notes?: string | null
          property_id: string
          purchase_price: number
          selected_features?: Json | null
          status?: string | null
          total_upgrade_cost?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          financing_option_id?: string | null
          id?: string
          notes?: string | null
          property_id?: string
          purchase_price?: number
          selected_features?: Json | null
          status?: string | null
          total_upgrade_cost?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifestyle_property_purchases_financing_option_id_fkey"
            columns: ["financing_option_id"]
            isOneToOne: false
            referencedRelation: "lifestyle_property_financing_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifestyle_property_purchases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "lifestyle_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_companies: {
        Row: {
          company_id: string
          created_at: string | null
          current_fleet_size: number | null
          fleet_capacity: number
          id: string
          insurance_coverage: number | null
          license_tier: number
          name: string
          on_time_delivery_rate: number | null
          operating_regions: string[] | null
          reputation: number | null
          service_quality_rating: number | null
          specializations: string[] | null
          total_contracts_completed: number | null
          total_distance_covered: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          current_fleet_size?: number | null
          fleet_capacity?: number
          id?: string
          insurance_coverage?: number | null
          license_tier?: number
          name: string
          on_time_delivery_rate?: number | null
          operating_regions?: string[] | null
          reputation?: number | null
          service_quality_rating?: number | null
          specializations?: string[] | null
          total_contracts_completed?: number | null
          total_distance_covered?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          current_fleet_size?: number | null
          fleet_capacity?: number
          id?: string
          insurance_coverage?: number | null
          license_tier?: number
          name?: string
          on_time_delivery_rate?: number | null
          operating_regions?: string[] | null
          reputation?: number | null
          service_quality_rating?: number | null
          specializations?: string[] | null
          total_contracts_completed?: number | null
          total_distance_covered?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logistics_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_contract_assignments: {
        Row: {
          actual_arrival: string | null
          actual_departure: string | null
          contract_id: string
          created_at: string | null
          delay_minutes: number | null
          destination_city_id: string | null
          distance_km: number | null
          driver_id: string
          fuel_cost: number | null
          id: string
          incident_notes: string | null
          leg_number: number | null
          origin_city_id: string | null
          scheduled_arrival: string | null
          scheduled_departure: string | null
          status: string | null
          toll_cost: number | null
          vehicle_id: string
        }
        Insert: {
          actual_arrival?: string | null
          actual_departure?: string | null
          contract_id: string
          created_at?: string | null
          delay_minutes?: number | null
          destination_city_id?: string | null
          distance_km?: number | null
          driver_id: string
          fuel_cost?: number | null
          id?: string
          incident_notes?: string | null
          leg_number?: number | null
          origin_city_id?: string | null
          scheduled_arrival?: string | null
          scheduled_departure?: string | null
          status?: string | null
          toll_cost?: number | null
          vehicle_id: string
        }
        Update: {
          actual_arrival?: string | null
          actual_departure?: string | null
          contract_id?: string
          created_at?: string | null
          delay_minutes?: number | null
          destination_city_id?: string | null
          distance_km?: number | null
          driver_id?: string
          fuel_cost?: number | null
          id?: string
          incident_notes?: string | null
          leg_number?: number | null
          origin_city_id?: string | null
          scheduled_arrival?: string | null
          scheduled_departure?: string | null
          status?: string | null
          toll_cost?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_contract_assignments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "logistics_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_contract_assignments_destination_city_id_fkey"
            columns: ["destination_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_contract_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "logistics_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_contract_assignments_origin_city_id_fkey"
            columns: ["origin_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_contract_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "logistics_fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_contracts: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          cargo_description: string | null
          cargo_value: number | null
          cargo_weight_kg: number | null
          client_band_id: string | null
          client_company_id: string | null
          client_rating: number | null
          company_rating: number | null
          contract_type: string
          created_at: string | null
          destination_city_id: string | null
          distance_km: number | null
          drivers_required: number | null
          end_date: string | null
          estimated_duration_hours: number | null
          fee_paid: number | null
          fee_quoted: number
          id: string
          logistics_company_id: string
          notes: string | null
          origin_city_id: string | null
          start_date: string | null
          status: string | null
          tour_id: string | null
          updated_at: string | null
          vehicles_required: number | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          cargo_description?: string | null
          cargo_value?: number | null
          cargo_weight_kg?: number | null
          client_band_id?: string | null
          client_company_id?: string | null
          client_rating?: number | null
          company_rating?: number | null
          contract_type: string
          created_at?: string | null
          destination_city_id?: string | null
          distance_km?: number | null
          drivers_required?: number | null
          end_date?: string | null
          estimated_duration_hours?: number | null
          fee_paid?: number | null
          fee_quoted: number
          id?: string
          logistics_company_id: string
          notes?: string | null
          origin_city_id?: string | null
          start_date?: string | null
          status?: string | null
          tour_id?: string | null
          updated_at?: string | null
          vehicles_required?: number | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          cargo_description?: string | null
          cargo_value?: number | null
          cargo_weight_kg?: number | null
          client_band_id?: string | null
          client_company_id?: string | null
          client_rating?: number | null
          company_rating?: number | null
          contract_type?: string
          created_at?: string | null
          destination_city_id?: string | null
          distance_km?: number | null
          drivers_required?: number | null
          end_date?: string | null
          estimated_duration_hours?: number | null
          fee_paid?: number | null
          fee_quoted?: number
          id?: string
          logistics_company_id?: string
          notes?: string | null
          origin_city_id?: string | null
          start_date?: string | null
          status?: string | null
          tour_id?: string | null
          updated_at?: string | null
          vehicles_required?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "logistics_contracts_client_band_id_fkey"
            columns: ["client_band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_contracts_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_contracts_destination_city_id_fkey"
            columns: ["destination_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_contracts_logistics_company_id_fkey"
            columns: ["logistics_company_id"]
            isOneToOne: false
            referencedRelation: "logistics_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_contracts_origin_city_id_fkey"
            columns: ["origin_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_contracts_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_drivers: {
        Row: {
          accidents: number | null
          created_at: string | null
          experience_years: number | null
          hired_at: string | null
          id: string
          is_npc: boolean | null
          license_type: string | null
          logistics_company_id: string
          name: string
          profile_id: string | null
          reliability_rating: number | null
          salary_per_day: number | null
          skill_level: number | null
          status: string | null
          total_km_driven: number | null
          total_trips_completed: number | null
          updated_at: string | null
        }
        Insert: {
          accidents?: number | null
          created_at?: string | null
          experience_years?: number | null
          hired_at?: string | null
          id?: string
          is_npc?: boolean | null
          license_type?: string | null
          logistics_company_id: string
          name: string
          profile_id?: string | null
          reliability_rating?: number | null
          salary_per_day?: number | null
          skill_level?: number | null
          status?: string | null
          total_km_driven?: number | null
          total_trips_completed?: number | null
          updated_at?: string | null
        }
        Update: {
          accidents?: number | null
          created_at?: string | null
          experience_years?: number | null
          hired_at?: string | null
          id?: string
          is_npc?: boolean | null
          license_type?: string | null
          logistics_company_id?: string
          name?: string
          profile_id?: string | null
          reliability_rating?: number | null
          salary_per_day?: number | null
          skill_level?: number | null
          status?: string | null
          total_km_driven?: number | null
          total_trips_completed?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logistics_drivers_logistics_company_id_fkey"
            columns: ["logistics_company_id"]
            isOneToOne: false
            referencedRelation: "logistics_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_fleet_vehicles: {
        Row: {
          assigned_driver_id: string | null
          capacity_units: number | null
          condition_percent: number | null
          created_at: string | null
          fuel_efficiency: number | null
          id: string
          last_maintenance_km: number | null
          logistics_company_id: string
          name: string
          next_maintenance_due: string | null
          purchase_cost: number | null
          purchase_date: string | null
          status: string | null
          total_km_traveled: number | null
          updated_at: string | null
          vehicle_catalog_id: string | null
          vehicle_type: string
        }
        Insert: {
          assigned_driver_id?: string | null
          capacity_units?: number | null
          condition_percent?: number | null
          created_at?: string | null
          fuel_efficiency?: number | null
          id?: string
          last_maintenance_km?: number | null
          logistics_company_id: string
          name: string
          next_maintenance_due?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          status?: string | null
          total_km_traveled?: number | null
          updated_at?: string | null
          vehicle_catalog_id?: string | null
          vehicle_type?: string
        }
        Update: {
          assigned_driver_id?: string | null
          capacity_units?: number | null
          condition_percent?: number | null
          created_at?: string | null
          fuel_efficiency?: number | null
          id?: string
          last_maintenance_km?: number | null
          logistics_company_id?: string
          name?: string
          next_maintenance_due?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          status?: string | null
          total_km_traveled?: number | null
          updated_at?: string | null
          vehicle_catalog_id?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_fleet_vehicles_logistics_company_id_fkey"
            columns: ["logistics_company_id"]
            isOneToOne: false
            referencedRelation: "logistics_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_fleet_vehicles_vehicle_catalog_id_fkey"
            columns: ["vehicle_catalog_id"]
            isOneToOne: false
            referencedRelation: "vehicle_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_transactions: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string | null
          description: string | null
          id: string
          logistics_company_id: string
          transaction_date: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          contract_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          logistics_company_id: string
          transaction_date?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          logistics_company_id?: string
          transaction_date?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "logistics_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_transactions_logistics_company_id_fkey"
            columns: ["logistics_company_id"]
            isOneToOne: false
            referencedRelation: "logistics_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_upgrades: {
        Row: {
          active: boolean | null
          cost: number
          created_at: string | null
          expires_at: string | null
          id: string
          logistics_company_id: string
          purchased_at: string | null
          upgrade_level: number | null
          upgrade_type: string
        }
        Insert: {
          active?: boolean | null
          cost: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          logistics_company_id: string
          purchased_at?: string | null
          upgrade_level?: number | null
          upgrade_type: string
        }
        Update: {
          active?: boolean | null
          cost?: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          logistics_company_id?: string
          purchased_at?: string | null
          upgrade_level?: number | null
          upgrade_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_upgrades_logistics_company_id_fkey"
            columns: ["logistics_company_id"]
            isOneToOne: false
            referencedRelation: "logistics_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      magazine_submissions: {
        Row: {
          band_id: string
          compensation: number | null
          completed_at: string | null
          created_at: string | null
          fame_boost: number | null
          fan_boost: number | null
          feature_type: string | null
          id: string
          magazine_id: string
          proposed_date: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          status: string | null
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          band_id: string
          compensation?: number | null
          completed_at?: string | null
          created_at?: string | null
          fame_boost?: number | null
          fan_boost?: number | null
          feature_type?: string | null
          id?: string
          magazine_id: string
          proposed_date?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          band_id?: string
          compensation?: number | null
          completed_at?: string | null
          created_at?: string | null
          fame_boost?: number | null
          fan_boost?: number | null
          feature_type?: string | null
          id?: string
          magazine_id?: string
          proposed_date?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magazine_submissions_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magazine_submissions_magazine_id_fkey"
            columns: ["magazine_id"]
            isOneToOne: false
            referencedRelation: "magazines"
            referencedColumns: ["id"]
          },
        ]
      }
      magazines: {
        Row: {
          compensation_max: number | null
          compensation_min: number | null
          country: string | null
          created_at: string | null
          description: string | null
          fame_boost_max: number | null
          fame_boost_min: number | null
          fan_boost_max: number | null
          fan_boost_min: number | null
          genres: string[] | null
          id: string
          interview_slots_per_issue: number | null
          is_active: boolean | null
          logo_url: string | null
          magazine_type: string | null
          min_fame_required: number | null
          name: string
          publication_frequency: string | null
          quality_level: number | null
          readership: number | null
        }
        Insert: {
          compensation_max?: number | null
          compensation_min?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          genres?: string[] | null
          id?: string
          interview_slots_per_issue?: number | null
          is_active?: boolean | null
          logo_url?: string | null
          magazine_type?: string | null
          min_fame_required?: number | null
          name: string
          publication_frequency?: string | null
          quality_level?: number | null
          readership?: number | null
        }
        Update: {
          compensation_max?: number | null
          compensation_min?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          genres?: string[] | null
          id?: string
          interview_slots_per_issue?: number | null
          is_active?: boolean | null
          logo_url?: string | null
          magazine_type?: string | null
          min_fame_required?: number | null
          name?: string
          publication_frequency?: string | null
          quality_level?: number | null
          readership?: number | null
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "marketplace_listings_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "marketplace_transactions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
      media_appearances: {
        Row: {
          air_date: string
          audience_reach: number | null
          band_id: string | null
          created_at: string | null
          highlight: string | null
          id: string
          media_type: string
          network: string
          program_name: string
          sentiment: string | null
        }
        Insert: {
          air_date: string
          audience_reach?: number | null
          band_id?: string | null
          created_at?: string | null
          highlight?: string | null
          id?: string
          media_type: string
          network: string
          program_name: string
          sentiment?: string | null
        }
        Update: {
          air_date?: string
          audience_reach?: number | null
          band_id?: string | null
          created_at?: string | null
          highlight?: string | null
          id?: string
          media_type?: string
          network?: string
          program_name?: string
          sentiment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_appearances_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      media_facilities: {
        Row: {
          city_id: string | null
          created_at: string | null
          facility_type: string
          id: string
          name: string
          reputation: number | null
          specialization: string | null
          sponsor_tier: string | null
          updated_at: string | null
          user_id: string | null
          weekly_cost: number | null
        }
        Insert: {
          city_id?: string | null
          created_at?: string | null
          facility_type: string
          id?: string
          name: string
          reputation?: number | null
          specialization?: string | null
          sponsor_tier?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_cost?: number | null
        }
        Update: {
          city_id?: string | null
          created_at?: string | null
          facility_type?: string
          id?: string
          name?: string
          reputation?: number | null
          specialization?: string | null
          sponsor_tier?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_facilities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      media_offers: {
        Row: {
          band_id: string | null
          compensation: number | null
          created_at: string | null
          expires_at: string | null
          id: string
          media_type: string
          network: string
          program_name: string
          proposed_date: string
          status: string | null
        }
        Insert: {
          band_id?: string | null
          compensation?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          media_type: string
          network: string
          program_name: string
          proposed_date: string
          status?: string | null
        }
        Update: {
          band_id?: string | null
          compensation?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          media_type?: string
          network?: string
          program_name?: string
          proposed_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_offers_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      media_shows: {
        Row: {
          created_at: string | null
          episodes_count: number | null
          facility_id: string
          id: string
          is_active: boolean | null
          rating: number | null
          show_format: string | null
          show_name: string
          target_audience: string | null
          updated_at: string | null
          user_id: string
          viewership: number | null
        }
        Insert: {
          created_at?: string | null
          episodes_count?: number | null
          facility_id: string
          id?: string
          is_active?: boolean | null
          rating?: number | null
          show_format?: string | null
          show_name: string
          target_audience?: string | null
          updated_at?: string | null
          user_id: string
          viewership?: number | null
        }
        Update: {
          created_at?: string | null
          episodes_count?: number | null
          facility_id?: string
          id?: string
          is_active?: boolean | null
          rating?: number | null
          show_format?: string | null
          show_name?: string
          target_audience?: string | null
          updated_at?: string | null
          user_id?: string
          viewership?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_shows_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "media_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_brand_partners: {
        Row: {
          base_upfront_payment: number | null
          brand_tier: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          min_fame_required: number | null
          min_fans_required: number | null
          name: string
          product_types: string[] | null
          quality_boost: string | null
          royalty_percentage: number | null
          sales_boost_pct: number | null
        }
        Insert: {
          base_upfront_payment?: number | null
          brand_tier?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          min_fame_required?: number | null
          min_fans_required?: number | null
          name: string
          product_types?: string[] | null
          quality_boost?: string | null
          royalty_percentage?: number | null
          sales_boost_pct?: number | null
        }
        Update: {
          base_upfront_payment?: number | null
          brand_tier?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          min_fame_required?: number | null
          min_fans_required?: number | null
          name?: string
          product_types?: string[] | null
          quality_boost?: string | null
          royalty_percentage?: number | null
          sales_boost_pct?: number | null
        }
        Relationships: []
      }
      merch_collaboration_offers: {
        Row: {
          band_id: string
          brand_id: string
          created_at: string | null
          expires_at: string
          id: string
          limited_quantity: number | null
          offer_message: string | null
          product_type: string
          responded_at: string | null
          royalty_per_sale: number | null
          status: string | null
          upfront_payment: number
        }
        Insert: {
          band_id: string
          brand_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          limited_quantity?: number | null
          offer_message?: string | null
          product_type: string
          responded_at?: string | null
          royalty_per_sale?: number | null
          status?: string | null
          upfront_payment: number
        }
        Update: {
          band_id?: string
          brand_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          limited_quantity?: number | null
          offer_message?: string | null
          product_type?: string
          responded_at?: string | null
          royalty_per_sale?: number | null
          status?: string | null
          upfront_payment?: number
        }
        Relationships: [
          {
            foreignKeyName: "merch_collaboration_offers_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_collaboration_offers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "merch_brand_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_collaborations: {
        Row: {
          band_id: string
          brand_id: string
          ended_at: string | null
          id: string
          is_active: boolean | null
          merchandise_id: string | null
          offer_id: string | null
          product_type: string
          quality_tier: string
          sales_boost_pct: number | null
          started_at: string | null
          total_royalties_earned: number | null
          total_units_sold: number | null
        }
        Insert: {
          band_id: string
          brand_id: string
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          merchandise_id?: string | null
          offer_id?: string | null
          product_type: string
          quality_tier: string
          sales_boost_pct?: number | null
          started_at?: string | null
          total_royalties_earned?: number | null
          total_units_sold?: number | null
        }
        Update: {
          band_id?: string
          brand_id?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          merchandise_id?: string | null
          offer_id?: string | null
          product_type?: string
          quality_tier?: string
          sales_boost_pct?: number | null
          started_at?: string | null
          total_royalties_earned?: number | null
          total_units_sold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merch_collaborations_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_collaborations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "merch_brand_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_collaborations_merchandise_id_fkey"
            columns: ["merchandise_id"]
            isOneToOne: false
            referencedRelation: "player_merchandise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_collaborations_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "merch_collaboration_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_factories: {
        Row: {
          city_id: string | null
          company_id: string | null
          created_at: string
          current_production: number
          equipment_condition: number
          factory_type: string
          id: string
          is_operational: boolean
          name: string
          operating_costs_daily: number
          production_capacity: number
          quality_level: number
          updated_at: string
          worker_count: number
          worker_skill_avg: number
        }
        Insert: {
          city_id?: string | null
          company_id?: string | null
          created_at?: string
          current_production?: number
          equipment_condition?: number
          factory_type?: string
          id?: string
          is_operational?: boolean
          name: string
          operating_costs_daily?: number
          production_capacity?: number
          quality_level?: number
          updated_at?: string
          worker_count?: number
          worker_skill_avg?: number
        }
        Update: {
          city_id?: string | null
          company_id?: string | null
          created_at?: string
          current_production?: number
          equipment_condition?: number
          factory_type?: string
          id?: string
          is_operational?: boolean
          name?: string
          operating_costs_daily?: number
          production_capacity?: number
          quality_level?: number
          updated_at?: string
          worker_count?: number
          worker_skill_avg?: number
        }
        Relationships: [
          {
            foreignKeyName: "merch_factories_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_factories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_factory_contracts: {
        Row: {
          client_band_id: string | null
          client_label_id: string | null
          contract_type: string
          created_at: string
          discount_percentage: number
          end_date: string | null
          factory_id: string | null
          id: string
          is_active: boolean
          minimum_monthly_orders: number | null
          priority_level: number
          start_date: string
          updated_at: string
        }
        Insert: {
          client_band_id?: string | null
          client_label_id?: string | null
          contract_type?: string
          created_at?: string
          discount_percentage?: number
          end_date?: string | null
          factory_id?: string | null
          id?: string
          is_active?: boolean
          minimum_monthly_orders?: number | null
          priority_level?: number
          start_date?: string
          updated_at?: string
        }
        Update: {
          client_band_id?: string | null
          client_label_id?: string | null
          contract_type?: string
          created_at?: string
          discount_percentage?: number
          end_date?: string | null
          factory_id?: string | null
          id?: string
          is_active?: boolean
          minimum_monthly_orders?: number | null
          priority_level?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merch_factory_contracts_client_band_id_fkey"
            columns: ["client_band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_factory_contracts_client_label_id_fkey"
            columns: ["client_label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_factory_contracts_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "merch_factories"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_factory_workers: {
        Row: {
          created_at: string
          experience_months: number
          factory_id: string | null
          hired_at: string
          id: string
          morale: number
          name: string
          role: string
          salary_weekly: number
          skill_level: number
        }
        Insert: {
          created_at?: string
          experience_months?: number
          factory_id?: string | null
          hired_at?: string
          id?: string
          morale?: number
          name: string
          role?: string
          salary_weekly?: number
          skill_level?: number
        }
        Update: {
          created_at?: string
          experience_months?: number
          factory_id?: string | null
          hired_at?: string
          id?: string
          morale?: number
          name?: string
          role?: string
          salary_weekly?: number
          skill_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "merch_factory_workers_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "merch_factories"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_item_requirements: {
        Row: {
          base_cost: number | null
          base_quality_tier: string | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          item_type: string
          min_fame: number | null
          min_fans: number | null
          min_level: number | null
        }
        Insert: {
          base_cost?: number | null
          base_quality_tier?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          item_type: string
          min_fame?: number | null
          min_fans?: number | null
          min_level?: number | null
        }
        Update: {
          base_cost?: number | null
          base_quality_tier?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          item_type?: string
          min_fame?: number | null
          min_fans?: number | null
          min_level?: number | null
        }
        Relationships: []
      }
      merch_orders: {
        Row: {
          band_id: string
          city: string | null
          country: string | null
          created_at: string | null
          customer_type: string
          gig_id: string | null
          id: string
          merchandise_id: string | null
          order_type: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          band_id: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          customer_type?: string
          gig_id?: string | null
          id?: string
          merchandise_id?: string | null
          order_type?: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          band_id?: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          customer_type?: string
          gig_id?: string | null
          id?: string
          merchandise_id?: string | null
          order_type?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "merch_orders_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_orders_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_orders_merchandise_id_fkey"
            columns: ["merchandise_id"]
            isOneToOne: false
            referencedRelation: "player_merchandise"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_product_catalog: {
        Row: {
          base_cost: number
          created_at: string
          factory_id: string | null
          id: string
          is_active: boolean
          min_order_quantity: number
          product_name: string
          product_type: string
          production_time_hours: number
          suggested_price: number
        }
        Insert: {
          base_cost: number
          created_at?: string
          factory_id?: string | null
          id?: string
          is_active?: boolean
          min_order_quantity?: number
          product_name: string
          product_type: string
          production_time_hours?: number
          suggested_price: number
        }
        Update: {
          base_cost?: number
          created_at?: string
          factory_id?: string | null
          id?: string
          is_active?: boolean
          min_order_quantity?: number
          product_name?: string
          product_type?: string
          production_time_hours?: number
          suggested_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "merch_product_catalog_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "merch_factories"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_production_queue: {
        Row: {
          client_band_id: string | null
          client_label_id: string | null
          completed_at: string | null
          created_at: string
          estimated_completion: string | null
          factory_id: string | null
          id: string
          notes: string | null
          priority: number
          product_catalog_id: string | null
          quality_rating: number | null
          quantity: number
          shipped_at: string | null
          started_at: string | null
          status: string
          total_cost: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          client_band_id?: string | null
          client_label_id?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_completion?: string | null
          factory_id?: string | null
          id?: string
          notes?: string | null
          priority?: number
          product_catalog_id?: string | null
          quality_rating?: number | null
          quantity: number
          shipped_at?: string | null
          started_at?: string | null
          status?: string
          total_cost: number
          unit_cost: number
          updated_at?: string
        }
        Update: {
          client_band_id?: string | null
          client_label_id?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_completion?: string | null
          factory_id?: string | null
          id?: string
          notes?: string | null
          priority?: number
          product_catalog_id?: string | null
          quality_rating?: number | null
          quantity?: number
          shipped_at?: string | null
          started_at?: string | null
          status?: string
          total_cost?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merch_production_queue_client_band_id_fkey"
            columns: ["client_band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_production_queue_client_label_id_fkey"
            columns: ["client_label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_production_queue_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "merch_factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_production_queue_product_catalog_id_fkey"
            columns: ["product_catalog_id"]
            isOneToOne: false
            referencedRelation: "merch_product_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_quality_records: {
        Row: {
          defect_types: Json | null
          id: string
          inspected_at: string
          inspector_id: string | null
          items_failed: number
          items_inspected: number
          items_passed: number
          notes: string | null
          production_queue_id: string | null
          quality_score: number
        }
        Insert: {
          defect_types?: Json | null
          id?: string
          inspected_at?: string
          inspector_id?: string | null
          items_failed: number
          items_inspected: number
          items_passed: number
          notes?: string | null
          production_queue_id?: string | null
          quality_score: number
        }
        Update: {
          defect_types?: Json | null
          id?: string
          inspected_at?: string
          inspector_id?: string | null
          items_failed?: number
          items_inspected?: number
          items_passed?: number
          notes?: string | null
          production_queue_id?: string | null
          quality_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "merch_quality_records_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "merch_factory_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_quality_records_production_queue_id_fkey"
            columns: ["production_queue_id"]
            isOneToOne: false
            referencedRelation: "merch_production_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      multiplayer_events: {
        Row: {
          created_at: string | null
          entry_fee: number | null
          event_date: string
          event_name: string
          event_type: string | null
          id: string
          max_participants: number | null
          metadata: Json | null
          prize_pool: number | null
          status: string | null
          venue_id: string | null
          voting_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          entry_fee?: number | null
          event_date: string
          event_name: string
          event_type?: string | null
          id?: string
          max_participants?: number | null
          metadata?: Json | null
          prize_pool?: number | null
          status?: string | null
          venue_id?: string | null
          voting_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          entry_fee?: number | null
          event_date?: string
          event_name?: string
          event_type?: string | null
          id?: string
          max_participants?: number | null
          metadata?: Json | null
          prize_pool?: number | null
          status?: string | null
          venue_id?: string | null
          voting_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "multiplayer_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      music_video_configs: {
        Row: {
          art_style: string
          band_id: string | null
          budget_amount: number
          budget_tier: string
          cast_option: string
          cast_quality: string | null
          chart_position: number | null
          chart_velocity: number
          created_at: string
          id: string
          image_quality: string
          location_style: string | null
          mtv_spins: number
          production_value_score: number
          release_date: string | null
          song_id: string | null
          status: string
          theme: string
          updated_at: string
          user_id: string | null
          youtube_views: number
        }
        Insert: {
          art_style: string
          band_id?: string | null
          budget_amount?: number
          budget_tier: string
          cast_option: string
          cast_quality?: string | null
          chart_position?: number | null
          chart_velocity?: number
          created_at?: string
          id?: string
          image_quality: string
          location_style?: string | null
          mtv_spins?: number
          production_value_score?: number
          release_date?: string | null
          song_id?: string | null
          status?: string
          theme: string
          updated_at?: string
          user_id?: string | null
          youtube_views?: number
        }
        Update: {
          art_style?: string
          band_id?: string | null
          budget_amount?: number
          budget_tier?: string
          cast_option?: string
          cast_quality?: string | null
          chart_position?: number | null
          chart_velocity?: number
          created_at?: string
          id?: string
          image_quality?: string
          location_style?: string | null
          mtv_spins?: number
          production_value_score?: number
          release_date?: string | null
          song_id?: string | null
          status?: string
          theme?: string
          updated_at?: string
          user_id?: string | null
          youtube_views?: number
        }
        Relationships: [
          {
            foreignKeyName: "music_video_configs_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_video_configs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "music_video_configs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "music_video_configs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_video_configs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      music_videos: {
        Row: {
          budget: number
          created_at: string
          description: string | null
          director_id: string | null
          earnings: number
          hype_score: number
          id: string
          production_quality: number
          release_date: string | null
          release_id: string | null
          song_id: string
          status: string
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          budget?: number
          created_at?: string
          description?: string | null
          director_id?: string | null
          earnings?: number
          hype_score?: number
          id?: string
          production_quality?: number
          release_date?: string | null
          release_id?: string | null
          song_id: string
          status?: string
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          budget?: number
          created_at?: string
          description?: string | null
          director_id?: string | null
          earnings?: number
          hype_score?: number
          id?: string
          production_quality?: number
          release_date?: string | null
          release_id?: string | null
          song_id?: string
          status?: string
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "music_videos_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "chart_albums"
            referencedColumns: ["release_id"]
          },
          {
            foreignKeyName: "music_videos_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_videos_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "music_videos_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "music_videos_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_videos_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      newspaper_submissions: {
        Row: {
          band_id: string
          compensation: number | null
          completed_at: string | null
          created_at: string | null
          fame_boost: number | null
          fan_boost: number | null
          id: string
          interview_type: string | null
          newspaper_id: string
          proposed_date: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          status: string | null
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          band_id: string
          compensation?: number | null
          completed_at?: string | null
          created_at?: string | null
          fame_boost?: number | null
          fan_boost?: number | null
          id?: string
          interview_type?: string | null
          newspaper_id: string
          proposed_date?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          band_id?: string
          compensation?: number | null
          completed_at?: string | null
          created_at?: string | null
          fame_boost?: number | null
          fan_boost?: number | null
          id?: string
          interview_type?: string | null
          newspaper_id?: string
          proposed_date?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newspaper_submissions_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newspaper_submissions_newspaper_id_fkey"
            columns: ["newspaper_id"]
            isOneToOne: false
            referencedRelation: "newspapers"
            referencedColumns: ["id"]
          },
        ]
      }
      newspapers: {
        Row: {
          circulation: number | null
          city_id: string | null
          compensation_max: number | null
          compensation_min: number | null
          country: string | null
          created_at: string | null
          description: string | null
          fame_boost_max: number | null
          fame_boost_min: number | null
          fan_boost_max: number | null
          fan_boost_min: number | null
          genres: string[] | null
          id: string
          interview_slots_per_day: number | null
          is_active: boolean | null
          logo_url: string | null
          min_fame_required: number | null
          name: string
          newspaper_type: string | null
          quality_level: number | null
        }
        Insert: {
          circulation?: number | null
          city_id?: string | null
          compensation_max?: number | null
          compensation_min?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          genres?: string[] | null
          id?: string
          interview_slots_per_day?: number | null
          is_active?: boolean | null
          logo_url?: string | null
          min_fame_required?: number | null
          name: string
          newspaper_type?: string | null
          quality_level?: number | null
        }
        Update: {
          circulation?: number | null
          city_id?: string | null
          compensation_max?: number | null
          compensation_min?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          genres?: string[] | null
          id?: string
          interview_slots_per_day?: number | null
          is_active?: boolean | null
          logo_url?: string | null
          min_fame_required?: number | null
          name?: string
          newspaper_type?: string | null
          quality_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "newspapers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      open_mic_performances: {
        Row: {
          band_id: string | null
          completed_at: string | null
          created_at: string
          current_song_position: number | null
          fame_gained: number | null
          fans_gained: number | null
          id: string
          overall_rating: number | null
          scheduled_date: string
          song_1_id: string | null
          song_2_id: string | null
          started_at: string | null
          status: string
          user_id: string
          venue_id: string
        }
        Insert: {
          band_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_song_position?: number | null
          fame_gained?: number | null
          fans_gained?: number | null
          id?: string
          overall_rating?: number | null
          scheduled_date: string
          song_1_id?: string | null
          song_2_id?: string | null
          started_at?: string | null
          status?: string
          user_id: string
          venue_id: string
        }
        Update: {
          band_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_song_position?: number | null
          fame_gained?: number | null
          fans_gained?: number | null
          id?: string
          overall_rating?: number | null
          scheduled_date?: string
          song_1_id?: string | null
          song_2_id?: string | null
          started_at?: string | null
          status?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_mic_performances_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_mic_performances_song_1_id_fkey"
            columns: ["song_1_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "open_mic_performances_song_1_id_fkey"
            columns: ["song_1_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "open_mic_performances_song_1_id_fkey"
            columns: ["song_1_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_mic_performances_song_1_id_fkey"
            columns: ["song_1_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_mic_performances_song_2_id_fkey"
            columns: ["song_2_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "open_mic_performances_song_2_id_fkey"
            columns: ["song_2_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "open_mic_performances_song_2_id_fkey"
            columns: ["song_2_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_mic_performances_song_2_id_fkey"
            columns: ["song_2_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_mic_performances_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "open_mic_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      open_mic_song_performances: {
        Row: {
          commentary: string[] | null
          created_at: string
          crowd_response: string | null
          id: string
          performance_id: string
          performance_score: number | null
          position: number
          song_id: string
        }
        Insert: {
          commentary?: string[] | null
          created_at?: string
          crowd_response?: string | null
          id?: string
          performance_id: string
          performance_score?: number | null
          position: number
          song_id: string
        }
        Update: {
          commentary?: string[] | null
          created_at?: string
          crowd_response?: string | null
          id?: string
          performance_id?: string
          performance_score?: number | null
          position?: number
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_mic_song_performances_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "open_mic_performances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_mic_song_performances_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "open_mic_song_performances_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "open_mic_song_performances_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_mic_song_performances_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      open_mic_venues: {
        Row: {
          capacity: number
          city_id: string
          created_at: string
          day_of_week: number
          description: string | null
          id: string
          image_url: string | null
          name: string
          start_time: string
        }
        Insert: {
          capacity?: number
          city_id: string
          created_at?: string
          day_of_week: number
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          start_time?: string
        }
        Update: {
          capacity?: number
          city_id?: string
          created_at?: string
          day_of_week?: number
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_mic_venues_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
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
      page_graphics: {
        Row: {
          accent_image_url: string | null
          background_image_url: string | null
          banner_image_url: string | null
          created_at: string | null
          hero_image_url: string | null
          icon_image_url: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          page_key: string
          page_name: string
          updated_at: string | null
        }
        Insert: {
          accent_image_url?: string | null
          background_image_url?: string | null
          banner_image_url?: string | null
          created_at?: string | null
          hero_image_url?: string | null
          icon_image_url?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          page_key: string
          page_name: string
          updated_at?: string | null
        }
        Update: {
          accent_image_url?: string | null
          background_image_url?: string | null
          banner_image_url?: string | null
          created_at?: string | null
          hero_image_url?: string | null
          icon_image_url?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          page_key?: string
          page_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      performance_items: {
        Row: {
          base_quality: number
          category: string
          created_at: string | null
          crowd_engagement_boost: number | null
          description: string | null
          duration_seconds: number
          energy_impact: number | null
          id: string
          is_active: boolean | null
          min_skill_level: number | null
          name: string
          required_genre: string | null
          required_skill: string | null
          skill_multiplier: number | null
        }
        Insert: {
          base_quality?: number
          category: string
          created_at?: string | null
          crowd_engagement_boost?: number | null
          description?: string | null
          duration_seconds?: number
          energy_impact?: number | null
          id?: string
          is_active?: boolean | null
          min_skill_level?: number | null
          name: string
          required_genre?: string | null
          required_skill?: string | null
          skill_multiplier?: number | null
        }
        Update: {
          base_quality?: number
          category?: string
          created_at?: string | null
          crowd_engagement_boost?: number | null
          description?: string | null
          duration_seconds?: number
          energy_impact?: number | null
          id?: string
          is_active?: boolean | null
          min_skill_level?: number | null
          name?: string
          required_genre?: string | null
          required_skill?: string | null
          skill_multiplier?: number | null
        }
        Relationships: []
      }
      performance_items_catalog: {
        Row: {
          base_impact_max: number | null
          base_impact_min: number | null
          created_at: string | null
          crowd_appeal: number | null
          description: string | null
          duration_seconds: number | null
          energy_cost: number | null
          id: string
          item_category: string
          min_skill_level: number | null
          name: string
          required_genre: string | null
          required_skill: string | null
          updated_at: string | null
        }
        Insert: {
          base_impact_max?: number | null
          base_impact_min?: number | null
          created_at?: string | null
          crowd_appeal?: number | null
          description?: string | null
          duration_seconds?: number | null
          energy_cost?: number | null
          id?: string
          item_category: string
          min_skill_level?: number | null
          name: string
          required_genre?: string | null
          required_skill?: string | null
          updated_at?: string | null
        }
        Update: {
          base_impact_max?: number | null
          base_impact_min?: number | null
          created_at?: string | null
          crowd_appeal?: number | null
          description?: string | null
          duration_seconds?: number | null
          energy_cost?: number | null
          id?: string
          item_category?: string
          min_skill_level?: number | null
          name?: string
          required_genre?: string | null
          required_skill?: string | null
          updated_at?: string | null
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
      player_active_boosts: {
        Row: {
          boost_type: string
          boost_value: number
          created_at: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          product_id: string
          started_at: string | null
          user_id: string
        }
        Insert: {
          boost_type: string
          boost_value: number
          created_at?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          product_id: string
          started_at?: string | null
          user_id: string
        }
        Update: {
          boost_type?: string
          boost_value?: number
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          product_id?: string
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_active_boosts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "underworld_products"
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
          {
            foreignKeyName: "player_attributes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      player_avatar_config: {
        Row: {
          accessory_1_id: string | null
          accessory_2_id: string | null
          age_appearance: string | null
          arm_length: number | null
          beard_style: string | null
          body_type: string | null
          cheekbone: number | null
          chin_prominence: number | null
          created_at: string | null
          ear_angle: number | null
          ear_size: number | null
          eye_color: string | null
          eye_size: number | null
          eye_spacing: number | null
          eye_style: string | null
          eye_tilt: number | null
          eyebrow_color: string | null
          eyebrow_style: string | null
          eyebrow_thickness: number | null
          face_length: number | null
          face_width: number | null
          gender: string | null
          hair_color: string | null
          hair_style_key: string | null
          height: number | null
          hip_width: number | null
          id: string
          jacket_color: string | null
          jacket_id: string | null
          jaw_shape: string | null
          leg_length: number | null
          lip_color: string | null
          lip_fullness: number | null
          lip_width: number | null
          mouth_style: string | null
          muscle_definition: number | null
          nose_bridge: number | null
          nose_length: number | null
          nose_style: string | null
          nose_width: number | null
          pants_color: string | null
          pants_id: string | null
          profile_id: string
          rpm_avatar_id: string | null
          rpm_avatar_url: string | null
          scar_style: string | null
          shirt_color: string | null
          shirt_id: string | null
          shoes_color: string | null
          shoes_id: string | null
          shoulder_width: number | null
          skin_tone: string | null
          tattoo_style: string | null
          torso_length: number | null
          updated_at: string | null
          use_rpm_avatar: boolean | null
          weight: number | null
        }
        Insert: {
          accessory_1_id?: string | null
          accessory_2_id?: string | null
          age_appearance?: string | null
          arm_length?: number | null
          beard_style?: string | null
          body_type?: string | null
          cheekbone?: number | null
          chin_prominence?: number | null
          created_at?: string | null
          ear_angle?: number | null
          ear_size?: number | null
          eye_color?: string | null
          eye_size?: number | null
          eye_spacing?: number | null
          eye_style?: string | null
          eye_tilt?: number | null
          eyebrow_color?: string | null
          eyebrow_style?: string | null
          eyebrow_thickness?: number | null
          face_length?: number | null
          face_width?: number | null
          gender?: string | null
          hair_color?: string | null
          hair_style_key?: string | null
          height?: number | null
          hip_width?: number | null
          id?: string
          jacket_color?: string | null
          jacket_id?: string | null
          jaw_shape?: string | null
          leg_length?: number | null
          lip_color?: string | null
          lip_fullness?: number | null
          lip_width?: number | null
          mouth_style?: string | null
          muscle_definition?: number | null
          nose_bridge?: number | null
          nose_length?: number | null
          nose_style?: string | null
          nose_width?: number | null
          pants_color?: string | null
          pants_id?: string | null
          profile_id: string
          rpm_avatar_id?: string | null
          rpm_avatar_url?: string | null
          scar_style?: string | null
          shirt_color?: string | null
          shirt_id?: string | null
          shoes_color?: string | null
          shoes_id?: string | null
          shoulder_width?: number | null
          skin_tone?: string | null
          tattoo_style?: string | null
          torso_length?: number | null
          updated_at?: string | null
          use_rpm_avatar?: boolean | null
          weight?: number | null
        }
        Update: {
          accessory_1_id?: string | null
          accessory_2_id?: string | null
          age_appearance?: string | null
          arm_length?: number | null
          beard_style?: string | null
          body_type?: string | null
          cheekbone?: number | null
          chin_prominence?: number | null
          created_at?: string | null
          ear_angle?: number | null
          ear_size?: number | null
          eye_color?: string | null
          eye_size?: number | null
          eye_spacing?: number | null
          eye_style?: string | null
          eye_tilt?: number | null
          eyebrow_color?: string | null
          eyebrow_style?: string | null
          eyebrow_thickness?: number | null
          face_length?: number | null
          face_width?: number | null
          gender?: string | null
          hair_color?: string | null
          hair_style_key?: string | null
          height?: number | null
          hip_width?: number | null
          id?: string
          jacket_color?: string | null
          jacket_id?: string | null
          jaw_shape?: string | null
          leg_length?: number | null
          lip_color?: string | null
          lip_fullness?: number | null
          lip_width?: number | null
          mouth_style?: string | null
          muscle_definition?: number | null
          nose_bridge?: number | null
          nose_length?: number | null
          nose_style?: string | null
          nose_width?: number | null
          pants_color?: string | null
          pants_id?: string | null
          profile_id?: string
          rpm_avatar_id?: string | null
          rpm_avatar_url?: string | null
          scar_style?: string | null
          shirt_color?: string | null
          shirt_id?: string | null
          shoes_color?: string | null
          shoes_id?: string | null
          shoulder_width?: number | null
          skin_tone?: string | null
          tattoo_style?: string | null
          torso_length?: number | null
          updated_at?: string | null
          use_rpm_avatar?: boolean | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_avatar_config_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_avatar_config_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "public_player_cards"
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
          {
            foreignKeyName: "player_book_purchases_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
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
            foreignKeyName: "player_book_reading_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
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
      player_criminal_record: {
        Row: {
          behavior_rating: string
          escaped: boolean
          id: string
          imprisonment_id: string
          offense_type: string
          pardoned: boolean
          recorded_at: string
          sentence_served_days: number
          user_id: string
        }
        Insert: {
          behavior_rating: string
          escaped?: boolean
          id?: string
          imprisonment_id: string
          offense_type: string
          pardoned?: boolean
          recorded_at?: string
          sentence_served_days: number
          user_id: string
        }
        Update: {
          behavior_rating?: string
          escaped?: boolean
          id?: string
          imprisonment_id?: string
          offense_type?: string
          pardoned?: boolean
          recorded_at?: string
          sentence_served_days?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_criminal_record_imprisonment_id_fkey"
            columns: ["imprisonment_id"]
            isOneToOne: false
            referencedRelation: "player_imprisonments"
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
          {
            foreignKeyName: "player_daily_cats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
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
          {
            foreignKeyName: "player_employment_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
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
      player_equipment_inventory: {
        Row: {
          condition: number | null
          created_at: string | null
          equipment_id: string
          id: string
          is_equipped: boolean | null
          last_maintained: string | null
          maintenance_cost: number | null
          purchased_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          condition?: number | null
          created_at?: string | null
          equipment_id: string
          id?: string
          is_equipped?: boolean | null
          last_maintained?: string | null
          maintenance_cost?: number | null
          purchased_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          condition?: number | null
          created_at?: string | null
          equipment_id?: string
          id?: string
          is_equipped?: boolean | null
          last_maintained?: string | null
          maintenance_cost?: number | null
          purchased_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_equipment_inventory_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      player_event_history: {
        Row: {
          event_id: string
          first_seen_at: string
          id: string
          user_id: string
        }
        Insert: {
          event_id: string
          first_seen_at?: string
          id?: string
          user_id: string
        }
        Update: {
          event_id?: string
          first_seen_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_event_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "random_events"
            referencedColumns: ["id"]
          },
        ]
      }
      player_events: {
        Row: {
          choice_made: string | null
          choice_made_at: string | null
          created_at: string
          event_id: string
          id: string
          outcome_applied: boolean
          outcome_applied_at: string | null
          outcome_effects: Json | null
          outcome_message: string | null
          status: string
          triggered_at: string
          user_id: string
        }
        Insert: {
          choice_made?: string | null
          choice_made_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          outcome_applied?: boolean
          outcome_applied_at?: string | null
          outcome_effects?: Json | null
          outcome_message?: string | null
          status?: string
          triggered_at?: string
          user_id: string
        }
        Update: {
          choice_made?: string | null
          choice_made_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          outcome_applied?: boolean
          outcome_applied_at?: string | null
          outcome_effects?: Json | null
          outcome_message?: string | null
          status?: string
          triggered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "random_events"
            referencedColumns: ["id"]
          },
        ]
      }
      player_film_contracts: {
        Row: {
          accepted_at: string | null
          band_id: string | null
          compensation: number | null
          completed_at: string | null
          contract_year: number
          created_at: string | null
          fame_boost: number | null
          fan_boost: number | null
          film_id: string
          filming_end_date: string | null
          filming_start_date: string | null
          id: string
          role_type: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          band_id?: string | null
          compensation?: number | null
          completed_at?: string | null
          contract_year: number
          created_at?: string | null
          fame_boost?: number | null
          fan_boost?: number | null
          film_id: string
          filming_end_date?: string | null
          filming_start_date?: string | null
          id?: string
          role_type?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          band_id?: string | null
          compensation?: number | null
          completed_at?: string | null
          contract_year?: number
          created_at?: string | null
          fame_boost?: number | null
          fan_boost?: number | null
          film_id?: string
          filming_end_date?: string | null
          filming_start_date?: string | null
          id?: string
          role_type?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_film_contracts_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_film_contracts_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "film_productions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_gig_milestones: {
        Row: {
          achieved_at: string
          gig_id: string | null
          id: string
          milestone_id: string
          user_id: string
        }
        Insert: {
          achieved_at?: string
          gig_id?: string | null
          id?: string
          milestone_id: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          gig_id?: string | null
          id?: string
          milestone_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_gig_milestones_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_gig_milestones_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "gig_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      player_gig_xp: {
        Row: {
          attendance_count: number | null
          band_id: string
          base_xp: number
          created_at: string
          crowd_bonus_xp: number
          gig_id: string
          id: string
          milestone_bonus_xp: number
          performance_bonus_xp: number
          performance_rating: number | null
          profile_id: string | null
          skill_improvement_amount: number | null
          skill_type_improved: string | null
          total_xp: number
          user_id: string
          xp_multiplier: number
        }
        Insert: {
          attendance_count?: number | null
          band_id: string
          base_xp?: number
          created_at?: string
          crowd_bonus_xp?: number
          gig_id: string
          id?: string
          milestone_bonus_xp?: number
          performance_bonus_xp?: number
          performance_rating?: number | null
          profile_id?: string | null
          skill_improvement_amount?: number | null
          skill_type_improved?: string | null
          total_xp?: number
          user_id: string
          xp_multiplier?: number
        }
        Update: {
          attendance_count?: number | null
          band_id?: string
          base_xp?: number
          created_at?: string
          crowd_bonus_xp?: number
          gig_id?: string
          id?: string
          milestone_bonus_xp?: number
          performance_bonus_xp?: number
          performance_rating?: number | null
          profile_id?: string | null
          skill_improvement_amount?: number | null
          skill_type_improved?: string | null
          total_xp?: number
          user_id?: string
          xp_multiplier?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_gig_xp_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_gig_xp_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_gig_xp_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_gig_xp_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      player_habit_completions: {
        Row: {
          completed_date: string
          created_at: string | null
          habit_id: string
          id: string
        }
        Insert: {
          completed_date: string
          created_at?: string | null
          habit_id: string
          id?: string
        }
        Update: {
          completed_date?: string
          created_at?: string | null
          habit_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "player_habits"
            referencedColumns: ["id"]
          },
        ]
      }
      player_habits: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          name: string
          target_per_week: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          target_per_week?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          target_per_week?: number | null
          user_id?: string
        }
        Relationships: []
      }
      player_hospitalizations: {
        Row: {
          admitted_at: string
          created_at: string
          discharged_at: string | null
          expected_discharge_at: string
          health_on_admission: number
          hospital_id: string
          id: string
          status: string
          total_cost: number
          user_id: string
        }
        Insert: {
          admitted_at?: string
          created_at?: string
          discharged_at?: string | null
          expected_discharge_at: string
          health_on_admission: number
          hospital_id: string
          id?: string
          status?: string
          total_cost?: number
          user_id: string
        }
        Update: {
          admitted_at?: string
          created_at?: string
          discharged_at?: string | null
          expected_discharge_at?: string
          health_on_admission?: number
          hospital_id?: string
          id?: string
          status?: string
          total_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_hospitalizations_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      player_imprisonments: {
        Row: {
          bail_amount: number | null
          bail_paid_by: string | null
          behavior_score: number
          cellmate_name: string | null
          cellmate_skill: string | null
          cellmate_skill_bonus: number | null
          created_at: string
          debt_amount_cleared: number
          escape_attempts: number
          good_behavior_days_earned: number
          id: string
          imprisoned_at: string
          original_sentence_days: number
          prison_id: string
          reason: string
          release_date: string
          released_at: string | null
          remaining_sentence_days: number
          songs_written: number
          status: string
          user_id: string
        }
        Insert: {
          bail_amount?: number | null
          bail_paid_by?: string | null
          behavior_score?: number
          cellmate_name?: string | null
          cellmate_skill?: string | null
          cellmate_skill_bonus?: number | null
          created_at?: string
          debt_amount_cleared?: number
          escape_attempts?: number
          good_behavior_days_earned?: number
          id?: string
          imprisoned_at?: string
          original_sentence_days: number
          prison_id: string
          reason?: string
          release_date: string
          released_at?: string | null
          remaining_sentence_days: number
          songs_written?: number
          status?: string
          user_id: string
        }
        Update: {
          bail_amount?: number | null
          bail_paid_by?: string | null
          behavior_score?: number
          cellmate_name?: string | null
          cellmate_skill?: string | null
          cellmate_skill_bonus?: number | null
          created_at?: string
          debt_amount_cleared?: number
          escape_attempts?: number
          good_behavior_days_earned?: number
          id?: string
          imprisoned_at?: string
          original_sentence_days?: number
          prison_id?: string
          reason?: string
          release_date?: string
          released_at?: string | null
          remaining_sentence_days?: number
          songs_written?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_imprisonments_prison_id_fkey"
            columns: ["prison_id"]
            isOneToOne: false
            referencedRelation: "prisons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_instruments: {
        Row: {
          created_at: string
          experience_points: number
          id: string
          instrument: string
          skill_level: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          experience_points?: number
          id?: string
          instrument: string
          skill_level?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          experience_points?: number
          id?: string
          instrument?: string
          skill_level?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_investments: {
        Row: {
          category: string
          created_at: string | null
          current_value: number
          growth_rate: number | null
          id: string
          invested_amount: number
          investment_name: string
          notes: string | null
          purchased_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          current_value: number
          growth_rate?: number | null
          id?: string
          invested_amount: number
          investment_name: string
          notes?: string | null
          purchased_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          current_value?: number
          growth_rate?: number | null
          id?: string
          invested_amount?: number
          investment_name?: string
          notes?: string | null
          purchased_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      player_loans: {
        Row: {
          created_at: string | null
          due_date: string
          id: string
          interest_rate: number
          loan_name: string
          principal: number
          remaining_balance: number
          started_at: string | null
          status: string | null
          total_paid: number | null
          updated_at: string | null
          user_id: string
          weekly_payment: number
        }
        Insert: {
          created_at?: string | null
          due_date: string
          id?: string
          interest_rate: number
          loan_name: string
          principal: number
          remaining_balance: number
          started_at?: string | null
          status?: string | null
          total_paid?: number | null
          updated_at?: string | null
          user_id: string
          weekly_payment: number
        }
        Update: {
          created_at?: string | null
          due_date?: string
          id?: string
          interest_rate?: number
          loan_name?: string
          principal?: number
          remaining_balance?: number
          started_at?: string | null
          status?: string | null
          total_paid?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_payment?: number
        }
        Relationships: []
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
          available_until: string | null
          band_id: string
          collaboration_id: string | null
          cost_to_produce: number
          created_at: string
          custom_design_id: string | null
          design_name: string
          design_preview_url: string | null
          id: string
          is_limited_edition: boolean | null
          item_type: string
          limited_quantity: number | null
          quality_tier: string | null
          sales_boost_pct: number | null
          selling_price: number
          stock_quantity: number
          tour_exclusive_tour_id: string | null
          updated_at: string
        }
        Insert: {
          available_until?: string | null
          band_id: string
          collaboration_id?: string | null
          cost_to_produce?: number
          created_at?: string
          custom_design_id?: string | null
          design_name: string
          design_preview_url?: string | null
          id?: string
          is_limited_edition?: boolean | null
          item_type: string
          limited_quantity?: number | null
          quality_tier?: string | null
          sales_boost_pct?: number | null
          selling_price?: number
          stock_quantity?: number
          tour_exclusive_tour_id?: string | null
          updated_at?: string
        }
        Update: {
          available_until?: string | null
          band_id?: string
          collaboration_id?: string | null
          cost_to_produce?: number
          created_at?: string
          custom_design_id?: string | null
          design_name?: string
          design_preview_url?: string | null
          id?: string
          is_limited_edition?: boolean | null
          item_type?: string
          limited_quantity?: number | null
          quality_tier?: string | null
          sales_boost_pct?: number | null
          selling_price?: number
          stock_quantity?: number
          tour_exclusive_tour_id?: string | null
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
          {
            foreignKeyName: "player_merchandise_collaboration_id_fkey"
            columns: ["collaboration_id"]
            isOneToOne: false
            referencedRelation: "merch_collaborations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_merchandise_custom_design_id_fkey"
            columns: ["custom_design_id"]
            isOneToOne: false
            referencedRelation: "tshirt_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_merchandise_tour_exclusive_tour_id_fkey"
            columns: ["tour_exclusive_tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      player_owned_skins: {
        Row: {
          id: string
          is_equipped: boolean | null
          item_id: string
          item_type: string
          profile_id: string
          purchased_at: string | null
        }
        Insert: {
          id?: string
          is_equipped?: boolean | null
          item_id: string
          item_type: string
          profile_id: string
          purchased_at?: string | null
        }
        Update: {
          id?: string
          is_equipped?: boolean | null
          item_id?: string
          item_type?: string
          profile_id?: string
          purchased_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_owned_skins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_owned_skins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      player_personal_gear: {
        Row: {
          condition_rating: number
          created_at: string
          gear_name: string
          gear_type: string
          id: string
          is_equipped: boolean
          notes: string | null
          purchase_cost: number | null
          purchase_date: string | null
          quality_rating: number
          stat_boosts: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          condition_rating?: number
          created_at?: string
          gear_name: string
          gear_type: string
          id?: string
          is_equipped?: boolean
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          quality_rating?: number
          stat_boosts?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          condition_rating?: number
          created_at?: string
          gear_name?: string
          gear_type?: string
          id?: string
          is_equipped?: boolean
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          quality_rating?: number
          stat_boosts?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_pr_consultants: {
        Row: {
          auto_accept_enabled: boolean | null
          consultant_id: string | null
          created_at: string | null
          expires_at: string
          hired_at: string | null
          id: string
          min_compensation: number | null
          target_media_types: string[] | null
          user_id: string
        }
        Insert: {
          auto_accept_enabled?: boolean | null
          consultant_id?: string | null
          created_at?: string | null
          expires_at: string
          hired_at?: string | null
          id?: string
          min_compensation?: number | null
          target_media_types?: string[] | null
          user_id: string
        }
        Update: {
          auto_accept_enabled?: boolean | null
          consultant_id?: string | null
          created_at?: string | null
          expires_at?: string
          hired_at?: string | null
          id?: string
          min_compensation?: number | null
          target_media_types?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_pr_consultants_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "pr_consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      player_prison_events: {
        Row: {
          choice_made: string | null
          event_id: string
          id: string
          imprisonment_id: string
          outcome_applied: boolean
          status: string
          triggered_at: string
          user_id: string
        }
        Insert: {
          choice_made?: string | null
          event_id: string
          id?: string
          imprisonment_id: string
          outcome_applied?: boolean
          status?: string
          triggered_at?: string
          user_id: string
        }
        Update: {
          choice_made?: string | null
          event_id?: string
          id?: string
          imprisonment_id?: string
          outcome_applied?: boolean
          status?: string
          triggered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_prison_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "prison_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_prison_events_imprisonment_id_fkey"
            columns: ["imprisonment_id"]
            isOneToOne: false
            referencedRelation: "player_imprisonments"
            referencedColumns: ["id"]
          },
        ]
      }
      player_scheduled_activities: {
        Row: {
          activity_type: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          linked_gig_id: string | null
          linked_jam_session_id: string | null
          linked_job_shift_id: string | null
          linked_recording_id: string | null
          linked_rehearsal_id: string | null
          location: string | null
          metadata: Json | null
          profile_id: string
          reminder_minutes_before: number | null
          reminder_sent: boolean | null
          scheduled_end: string
          scheduled_start: string
          started_at: string | null
          status: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          linked_gig_id?: string | null
          linked_jam_session_id?: string | null
          linked_job_shift_id?: string | null
          linked_recording_id?: string | null
          linked_rehearsal_id?: string | null
          location?: string | null
          metadata?: Json | null
          profile_id: string
          reminder_minutes_before?: number | null
          reminder_sent?: boolean | null
          scheduled_end: string
          scheduled_start: string
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          linked_gig_id?: string | null
          linked_jam_session_id?: string | null
          linked_job_shift_id?: string | null
          linked_recording_id?: string | null
          linked_rehearsal_id?: string | null
          location?: string | null
          metadata?: Json | null
          profile_id?: string
          reminder_minutes_before?: number | null
          reminder_sent?: boolean | null
          scheduled_end?: string
          scheduled_start?: string
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_scheduled_activities_linked_gig_id_fkey"
            columns: ["linked_gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scheduled_activities_linked_jam_session_id_fkey"
            columns: ["linked_jam_session_id"]
            isOneToOne: false
            referencedRelation: "jam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scheduled_activities_linked_job_shift_id_fkey"
            columns: ["linked_job_shift_id"]
            isOneToOne: false
            referencedRelation: "shift_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scheduled_activities_linked_recording_id_fkey"
            columns: ["linked_recording_id"]
            isOneToOne: false
            referencedRelation: "recording_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scheduled_activities_linked_rehearsal_id_fkey"
            columns: ["linked_rehearsal_id"]
            isOneToOne: false
            referencedRelation: "band_rehearsals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scheduled_activities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scheduled_activities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      player_skill_books: {
        Row: {
          book_id: string
          book_title: string
          completed_at: string | null
          id: string
          progress_percentage: number | null
          purchased_at: string | null
          skill_focus: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          book_id: string
          book_title: string
          completed_at?: string | null
          id?: string
          progress_percentage?: number | null
          purchased_at?: string | null
          skill_focus: string
          user_id: string
          xp_reward: number
        }
        Update: {
          book_id?: string
          book_title?: string
          completed_at?: string | null
          id?: string
          progress_percentage?: number | null
          purchased_at?: string | null
          skill_focus?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      player_skill_snapshots: {
        Row: {
          attributes_snapshot: Json | null
          created_at: string | null
          id: string
          profile_id: string | null
          skills_snapshot: Json
          snapshot_at_age: number
        }
        Insert: {
          attributes_snapshot?: Json | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
          skills_snapshot: Json
          snapshot_at_age?: number
        }
        Update: {
          attributes_snapshot?: Json | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
          skills_snapshot?: Json
          snapshot_at_age?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_skill_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_skill_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
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
      player_token_holdings: {
        Row: {
          average_buy_price: number | null
          created_at: string | null
          id: string
          quantity: number
          token_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          average_buy_price?: number | null
          created_at?: string | null
          id?: string
          quantity?: number
          token_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          average_buy_price?: number | null
          created_at?: string | null
          id?: string
          quantity?: number
          token_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_token_holdings_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "crypto_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      player_training_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_hours: number
          focus_area: string | null
          id: string
          notes: string | null
          session_type: string
          skill_slug: string
          started_at: string
          updated_at: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_hours?: number
          focus_area?: string | null
          id?: string
          notes?: string | null
          session_type?: string
          skill_slug: string
          started_at?: string
          updated_at?: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_hours?: number
          focus_area?: string | null
          id?: string
          notes?: string | null
          session_type?: string
          skill_slug?: string
          started_at?: string
          updated_at?: string
          user_id?: string
          xp_earned?: number
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
          scheduled_departure_time: string | null
          status: string | null
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
          scheduled_departure_time?: string | null
          status?: string | null
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
          scheduled_departure_time?: string | null
          status?: string | null
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
            foreignKeyName: "player_travel_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
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
      player_tutorial_progress: {
        Row: {
          completed_at: string
          id: string
          step_key: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          step_key: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          step_key?: string
          user_id?: string
        }
        Relationships: []
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
            foreignKeyName: "player_university_enrollments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
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
      player_wellness_conditions: {
        Row: {
          condition_type: string
          id: string
          notes: string | null
          recovery_activity: string | null
          resolved_at: string | null
          severity: string | null
          started_at: string | null
          user_id: string
        }
        Insert: {
          condition_type: string
          id?: string
          notes?: string | null
          recovery_activity?: string | null
          resolved_at?: string | null
          severity?: string | null
          started_at?: string | null
          user_id: string
        }
        Update: {
          condition_type?: string
          id?: string
          notes?: string | null
          recovery_activity?: string | null
          resolved_at?: string | null
          severity?: string | null
          started_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      player_wellness_goals: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_value: number | null
          deadline: string | null
          goal_type: string
          id: string
          status: string | null
          target_value: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          deadline?: string | null
          goal_type: string
          id?: string
          status?: string | null
          target_value: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          deadline?: string | null
          goal_type?: string
          id?: string
          status?: string | null
          target_value?: number
          user_id?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "player_xp_wallet_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "public_player_cards"
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
      podcast_submissions: {
        Row: {
          band_id: string
          compensation: number | null
          completed_at: string | null
          created_at: string | null
          episode_topic: string | null
          fame_boost: number | null
          fan_boost: number | null
          id: string
          podcast_id: string
          proposed_date: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          status: string | null
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          band_id: string
          compensation?: number | null
          completed_at?: string | null
          created_at?: string | null
          episode_topic?: string | null
          fame_boost?: number | null
          fan_boost?: number | null
          id?: string
          podcast_id: string
          proposed_date?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          band_id?: string
          compensation?: number | null
          completed_at?: string | null
          created_at?: string | null
          episode_topic?: string | null
          fame_boost?: number | null
          fan_boost?: number | null
          id?: string
          podcast_id?: string
          proposed_date?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_submissions_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_submissions_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "podcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      podcasts: {
        Row: {
          compensation_max: number | null
          compensation_min: number | null
          country: string | null
          created_at: string | null
          description: string | null
          episodes_per_week: number | null
          fame_boost_max: number | null
          fame_boost_min: number | null
          fan_boost_max: number | null
          fan_boost_min: number | null
          genres: string[] | null
          host_name: string | null
          id: string
          is_active: boolean | null
          listener_base: number | null
          min_fame_required: number | null
          podcast_name: string
          podcast_type: string | null
          quality_level: number | null
          slots_per_episode: number | null
        }
        Insert: {
          compensation_max?: number | null
          compensation_min?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          episodes_per_week?: number | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          genres?: string[] | null
          host_name?: string | null
          id?: string
          is_active?: boolean | null
          listener_base?: number | null
          min_fame_required?: number | null
          podcast_name: string
          podcast_type?: string | null
          quality_level?: number | null
          slots_per_episode?: number | null
        }
        Update: {
          compensation_max?: number | null
          compensation_min?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          episodes_per_week?: number | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          genres?: string[] | null
          host_name?: string | null
          id?: string
          is_active?: boolean | null
          listener_base?: number | null
          min_fame_required?: number | null
          podcast_name?: string
          podcast_type?: string | null
          quality_level?: number | null
          slots_per_episode?: number | null
        }
        Relationships: []
      }
      pr_campaigns: {
        Row: {
          band_id: string | null
          budget: number | null
          campaign_name: string
          campaign_type: string
          created_at: string | null
          end_date: string
          engagement_rate: number | null
          id: string
          media_impressions: number | null
          reach: number | null
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          band_id?: string | null
          budget?: number | null
          campaign_name: string
          campaign_type: string
          created_at?: string | null
          end_date: string
          engagement_rate?: number | null
          id?: string
          media_impressions?: number | null
          reach?: number | null
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          band_id?: string | null
          budget?: number | null
          campaign_name?: string
          campaign_type?: string
          created_at?: string | null
          end_date?: string
          engagement_rate?: number | null
          id?: string
          media_impressions?: number | null
          reach?: number | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pr_campaigns_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      pr_consultant_requests: {
        Row: {
          consultant_contract_id: string | null
          created_at: string | null
          fulfilled_at: string | null
          fulfilled_offer_id: string | null
          id: string
          media_type: string
          notes: string | null
          preferred_outlet_id: string | null
          status: string | null
          target_type: string | null
          user_id: string
        }
        Insert: {
          consultant_contract_id?: string | null
          created_at?: string | null
          fulfilled_at?: string | null
          fulfilled_offer_id?: string | null
          id?: string
          media_type: string
          notes?: string | null
          preferred_outlet_id?: string | null
          status?: string | null
          target_type?: string | null
          user_id: string
        }
        Update: {
          consultant_contract_id?: string | null
          created_at?: string | null
          fulfilled_at?: string | null
          fulfilled_offer_id?: string | null
          id?: string
          media_type?: string
          notes?: string | null
          preferred_outlet_id?: string | null
          status?: string | null
          target_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pr_consultant_requests_consultant_contract_id_fkey"
            columns: ["consultant_contract_id"]
            isOneToOne: false
            referencedRelation: "player_pr_consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pr_consultant_requests_fulfilled_offer_id_fkey"
            columns: ["fulfilled_offer_id"]
            isOneToOne: false
            referencedRelation: "pr_media_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      pr_consultants: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          specialty: string | null
          success_rate: number | null
          tier: string | null
          weekly_fee: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          specialty?: string | null
          success_rate?: number | null
          tier?: string | null
          weekly_fee?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          specialty?: string | null
          success_rate?: number | null
          tier?: string | null
          weekly_fee?: number | null
        }
        Relationships: []
      }
      pr_media_offers: {
        Row: {
          accepted_at: string | null
          band_id: string | null
          compensation: number | null
          completed_at: string | null
          created_at: string | null
          duration_hours: number | null
          expires_at: string
          fame_boost: number | null
          fan_boost: number | null
          id: string
          linked_release_id: string | null
          linked_tour_id: string | null
          media_outlet_id: string | null
          media_type: string
          offer_type: string
          outlet_name: string | null
          proposed_date: string
          release_hype_boost_percent: number | null
          show_id: string | null
          show_name: string | null
          status: string | null
          ticket_sales_boost_percent: number | null
          time_slot: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          band_id?: string | null
          compensation?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_hours?: number | null
          expires_at: string
          fame_boost?: number | null
          fan_boost?: number | null
          id?: string
          linked_release_id?: string | null
          linked_tour_id?: string | null
          media_outlet_id?: string | null
          media_type: string
          offer_type: string
          outlet_name?: string | null
          proposed_date: string
          release_hype_boost_percent?: number | null
          show_id?: string | null
          show_name?: string | null
          status?: string | null
          ticket_sales_boost_percent?: number | null
          time_slot?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          band_id?: string | null
          compensation?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_hours?: number | null
          expires_at?: string
          fame_boost?: number | null
          fan_boost?: number | null
          id?: string
          linked_release_id?: string | null
          linked_tour_id?: string | null
          media_outlet_id?: string | null
          media_type?: string
          offer_type?: string
          outlet_name?: string | null
          proposed_date?: string
          release_hype_boost_percent?: number | null
          show_id?: string | null
          show_name?: string | null
          status?: string | null
          ticket_sales_boost_percent?: number | null
          time_slot?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pr_media_offers_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      prison_events: {
        Row: {
          behavior_max: number | null
          behavior_min: number | null
          category: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_common: boolean
          option_a_effects: Json
          option_a_text: string
          option_b_effects: Json
          option_b_text: string
          title: string
        }
        Insert: {
          behavior_max?: number | null
          behavior_min?: number | null
          category: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          is_common?: boolean
          option_a_effects?: Json
          option_a_text: string
          option_b_effects?: Json
          option_b_text: string
          title: string
        }
        Update: {
          behavior_max?: number | null
          behavior_min?: number | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_common?: boolean
          option_a_effects?: Json
          option_a_text?: string
          option_b_effects?: Json
          option_b_text?: string
          title?: string
        }
        Relationships: []
      }
      prisons: {
        Row: {
          capacity: number
          city_id: string
          created_at: string
          daily_cost: number
          escape_difficulty: number
          has_music_program: boolean
          id: string
          name: string
          rehabilitation_rating: number
          security_level: string
        }
        Insert: {
          capacity?: number
          city_id: string
          created_at?: string
          daily_cost?: number
          escape_difficulty?: number
          has_music_program?: boolean
          id?: string
          name: string
          rehabilitation_rating?: number
          security_level?: string
        }
        Update: {
          capacity?: number
          city_id?: string
          created_at?: string
          daily_cost?: number
          escape_difficulty?: number
          has_music_program?: boolean
          id?: string
          name?: string
          rehabilitation_rating?: number
          security_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "prisons_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
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
          {
            foreignKeyName: "profile_activity_statuses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "public_player_cards"
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
          debt_started_at: string | null
          display_name: string | null
          energy: number
          experience: number | null
          experience_at_last_weekly_bonus: number | null
          fame: number | null
          fans: number | null
          gender: string | null
          has_active_lawyer: boolean | null
          health: number
          id: string
          is_imprisoned: boolean
          is_traveling: boolean | null
          is_vip: boolean | null
          is_wanted: boolean
          last_health_update: string | null
          last_retirement_prompt_age: number | null
          last_weekly_bonus_at: string | null
          lawyer_expires_at: string | null
          lawyer_hired_at: string | null
          level: number | null
          rest_required_until: string | null
          rpm_avatar_url: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          total_hours_played: number | null
          total_imprisonments: number
          travel_arrives_at: string | null
          travel_manager_enabled: boolean | null
          travel_manager_expires_at: string | null
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
          debt_started_at?: string | null
          display_name?: string | null
          energy?: number
          experience?: number | null
          experience_at_last_weekly_bonus?: number | null
          fame?: number | null
          fans?: number | null
          gender?: string | null
          has_active_lawyer?: boolean | null
          health?: number
          id?: string
          is_imprisoned?: boolean
          is_traveling?: boolean | null
          is_vip?: boolean | null
          is_wanted?: boolean
          last_health_update?: string | null
          last_retirement_prompt_age?: number | null
          last_weekly_bonus_at?: string | null
          lawyer_expires_at?: string | null
          lawyer_hired_at?: string | null
          level?: number | null
          rest_required_until?: string | null
          rpm_avatar_url?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          total_hours_played?: number | null
          total_imprisonments?: number
          travel_arrives_at?: string | null
          travel_manager_enabled?: boolean | null
          travel_manager_expires_at?: string | null
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
          debt_started_at?: string | null
          display_name?: string | null
          energy?: number
          experience?: number | null
          experience_at_last_weekly_bonus?: number | null
          fame?: number | null
          fans?: number | null
          gender?: string | null
          has_active_lawyer?: boolean | null
          health?: number
          id?: string
          is_imprisoned?: boolean
          is_traveling?: boolean | null
          is_vip?: boolean | null
          is_wanted?: boolean
          last_health_update?: string | null
          last_retirement_prompt_age?: number | null
          last_weekly_bonus_at?: string | null
          lawyer_expires_at?: string | null
          lawyer_hired_at?: string | null
          level?: number | null
          rest_required_until?: string | null
          rpm_avatar_url?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          total_hours_played?: number | null
          total_imprisonments?: number
          travel_arrives_at?: string | null
          travel_manager_enabled?: boolean | null
          travel_manager_expires_at?: string | null
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
      promoters: {
        Row: {
          active: boolean | null
          booking_fee: number | null
          created_at: string | null
          crowd_engagement_bonus: number | null
          genre_specialization: string[] | null
          id: string
          name: string
          quality_tier: string | null
          reputation: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          booking_fee?: number | null
          created_at?: string | null
          crowd_engagement_bonus?: number | null
          genre_specialization?: string[] | null
          id?: string
          name: string
          quality_tier?: string | null
          reputation?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          booking_fee?: number | null
          created_at?: string | null
          crowd_engagement_bonus?: number | null
          genre_specialization?: string[] | null
          id?: string
          name?: string
          quality_tier?: string | null
          reputation?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      promotional_campaigns: {
        Row: {
          band_id: string | null
          budget: number
          campaign_name: string
          campaign_type: string
          created_at: string
          effects: Json | null
          end_date: string
          id: string
          release_id: string | null
          results: Json | null
          spent: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          band_id?: string | null
          budget?: number
          campaign_name: string
          campaign_type: string
          created_at?: string
          effects?: Json | null
          end_date: string
          id?: string
          release_id?: string | null
          results?: Json | null
          spent?: number
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          band_id?: string | null
          budget?: number
          campaign_name?: string
          campaign_type?: string
          created_at?: string
          effects?: Json | null
          end_date?: string
          id?: string
          release_id?: string | null
          results?: Json | null
          spent?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotional_campaigns_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotional_campaigns_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "chart_albums"
            referencedColumns: ["release_id"]
          },
          {
            foreignKeyName: "promotional_campaigns_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_content: {
        Row: {
          audio_status: string | null
          audio_url: string | null
          brand_name: string | null
          category: string | null
          content_type: string
          created_at: string | null
          duration_seconds: number | null
          humor_style: string | null
          id: string
          is_active: boolean | null
          play_weight: number | null
          script: string
          title: string
          updated_at: string | null
          voice_id: string | null
        }
        Insert: {
          audio_status?: string | null
          audio_url?: string | null
          brand_name?: string | null
          category?: string | null
          content_type: string
          created_at?: string | null
          duration_seconds?: number | null
          humor_style?: string | null
          id?: string
          is_active?: boolean | null
          play_weight?: number | null
          script: string
          title: string
          updated_at?: string | null
          voice_id?: string | null
        }
        Update: {
          audio_status?: string | null
          audio_url?: string | null
          brand_name?: string | null
          category?: string | null
          content_type?: string
          created_at?: string | null
          duration_seconds?: number | null
          humor_style?: string | null
          id?: string
          is_active?: boolean | null
          play_weight?: number | null
          script?: string
          title?: string
          updated_at?: string | null
          voice_id?: string | null
        }
        Relationships: []
      }
      radio_invitations: {
        Row: {
          band_id: string
          completed_at: string | null
          created_at: string | null
          expires_at: string | null
          fame_reward: number | null
          fan_reward: number | null
          id: string
          invitation_type: string
          responded_at: string | null
          scheduled_at: string | null
          show_id: string | null
          station_id: string
          status: string
          xp_reward: number | null
        }
        Insert: {
          band_id: string
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          fame_reward?: number | null
          fan_reward?: number | null
          id?: string
          invitation_type: string
          responded_at?: string | null
          scheduled_at?: string | null
          show_id?: string | null
          station_id: string
          status?: string
          xp_reward?: number | null
        }
        Update: {
          band_id?: string
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          fame_reward?: number | null
          fan_reward?: number | null
          id?: string
          invitation_type?: string
          responded_at?: string | null
          scheduled_at?: string | null
          show_id?: string | null
          station_id?: string
          status?: string
          xp_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "radio_invitations_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_invitations_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "radio_shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_invitations_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "radio_stations"
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "radio_playlists_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "radio_plays_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
          auto_accept_threshold: number | null
          city_id: string | null
          country: string | null
          created_at: string | null
          description: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          listener_base: number
          min_fame_required: number | null
          min_fans_required: number | null
          name: string
          quality_level: number
          requires_local_presence: boolean | null
          station_type: string
          updated_at: string | null
        }
        Insert: {
          accepted_genres?: string[] | null
          auto_accept_threshold?: number | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          listener_base?: number
          min_fame_required?: number | null
          min_fans_required?: number | null
          name: string
          quality_level?: number
          requires_local_presence?: boolean | null
          station_type: string
          updated_at?: string | null
        }
        Update: {
          accepted_genres?: string[] | null
          auto_accept_threshold?: number | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          listener_base?: number
          min_fame_required?: number | null
          min_fans_required?: number | null
          name?: string
          quality_level?: number
          requires_local_presence?: boolean | null
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
          release_id: string | null
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
          release_id?: string | null
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
          release_id?: string | null
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
            foreignKeyName: "radio_submissions_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "chart_albums"
            referencedColumns: ["release_id"]
          },
          {
            foreignKeyName: "radio_submissions_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "radio_submissions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
      random_events: {
        Row: {
          category: string
          created_at: string
          description: string
          health_max: number | null
          health_min: number | null
          id: string
          is_active: boolean
          is_common: boolean
          option_a_effects: Json
          option_a_outcome_text: string
          option_a_text: string
          option_b_effects: Json
          option_b_outcome_text: string
          option_b_text: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          health_max?: number | null
          health_min?: number | null
          id?: string
          is_active?: boolean
          is_common?: boolean
          option_a_effects?: Json
          option_a_outcome_text: string
          option_a_text: string
          option_b_effects?: Json
          option_b_outcome_text: string
          option_b_text: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          health_max?: number | null
          health_min?: number | null
          id?: string
          is_active?: boolean
          is_common?: boolean
          option_a_effects?: Json
          option_a_outcome_text?: string
          option_a_text?: string
          option_b_effects?: Json
          option_b_outcome_text?: string
          option_b_text?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          producer_id: string | null
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
          producer_id?: string | null
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
          producer_id?: string | null
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "recording_sessions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
      recording_studio_equipment: {
        Row: {
          brand: string | null
          condition: number | null
          created_at: string | null
          equipment_name: string
          equipment_type: string
          hourly_rental_rate: number | null
          id: string
          is_available: boolean | null
          is_vintage: boolean | null
          model: string | null
          studio_id: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          brand?: string | null
          condition?: number | null
          created_at?: string | null
          equipment_name: string
          equipment_type: string
          hourly_rental_rate?: number | null
          id?: string
          is_available?: boolean | null
          is_vintage?: boolean | null
          model?: string | null
          studio_id: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          brand?: string | null
          condition?: number | null
          created_at?: string | null
          equipment_name?: string
          equipment_type?: string
          hourly_rental_rate?: number | null
          id?: string
          is_available?: boolean | null
          is_vintage?: boolean | null
          model?: string | null
          studio_id?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_studio_equipment_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "city_studios"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_studio_staff: {
        Row: {
          albums_worked: number | null
          created_at: string | null
          hire_date: string | null
          hit_songs: number | null
          id: string
          is_active: boolean | null
          name: string
          role: string
          salary: number
          skill_level: number | null
          specialty: string | null
          studio_id: string
          updated_at: string | null
        }
        Insert: {
          albums_worked?: number | null
          created_at?: string | null
          hire_date?: string | null
          hit_songs?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          role: string
          salary?: number
          skill_level?: number | null
          specialty?: string | null
          studio_id: string
          updated_at?: string | null
        }
        Update: {
          albums_worked?: number | null
          created_at?: string | null
          hire_date?: string | null
          hit_songs?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          role?: string
          salary?: number
          skill_level?: number | null
          specialty?: string | null
          studio_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_studio_staff_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "city_studios"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_studio_transactions: {
        Row: {
          amount: number
          band_name: string | null
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          studio_id: string
          transaction_date: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          band_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          studio_id: string
          transaction_date?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          band_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          studio_id?: string
          transaction_date?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_studio_transactions_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "city_studios"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_studio_upgrades: {
        Row: {
          cost: number
          created_at: string | null
          effect_description: string | null
          effect_value: number | null
          id: string
          installed_at: string | null
          level: number | null
          name: string
          studio_id: string
          upgrade_type: string
        }
        Insert: {
          cost: number
          created_at?: string | null
          effect_description?: string | null
          effect_value?: number | null
          id?: string
          installed_at?: string | null
          level?: number | null
          name: string
          studio_id: string
          upgrade_type: string
        }
        Update: {
          cost?: number
          created_at?: string | null
          effect_description?: string | null
          effect_value?: number | null
          id?: string
          installed_at?: string | null
          level?: number | null
          name?: string
          studio_id?: string
          upgrade_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_studio_upgrades_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "city_studios"
            referencedColumns: ["id"]
          },
        ]
      }
      rehearsal_room_equipment: {
        Row: {
          condition: number | null
          created_at: string | null
          daily_rate: number | null
          equipment_name: string
          equipment_type: string
          hourly_rate: number | null
          id: string
          is_available: boolean | null
          room_id: string
          updated_at: string | null
        }
        Insert: {
          condition?: number | null
          created_at?: string | null
          daily_rate?: number | null
          equipment_name: string
          equipment_type: string
          hourly_rate?: number | null
          id?: string
          is_available?: boolean | null
          room_id: string
          updated_at?: string | null
        }
        Update: {
          condition?: number | null
          created_at?: string | null
          daily_rate?: number | null
          equipment_name?: string
          equipment_type?: string
          hourly_rate?: number | null
          id?: string
          is_available?: boolean | null
          room_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rehearsal_room_equipment_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rehearsal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rehearsal_room_staff: {
        Row: {
          created_at: string | null
          hire_date: string | null
          id: string
          is_active: boolean | null
          name: string
          performance_rating: number | null
          role: string
          room_id: string
          salary: number
          skill_level: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          performance_rating?: number | null
          role: string
          room_id: string
          salary?: number
          skill_level?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          performance_rating?: number | null
          role?: string
          room_id?: string
          salary?: number
          skill_level?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rehearsal_room_staff_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rehearsal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rehearsal_room_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          room_id: string
          transaction_date: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          room_id: string
          transaction_date?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          room_id?: string
          transaction_date?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehearsal_room_transactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rehearsal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rehearsal_room_upgrades: {
        Row: {
          cost: number
          created_at: string | null
          effect_description: string | null
          effect_value: number | null
          id: string
          installed_at: string | null
          level: number | null
          name: string
          room_id: string
          upgrade_type: string
        }
        Insert: {
          cost: number
          created_at?: string | null
          effect_description?: string | null
          effect_value?: number | null
          id?: string
          installed_at?: string | null
          level?: number | null
          name: string
          room_id: string
          upgrade_type: string
        }
        Update: {
          cost?: number
          created_at?: string | null
          effect_description?: string | null
          effect_value?: number | null
          id?: string
          installed_at?: string | null
          level?: number | null
          name?: string
          room_id?: string
          upgrade_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehearsal_room_upgrades_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rehearsal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rehearsal_rooms: {
        Row: {
          amenities: Json | null
          capacity: number | null
          city_id: string | null
          company_id: string | null
          created_at: string | null
          daily_operating_cost: number | null
          description: string | null
          district_id: string | null
          equipment_quality: number | null
          hourly_rate: number
          id: string
          is_company_owned: boolean | null
          location: string | null
          max_simultaneous_bands: number | null
          monthly_rent: number | null
          name: string
          quality_rating: number | null
          recording_capable: boolean | null
          reputation: number | null
          sessions_completed: number | null
          soundproofing_level: number | null
          total_bookings: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          amenities?: Json | null
          capacity?: number | null
          city_id?: string | null
          company_id?: string | null
          created_at?: string | null
          daily_operating_cost?: number | null
          description?: string | null
          district_id?: string | null
          equipment_quality?: number | null
          hourly_rate?: number
          id?: string
          is_company_owned?: boolean | null
          location?: string | null
          max_simultaneous_bands?: number | null
          monthly_rent?: number | null
          name: string
          quality_rating?: number | null
          recording_capable?: boolean | null
          reputation?: number | null
          sessions_completed?: number | null
          soundproofing_level?: number | null
          total_bookings?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          amenities?: Json | null
          capacity?: number | null
          city_id?: string | null
          company_id?: string | null
          created_at?: string | null
          daily_operating_cost?: number | null
          description?: string | null
          district_id?: string | null
          equipment_quality?: number | null
          hourly_rate?: number
          id?: string
          is_company_owned?: boolean | null
          location?: string | null
          max_simultaneous_bands?: number | null
          monthly_rent?: number | null
          name?: string
          quality_rating?: number | null
          recording_capable?: boolean | null
          reputation?: number | null
          sessions_completed?: number | null
          soundproofing_level?: number | null
          total_bookings?: number | null
          total_revenue?: number | null
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
            foreignKeyName: "rehearsal_rooms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          edition_number: number | null
          edition_quantity: number | null
          format_type: string
          id: string
          is_limited_edition: boolean | null
          manufacturing_completion_date: string | null
          manufacturing_cost: number | null
          manufacturing_status: string | null
          quantity: number | null
          release_date: string
          release_id: string
          retail_price: number | null
          updated_at: string
          vinyl_color: string | null
        }
        Insert: {
          created_at?: string
          distribution_fee_percentage?: number | null
          edition_number?: number | null
          edition_quantity?: number | null
          format_type: string
          id?: string
          is_limited_edition?: boolean | null
          manufacturing_completion_date?: string | null
          manufacturing_cost?: number | null
          manufacturing_status?: string | null
          quantity?: number | null
          release_date: string
          release_id: string
          retail_price?: number | null
          updated_at?: string
          vinyl_color?: string | null
        }
        Update: {
          created_at?: string
          distribution_fee_percentage?: number | null
          edition_number?: number | null
          edition_quantity?: number | null
          format_type?: string
          id?: string
          is_limited_edition?: boolean | null
          manufacturing_completion_date?: string | null
          manufacturing_cost?: number | null
          manufacturing_status?: string | null
          quantity?: number | null
          release_date?: string
          release_id?: string
          retail_price?: number | null
          updated_at?: string
          vinyl_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "release_formats_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "chart_albums"
            referencedColumns: ["release_id"]
          },
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
          country: string | null
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
          country?: string | null
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
          country?: string | null
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
          album_release_id: string | null
          created_at: string
          id: string
          is_b_side: boolean | null
          recording_version: string | null
          release_id: string
          song_id: string
          track_number: number
        }
        Insert: {
          album_release_id?: string | null
          created_at?: string
          id?: string
          is_b_side?: boolean | null
          recording_version?: string | null
          release_id: string
          song_id: string
          track_number: number
        }
        Update: {
          album_release_id?: string | null
          created_at?: string
          id?: string
          is_b_side?: boolean | null
          recording_version?: string | null
          release_id?: string
          song_id?: string
          track_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "release_songs_album_release_id_fkey"
            columns: ["album_release_id"]
            isOneToOne: false
            referencedRelation: "chart_albums"
            referencedColumns: ["release_id"]
          },
          {
            foreignKeyName: "release_songs_album_release_id_fkey"
            columns: ["album_release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_songs_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "chart_albums"
            referencedColumns: ["release_id"]
          },
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "release_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
          cassette_sales: number | null
          catalog_number: string | null
          cd_sales: number | null
          country: string | null
          created_at: string
          digital_sales: number | null
          format_type: string | null
          id: string
          is_greatest_hits: boolean | null
          label_contract_id: string | null
          label_revenue_share_pct: number | null
          last_greatest_hits_date: string | null
          manufacturing_complete_at: string | null
          manufacturing_discount_percentage: number | null
          manufacturing_paid_by_label: boolean | null
          pre_order_count: number | null
          pre_order_start_date: string | null
          promotion_budget: number | null
          release_status: string
          release_type: string
          revenue_share_enabled: boolean | null
          revenue_share_percentage: number | null
          scheduled_release_date: string | null
          streaming_platforms: string[] | null
          title: string
          total_cost: number | null
          total_revenue: number | null
          total_units_sold: number | null
          updated_at: string
          user_id: string | null
          vinyl_sales: number | null
        }
        Insert: {
          artist_name: string
          artwork_url?: string | null
          band_id?: string | null
          cassette_sales?: number | null
          catalog_number?: string | null
          cd_sales?: number | null
          country?: string | null
          created_at?: string
          digital_sales?: number | null
          format_type?: string | null
          id?: string
          is_greatest_hits?: boolean | null
          label_contract_id?: string | null
          label_revenue_share_pct?: number | null
          last_greatest_hits_date?: string | null
          manufacturing_complete_at?: string | null
          manufacturing_discount_percentage?: number | null
          manufacturing_paid_by_label?: boolean | null
          pre_order_count?: number | null
          pre_order_start_date?: string | null
          promotion_budget?: number | null
          release_status?: string
          release_type: string
          revenue_share_enabled?: boolean | null
          revenue_share_percentage?: number | null
          scheduled_release_date?: string | null
          streaming_platforms?: string[] | null
          title: string
          total_cost?: number | null
          total_revenue?: number | null
          total_units_sold?: number | null
          updated_at?: string
          user_id?: string | null
          vinyl_sales?: number | null
        }
        Update: {
          artist_name?: string
          artwork_url?: string | null
          band_id?: string | null
          cassette_sales?: number | null
          catalog_number?: string | null
          cd_sales?: number | null
          country?: string | null
          created_at?: string
          digital_sales?: number | null
          format_type?: string | null
          id?: string
          is_greatest_hits?: boolean | null
          label_contract_id?: string | null
          label_revenue_share_pct?: number | null
          last_greatest_hits_date?: string | null
          manufacturing_complete_at?: string | null
          manufacturing_discount_percentage?: number | null
          manufacturing_paid_by_label?: boolean | null
          pre_order_count?: number | null
          pre_order_start_date?: string | null
          promotion_budget?: number | null
          release_status?: string
          release_type?: string
          revenue_share_enabled?: boolean | null
          revenue_share_percentage?: number | null
          scheduled_release_date?: string | null
          streaming_platforms?: string[] | null
          title?: string
          total_cost?: number | null
          total_revenue?: number | null
          total_units_sold?: number | null
          updated_at?: string
          user_id?: string | null
          vinyl_sales?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "releases_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releases_label_contract_id_fkey"
            columns: ["label_contract_id"]
            isOneToOne: false
            referencedRelation: "artist_label_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_item_catalog: {
        Row: {
          base_cost: number
          category: string
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_premium: boolean | null
          min_fame_required: number
          morale_impact: number
          name: string
          performance_impact: number
          priority: string
          subcategory: string
        }
        Insert: {
          base_cost?: number
          category: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_premium?: boolean | null
          min_fame_required?: number
          morale_impact?: number
          name: string
          performance_impact?: number
          priority?: string
          subcategory: string
        }
        Update: {
          base_cost?: number
          category?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_premium?: boolean | null
          min_fame_required?: number
          morale_impact?: number
          name?: string
          performance_impact?: number
          priority?: string
          subcategory?: string
        }
        Relationships: []
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
      security_contract_assignments: {
        Row: {
          assignment_date: string
          contract_id: string
          created_at: string | null
          guard_id: string
          id: string
          performance_rating: number | null
          status: string | null
        }
        Insert: {
          assignment_date: string
          contract_id: string
          created_at?: string | null
          guard_id: string
          id?: string
          performance_rating?: number | null
          status?: string | null
        }
        Update: {
          assignment_date?: string
          contract_id?: string
          created_at?: string | null
          guard_id?: string
          id?: string
          performance_rating?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_contract_assignments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "security_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_contract_assignments_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "security_guards"
            referencedColumns: ["id"]
          },
        ]
      }
      security_contracts: {
        Row: {
          client_band_id: string | null
          client_company_id: string | null
          contract_type: string
          created_at: string | null
          end_date: string | null
          fee_per_event: number
          gig_id: string | null
          guards_required: number
          id: string
          notes: string | null
          security_firm_id: string
          start_date: string | null
          status: string | null
          total_fee: number | null
          tour_id: string | null
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          client_band_id?: string | null
          client_company_id?: string | null
          contract_type: string
          created_at?: string | null
          end_date?: string | null
          fee_per_event: number
          gig_id?: string | null
          guards_required: number
          id?: string
          notes?: string | null
          security_firm_id: string
          start_date?: string | null
          status?: string | null
          total_fee?: number | null
          tour_id?: string | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          client_band_id?: string | null
          client_company_id?: string | null
          contract_type?: string
          created_at?: string | null
          end_date?: string | null
          fee_per_event?: number
          gig_id?: string | null
          guards_required?: number
          id?: string
          notes?: string | null
          security_firm_id?: string
          start_date?: string | null
          status?: string | null
          total_fee?: number | null
          tour_id?: string | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_contracts_client_band_id_fkey"
            columns: ["client_band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_contracts_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_contracts_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_contracts_security_firm_id_fkey"
            columns: ["security_firm_id"]
            isOneToOne: false
            referencedRelation: "security_firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_contracts_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_contracts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      security_firms: {
        Row: {
          company_id: string
          created_at: string | null
          equipment_quality: number | null
          id: string
          license_level: number | null
          max_guards: number | null
          name: string
          reputation: number | null
          total_contracts_completed: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          equipment_quality?: number | null
          id?: string
          license_level?: number | null
          max_guards?: number | null
          name: string
          reputation?: number | null
          total_contracts_completed?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          equipment_quality?: number | null
          id?: string
          license_level?: number | null
          max_guards?: number | null
          name?: string
          reputation?: number | null
          total_contracts_completed?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_firms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      security_guards: {
        Row: {
          experience_years: number | null
          hired_at: string | null
          id: string
          is_npc: boolean | null
          name: string
          profile_id: string | null
          salary_per_event: number | null
          security_firm_id: string
          skill_level: number | null
          status: string | null
        }
        Insert: {
          experience_years?: number | null
          hired_at?: string | null
          id?: string
          is_npc?: boolean | null
          name: string
          profile_id?: string | null
          salary_per_event?: number | null
          security_firm_id: string
          skill_level?: number | null
          status?: string | null
        }
        Update: {
          experience_years?: number | null
          hired_at?: string | null
          id?: string
          is_npc?: boolean | null
          name?: string
          profile_id?: string | null
          salary_per_event?: number | null
          security_firm_id?: string
          skill_level?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_guards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_guards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_guards_security_firm_id_fkey"
            columns: ["security_firm_id"]
            isOneToOne: false
            referencedRelation: "security_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      self_promotion_activities: {
        Row: {
          activity_type: string
          band_id: string | null
          cost_paid: number | null
          created_at: string | null
          fame_gained: number | null
          fans_gained: number | null
          id: string
          promo_focus: string | null
          scheduled_end: string
          scheduled_start: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          band_id?: string | null
          cost_paid?: number | null
          created_at?: string | null
          fame_gained?: number | null
          fans_gained?: number | null
          id?: string
          promo_focus?: string | null
          scheduled_end: string
          scheduled_start: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          band_id?: string | null
          cost_paid?: number | null
          created_at?: string | null
          fame_gained?: number | null
          fans_gained?: number | null
          id?: string
          promo_focus?: string | null
          scheduled_end?: string
          scheduled_start?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "self_promotion_activities_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      self_promotion_catalog: {
        Row: {
          activity_type: string
          base_cost: number | null
          base_fame_max: number | null
          base_fame_min: number | null
          base_fan_max: number | null
          base_fan_min: number | null
          cooldown_days: number | null
          created_at: string | null
          description: string
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          min_fame_required: number | null
          name: string
          requires_release: boolean | null
        }
        Insert: {
          activity_type: string
          base_cost?: number | null
          base_fame_max?: number | null
          base_fame_min?: number | null
          base_fan_max?: number | null
          base_fan_min?: number | null
          cooldown_days?: number | null
          created_at?: string | null
          description: string
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          min_fame_required?: number | null
          name: string
          requires_release?: boolean | null
        }
        Update: {
          activity_type?: string
          base_cost?: number | null
          base_fame_max?: number | null
          base_fame_min?: number | null
          base_fan_max?: number | null
          base_fan_min?: number | null
          cooldown_days?: number | null
          created_at?: string | null
          description?: string
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          min_fame_required?: number | null
          name?: string
          requires_release?: boolean | null
        }
        Relationships: []
      }
      self_promotion_cooldowns: {
        Row: {
          activity_type: string
          band_id: string | null
          cooldown_expires_at: string
          created_at: string | null
          id: string
        }
        Insert: {
          activity_type: string
          band_id?: string | null
          cooldown_expires_at: string
          created_at?: string | null
          id?: string
        }
        Update: {
          activity_type?: string
          band_id?: string | null
          cooldown_expires_at?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_promotion_cooldowns_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      setlist_performance_items: {
        Row: {
          created_at: string | null
          id: string
          is_encore: boolean | null
          notes: string | null
          performance_item_id: string
          position: number
          setlist_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_encore?: boolean | null
          notes?: string | null
          performance_item_id: string
          position: number
          setlist_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_encore?: boolean | null
          notes?: string | null
          performance_item_id?: string
          position?: number
          setlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setlist_performance_items_performance_item_id_fkey"
            columns: ["performance_item_id"]
            isOneToOne: false
            referencedRelation: "performance_items_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setlist_performance_items_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
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
          crowd_engagement_target: number | null
          energy_level: number | null
          id: string
          is_encore: boolean | null
          item_type: string | null
          notes: string | null
          performance_item_id: string | null
          position: number
          section: string | null
          setlist_id: string
          song_id: string | null
          tempo_bpm: number | null
        }
        Insert: {
          created_at?: string | null
          crowd_engagement_target?: number | null
          energy_level?: number | null
          id?: string
          is_encore?: boolean | null
          item_type?: string | null
          notes?: string | null
          performance_item_id?: string | null
          position: number
          section?: string | null
          setlist_id: string
          song_id?: string | null
          tempo_bpm?: number | null
        }
        Update: {
          created_at?: string | null
          crowd_engagement_target?: number | null
          energy_level?: number | null
          id?: string
          is_encore?: boolean | null
          item_type?: string | null
          notes?: string | null
          performance_item_id?: string | null
          position?: number
          section?: string | null
          setlist_id?: string
          song_id?: string | null
          tempo_bpm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "setlist_songs_performance_item_id_fkey"
            columns: ["performance_item_id"]
            isOneToOne: false
            referencedRelation: "performance_items_catalog"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "setlist_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
          {
            foreignKeyName: "shift_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
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
      skill_improvements: {
        Row: {
          created_at: string | null
          id: string
          improved_at: string
          improvement_amount: number
          new_value: number
          previous_value: number
          skill_name: string
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          improved_at?: string
          improvement_amount: number
          new_value: number
          previous_value: number
          skill_name: string
          source?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          improved_at?: string
          improvement_amount?: number
          new_value?: number
          previous_value?: number
          skill_name?: string
          source?: string | null
          user_id?: string
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
      skin_collections: {
        Row: {
          banner_image_url: string | null
          created_at: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          starts_at: string
          theme: string | null
          updated_at: string | null
        }
        Insert: {
          banner_image_url?: string | null
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          starts_at?: string
          theme?: string | null
          updated_at?: string | null
        }
        Update: {
          banner_image_url?: string | null
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          starts_at?: string
          theme?: string | null
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
      song_generation_attempts: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          prompt_used: string | null
          song_id: string
          started_at: string
          status: string
          timeout_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          prompt_used?: string | null
          song_id: string
          started_at?: string
          status?: string
          timeout_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          prompt_used?: string | null
          song_id?: string
          started_at?: string
          status?: string
          timeout_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_generation_attempts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_generation_attempts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_generation_attempts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_generation_attempts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_market_listings_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
      song_plays: {
        Row: {
          created_at: string | null
          id: string
          played_at: string | null
          song_id: string
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          played_at?: string | null
          song_id: string
          source?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          played_at?: string | null
          song_id?: string
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_plays_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_plays_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_plays_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_plays_song_id_fkey"
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_rehearsals_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          platform_id: string
          platform_name: string | null
          release_date: string
          release_id: string | null
          release_type: string
          song_id: string
          total_revenue: number
          total_streams: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          band_id?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          platform_id: string
          platform_name?: string | null
          release_date?: string
          release_id?: string | null
          release_type?: string
          song_id: string
          total_revenue?: number
          total_streams?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          band_id?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          platform_id?: string
          platform_name?: string | null
          release_date?: string
          release_id?: string | null
          release_type?: string
          song_id?: string
          total_revenue?: number
          total_streams?: number
          updated_at?: string
          user_id?: string | null
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
            referencedRelation: "chart_albums"
            referencedColumns: ["release_id"]
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_releases_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_sales_royalties_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
      song_votes: {
        Row: {
          created_at: string | null
          id: string
          song_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          song_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          song_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_votes_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_votes_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "song_votes_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_votes_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          added_to_repertoire_at: string | null
          added_to_repertoire_by: string | null
          ai_generated_lyrics: boolean | null
          archived: boolean | null
          arrangement_strength: number | null
          audio_generated_at: string | null
          audio_generation_started_at: string | null
          audio_generation_status: string | null
          audio_prompt: string | null
          audio_url: string | null
          band_id: string | null
          catalog_status: string | null
          chart_position: number | null
          chord_progression_id: string | null
          completed_at: string | null
          created_at: string
          duration_display: string | null
          duration_seconds: number | null
          extended_audio_generated_at: string | null
          extended_audio_url: string | null
          fame: number | null
          genre: string
          hype: number | null
          id: string
          is_extended_featured: boolean | null
          last_radio_play: string | null
          lyrics: string | null
          lyrics_progress: number | null
          lyrics_strength: number | null
          market_listing_id: string | null
          melody_strength: number | null
          music_progress: number | null
          original_writer_id: string | null
          ownership_type: string | null
          parent_song_id: string | null
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
          version: string | null
        }
        Insert: {
          added_to_repertoire_at?: string | null
          added_to_repertoire_by?: string | null
          ai_generated_lyrics?: boolean | null
          archived?: boolean | null
          arrangement_strength?: number | null
          audio_generated_at?: string | null
          audio_generation_started_at?: string | null
          audio_generation_status?: string | null
          audio_prompt?: string | null
          audio_url?: string | null
          band_id?: string | null
          catalog_status?: string | null
          chart_position?: number | null
          chord_progression_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_display?: string | null
          duration_seconds?: number | null
          extended_audio_generated_at?: string | null
          extended_audio_url?: string | null
          fame?: number | null
          genre: string
          hype?: number | null
          id?: string
          is_extended_featured?: boolean | null
          last_radio_play?: string | null
          lyrics?: string | null
          lyrics_progress?: number | null
          lyrics_strength?: number | null
          market_listing_id?: string | null
          melody_strength?: number | null
          music_progress?: number | null
          original_writer_id?: string | null
          ownership_type?: string | null
          parent_song_id?: string | null
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
          version?: string | null
        }
        Update: {
          added_to_repertoire_at?: string | null
          added_to_repertoire_by?: string | null
          ai_generated_lyrics?: boolean | null
          archived?: boolean | null
          arrangement_strength?: number | null
          audio_generated_at?: string | null
          audio_generation_started_at?: string | null
          audio_generation_status?: string | null
          audio_prompt?: string | null
          audio_url?: string | null
          band_id?: string | null
          catalog_status?: string | null
          chart_position?: number | null
          chord_progression_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_display?: string | null
          duration_seconds?: number | null
          extended_audio_generated_at?: string | null
          extended_audio_url?: string | null
          fame?: number | null
          genre?: string
          hype?: number | null
          id?: string
          is_extended_featured?: boolean | null
          last_radio_play?: string | null
          lyrics?: string | null
          lyrics_progress?: number | null
          lyrics_strength?: number | null
          market_listing_id?: string | null
          melody_strength?: number | null
          music_progress?: number | null
          original_writer_id?: string | null
          ownership_type?: string | null
          parent_song_id?: string | null
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
          version?: string | null
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
            foreignKeyName: "songs_parent_song_id_fkey"
            columns: ["parent_song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "songs_parent_song_id_fkey"
            columns: ["parent_song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "songs_parent_song_id_fkey"
            columns: ["parent_song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_parent_song_id_fkey"
            columns: ["parent_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
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
            foreignKeyName: "songs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_player_cards"
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
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "songwriting_projects_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
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
      sponsorship_brands: {
        Row: {
          available_budget: number | null
          category: string
          cooldown_until: string | null
          created_at: string
          exclusivity_pref: boolean | null
          id: string
          is_active: boolean
          logo_url: string | null
          min_fame_required: number
          min_fame_threshold: number | null
          name: string
          region: string
          size: string
          targeting_flags: string[] | null
          updated_at: string
          wealth_score: number | null
          wealth_tier: number
        }
        Insert: {
          available_budget?: number | null
          category?: string
          cooldown_until?: string | null
          created_at?: string
          exclusivity_pref?: boolean | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          min_fame_required?: number
          min_fame_threshold?: number | null
          name: string
          region?: string
          size?: string
          targeting_flags?: string[] | null
          updated_at?: string
          wealth_score?: number | null
          wealth_tier?: number
        }
        Update: {
          available_budget?: number | null
          category?: string
          cooldown_until?: string | null
          created_at?: string
          exclusivity_pref?: boolean | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          min_fame_required?: number
          min_fame_threshold?: number | null
          name?: string
          region?: string
          size?: string
          targeting_flags?: string[] | null
          updated_at?: string
          wealth_score?: number | null
          wealth_tier?: number
        }
        Relationships: []
      }
      sponsorship_contracts: {
        Row: {
          band_id: string
          brand_id: string
          created_at: string
          deliverables: string[] | null
          end_date: string | null
          exclusivity: boolean
          health: number
          id: string
          last_payment_at: string | null
          offer_id: string | null
          start_date: string
          status: string
          term_weeks: number
          total_paid: number
          total_value: number
          updated_at: string
          weekly_payment: number
          weeks_paid: number
        }
        Insert: {
          band_id: string
          brand_id: string
          created_at?: string
          deliverables?: string[] | null
          end_date?: string | null
          exclusivity?: boolean
          health?: number
          id?: string
          last_payment_at?: string | null
          offer_id?: string | null
          start_date?: string
          status?: string
          term_weeks: number
          total_paid?: number
          total_value: number
          updated_at?: string
          weekly_payment: number
          weeks_paid?: number
        }
        Update: {
          band_id?: string
          brand_id?: string
          created_at?: string
          deliverables?: string[] | null
          end_date?: string | null
          exclusivity?: boolean
          health?: number
          id?: string
          last_payment_at?: string | null
          offer_id?: string | null
          start_date?: string
          status?: string
          term_weeks?: number
          total_paid?: number
          total_value?: number
          updated_at?: string
          weekly_payment?: number
          weeks_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_contracts_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_contracts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "sponsorship_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_contracts_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "sponsorship_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorship_offers: {
        Row: {
          band_id: string
          brand_id: string
          created_at: string
          exclusivity: boolean
          expires_at: string
          fit_score: number
          id: string
          notes: string | null
          status: string
          term_weeks: number
          total_value: number
        }
        Insert: {
          band_id: string
          brand_id: string
          created_at?: string
          exclusivity?: boolean
          expires_at: string
          fit_score?: number
          id?: string
          notes?: string | null
          status?: string
          term_weeks?: number
          total_value: number
        }
        Update: {
          band_id?: string
          brand_id?: string
          created_at?: string
          exclusivity?: boolean
          expires_at?: string
          fit_score?: number
          id?: string
          notes?: string | null
          status?: string
          term_weeks?: number
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_offers_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_offers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "sponsorship_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorship_payments: {
        Row: {
          amount: number
          band_id: string
          contract_id: string
          created_at: string
          id: string
          paid_at: string | null
          scheduled_at: string | null
          status: string | null
          week_number: number
        }
        Insert: {
          amount: number
          band_id: string
          contract_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          week_number: number
        }
        Update: {
          amount?: number
          band_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_payments_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "sponsorship_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_equipment_catalog: {
        Row: {
          amount_available: number
          base_condition: string
          cost: number
          created_at: string
          description: string | null
          id: string
          live_impact: string
          name: string
          rarity: string
          size: string
          type: string
          updated_at: string
          weight: string
        }
        Insert: {
          amount_available?: number
          base_condition: string
          cost: number
          created_at?: string
          description?: string | null
          id: string
          live_impact: string
          name: string
          rarity: string
          size: string
          type: string
          updated_at?: string
          weight: string
        }
        Update: {
          amount_available?: number
          base_condition?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          live_impact?: string
          name?: string
          rarity?: string
          size?: string
          type?: string
          updated_at?: string
          weight?: string
        }
        Relationships: []
      }
      stage_events: {
        Row: {
          description: string | null
          event_type: string
          gig_id: string | null
          id: string
          impact_score: number | null
          occurred_at: string | null
          severity: string | null
          song_position: number | null
        }
        Insert: {
          description?: string | null
          event_type: string
          gig_id?: string | null
          id?: string
          impact_score?: number | null
          occurred_at?: string | null
          severity?: string | null
          song_position?: number | null
        }
        Update: {
          description?: string | null
          event_type?: string
          gig_id?: string | null
          id?: string
          impact_score?: number | null
          occurred_at?: string | null
          severity?: string | null
          song_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_events_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_templates: {
        Row: {
          backdrop_texture_url: string | null
          camera_offset: Json | null
          capacity_max: number
          capacity_min: number
          created_at: string | null
          crowd_sprite_set: string | null
          default_light_profile_id: string | null
          floor_texture_url: string | null
          gltf_asset_path: string | null
          id: string
          is_active: boolean | null
          is_outdoor: boolean | null
          metadata: Json | null
          name: string
          size: string
          sky_preset: string | null
          slug: string
          spline_scene_url: string | null
          time_of_day: string | null
          updated_at: string | null
        }
        Insert: {
          backdrop_texture_url?: string | null
          camera_offset?: Json | null
          capacity_max?: number
          capacity_min?: number
          created_at?: string | null
          crowd_sprite_set?: string | null
          default_light_profile_id?: string | null
          floor_texture_url?: string | null
          gltf_asset_path?: string | null
          id?: string
          is_active?: boolean | null
          is_outdoor?: boolean | null
          metadata?: Json | null
          name: string
          size: string
          sky_preset?: string | null
          slug: string
          spline_scene_url?: string | null
          time_of_day?: string | null
          updated_at?: string | null
        }
        Update: {
          backdrop_texture_url?: string | null
          camera_offset?: Json | null
          capacity_max?: number
          capacity_min?: number
          created_at?: string | null
          crowd_sprite_set?: string | null
          default_light_profile_id?: string | null
          floor_texture_url?: string | null
          gltf_asset_path?: string | null
          id?: string
          is_active?: boolean | null
          is_outdoor?: boolean | null
          metadata?: Json | null
          name?: string
          size?: string
          sky_preset?: string | null
          slug?: string
          spline_scene_url?: string | null
          time_of_day?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          monthly_active_users: number | null
          platform_icon_url: string | null
          platform_name: string
          quality_multiplier: number
          total_users: number | null
          updated_at: string
        }
        Insert: {
          base_payout_per_stream?: number
          created_at?: string
          genre_bonuses?: Json | null
          id?: string
          is_active?: boolean
          min_quality_requirement?: number
          monthly_active_users?: number | null
          platform_icon_url?: string | null
          platform_name: string
          quality_multiplier?: number
          total_users?: number | null
          updated_at?: string
        }
        Update: {
          base_payout_per_stream?: number
          created_at?: string
          genre_bonuses?: Json | null
          id?: string
          is_active?: boolean
          min_quality_requirement?: number
          monthly_active_users?: number | null
          platform_icon_url?: string | null
          platform_name?: string
          quality_multiplier?: number
          total_users?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      territories: {
        Row: {
          code: string
          created_at: string | null
          name: string
          region: string
        }
        Insert: {
          code: string
          created_at?: string | null
          name: string
          region: string
        }
        Update: {
          code?: string
          created_at?: string | null
          name?: string
          region?: string
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          created_at: string | null
          id: string
          price_per_token: number
          quantity: number
          token_id: string
          total_amount: number
          transaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          price_per_token: number
          quantity: number
          token_id: string
          total_amount: number
          transaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          price_per_token?: number
          quantity?: number
          token_id?: string
          total_amount?: number
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "crypto_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_gigs: {
        Row: {
          created_at: string | null
          gig_id: string | null
          id: string
          position: number
          tour_id: string | null
          travel_cost: number | null
          travel_distance_km: number | null
        }
        Insert: {
          created_at?: string | null
          gig_id?: string | null
          id?: string
          position: number
          tour_id?: string | null
          travel_cost?: number | null
          travel_distance_km?: number | null
        }
        Update: {
          created_at?: string | null
          gig_id?: string | null
          id?: string
          position?: number
          tour_id?: string | null
          travel_cost?: number | null
          travel_distance_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_gigs_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_gigs_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_logistics: {
        Row: {
          created_at: string | null
          daily_costs: number | null
          fatigue_level: number | null
          id: string
          log_date: string
          morale_level: number | null
          notes: string | null
          tour_id: string | null
          vehicle_condition: number | null
        }
        Insert: {
          created_at?: string | null
          daily_costs?: number | null
          fatigue_level?: number | null
          id?: string
          log_date: string
          morale_level?: number | null
          notes?: string | null
          tour_id?: string | null
          vehicle_condition?: number | null
        }
        Update: {
          created_at?: string | null
          daily_costs?: number | null
          fatigue_level?: number | null
          id?: string
          log_date?: string
          morale_level?: number | null
          notes?: string | null
          tour_id?: string | null
          vehicle_condition?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_logistics_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_travel_legs: {
        Row: {
          arrival_date: string | null
          created_at: string | null
          departure_date: string | null
          from_city_id: string | null
          id: string
          sequence_order: number
          to_city_id: string | null
          tour_id: string
          travel_cost: number | null
          travel_duration_hours: number | null
          travel_mode: string
        }
        Insert: {
          arrival_date?: string | null
          created_at?: string | null
          departure_date?: string | null
          from_city_id?: string | null
          id?: string
          sequence_order?: number
          to_city_id?: string | null
          tour_id: string
          travel_cost?: number | null
          travel_duration_hours?: number | null
          travel_mode: string
        }
        Update: {
          arrival_date?: string | null
          created_at?: string | null
          departure_date?: string | null
          from_city_id?: string | null
          id?: string
          sequence_order?: number
          to_city_id?: string | null
          tour_id?: string
          travel_cost?: number | null
          travel_duration_hours?: number | null
          travel_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_travel_legs_from_city_id_fkey"
            columns: ["from_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_travel_legs_to_city_id_fkey"
            columns: ["to_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_travel_legs_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_venues: {
        Row: {
          booking_fee: number | null
          city_id: string | null
          date: string
          estimated_revenue: number | null
          id: string
          revenue: number | null
          status: string | null
          ticket_price: number | null
          tickets_sold: number | null
          tour_id: string
          venue_id: string
        }
        Insert: {
          booking_fee?: number | null
          city_id?: string | null
          date: string
          estimated_revenue?: number | null
          id?: string
          revenue?: number | null
          status?: string | null
          ticket_price?: number | null
          tickets_sold?: number | null
          tour_id: string
          venue_id: string
        }
        Update: {
          booking_fee?: number | null
          city_id?: string | null
          date?: string
          estimated_revenue?: number | null
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
            foreignKeyName: "tour_venues_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
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
          auto_pilot_enabled: boolean | null
          band_id: string | null
          cancellation_date: string | null
          cancellation_refund_amount: number | null
          cancelled: boolean | null
          created_at: string | null
          custom_ticket_price: number | null
          description: string | null
          end_date: string
          id: string
          max_venue_capacity: number | null
          merch_boost_multiplier: number | null
          min_rest_days: number | null
          name: string
          scope: string | null
          selected_continents: string[] | null
          selected_countries: string[] | null
          setlist_id: string | null
          sponsor_cash_value: number | null
          sponsor_fame_penalty: number | null
          sponsor_offer_id: string | null
          sponsor_ticket_penalty: number | null
          stage_setup_cost: number | null
          stage_setup_tier: string | null
          start_date: string
          starting_city_id: string | null
          status: string | null
          support_band_id: string | null
          support_revenue_share: number | null
          target_show_count: number | null
          total_accommodation_cost: number | null
          total_revenue: number | null
          total_travel_cost: number | null
          total_upfront_cost: number | null
          tour_bus_daily_cost: number | null
          travel_manager_booked: boolean | null
          travel_mode: string | null
          user_id: string
          vehicle_id: string | null
          venue_type_filter: string[] | null
        }
        Insert: {
          auto_pilot_enabled?: boolean | null
          band_id?: string | null
          cancellation_date?: string | null
          cancellation_refund_amount?: number | null
          cancelled?: boolean | null
          created_at?: string | null
          custom_ticket_price?: number | null
          description?: string | null
          end_date: string
          id?: string
          max_venue_capacity?: number | null
          merch_boost_multiplier?: number | null
          min_rest_days?: number | null
          name: string
          scope?: string | null
          selected_continents?: string[] | null
          selected_countries?: string[] | null
          setlist_id?: string | null
          sponsor_cash_value?: number | null
          sponsor_fame_penalty?: number | null
          sponsor_offer_id?: string | null
          sponsor_ticket_penalty?: number | null
          stage_setup_cost?: number | null
          stage_setup_tier?: string | null
          start_date: string
          starting_city_id?: string | null
          status?: string | null
          support_band_id?: string | null
          support_revenue_share?: number | null
          target_show_count?: number | null
          total_accommodation_cost?: number | null
          total_revenue?: number | null
          total_travel_cost?: number | null
          total_upfront_cost?: number | null
          tour_bus_daily_cost?: number | null
          travel_manager_booked?: boolean | null
          travel_mode?: string | null
          user_id: string
          vehicle_id?: string | null
          venue_type_filter?: string[] | null
        }
        Update: {
          auto_pilot_enabled?: boolean | null
          band_id?: string | null
          cancellation_date?: string | null
          cancellation_refund_amount?: number | null
          cancelled?: boolean | null
          created_at?: string | null
          custom_ticket_price?: number | null
          description?: string | null
          end_date?: string
          id?: string
          max_venue_capacity?: number | null
          merch_boost_multiplier?: number | null
          min_rest_days?: number | null
          name?: string
          scope?: string | null
          selected_continents?: string[] | null
          selected_countries?: string[] | null
          setlist_id?: string | null
          sponsor_cash_value?: number | null
          sponsor_fame_penalty?: number | null
          sponsor_offer_id?: string | null
          sponsor_ticket_penalty?: number | null
          stage_setup_cost?: number | null
          stage_setup_tier?: string | null
          start_date?: string
          starting_city_id?: string | null
          status?: string | null
          support_band_id?: string | null
          support_revenue_share?: number | null
          target_show_count?: number | null
          total_accommodation_cost?: number | null
          total_revenue?: number | null
          total_travel_cost?: number | null
          total_upfront_cost?: number | null
          tour_bus_daily_cost?: number | null
          travel_manager_booked?: boolean | null
          travel_mode?: string | null
          user_id?: string
          vehicle_id?: string | null
          venue_type_filter?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "tours_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tours_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tours_starting_city_id_fkey"
            columns: ["starting_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tours_support_band_id_fkey"
            columns: ["support_band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tours_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "band_vehicles"
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
      tshirt_designs: {
        Row: {
          background_color: string
          band_id: string | null
          created_at: string | null
          design_data: Json
          design_name: string
          id: string
          preview_image_url: string | null
          updated_at: string | null
        }
        Insert: {
          background_color: string
          band_id?: string | null
          created_at?: string | null
          design_data: Json
          design_name: string
          id?: string
          preview_image_url?: string | null
          updated_at?: string | null
        }
        Update: {
          background_color?: string
          band_id?: string | null
          created_at?: string | null
          design_data?: Json
          design_name?: string
          id?: string
          preview_image_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tshirt_designs_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_steps: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          order_index: number
          step_key: string
          target_element: string | null
          target_route: string | null
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          order_index?: number
          step_key: string
          target_element?: string | null
          target_route?: string | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          order_index?: number
          step_key?: string
          target_element?: string | null
          target_route?: string | null
          title?: string
        }
        Relationships: []
      }
      tv_networks: {
        Row: {
          city_id: string | null
          country: string | null
          created_at: string | null
          description: string | null
          genres: string[] | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          min_fame_required: number | null
          min_fans_required: number | null
          name: string
          network_type: string | null
          quality_level: number | null
          updated_at: string | null
          viewer_base: number | null
        }
        Insert: {
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          genres?: string[] | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          min_fame_required?: number | null
          min_fans_required?: number | null
          name: string
          network_type?: string | null
          quality_level?: number | null
          updated_at?: string | null
          viewer_base?: number | null
        }
        Update: {
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          genres?: string[] | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          min_fame_required?: number | null
          min_fans_required?: number | null
          name?: string
          network_type?: string | null
          quality_level?: number | null
          updated_at?: string | null
          viewer_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_networks_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_shows: {
        Row: {
          compensation_max: number | null
          compensation_min: number | null
          created_at: string | null
          days_of_week: number[] | null
          description: string | null
          fame_boost_max: number | null
          fame_boost_min: number | null
          fan_boost_max: number | null
          fan_boost_min: number | null
          host_name: string | null
          id: string
          is_active: boolean | null
          min_fame_required: number | null
          network_id: string | null
          show_name: string
          show_type: string | null
          slots_per_day: number | null
          time_slot: string | null
          viewer_reach: number | null
        }
        Insert: {
          compensation_max?: number | null
          compensation_min?: number | null
          created_at?: string | null
          days_of_week?: number[] | null
          description?: string | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          host_name?: string | null
          id?: string
          is_active?: boolean | null
          min_fame_required?: number | null
          network_id?: string | null
          show_name: string
          show_type?: string | null
          slots_per_day?: number | null
          time_slot?: string | null
          viewer_reach?: number | null
        }
        Update: {
          compensation_max?: number | null
          compensation_min?: number | null
          created_at?: string | null
          days_of_week?: number[] | null
          description?: string | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          host_name?: string | null
          id?: string
          is_active?: boolean | null
          min_fame_required?: number | null
          network_id?: string | null
          show_name?: string
          show_type?: string | null
          slots_per_day?: number | null
          time_slot?: string | null
          viewer_reach?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_shows_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "tv_networks"
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
          banner_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string
          engagement_score: number | null
          fame_score: number | null
          follower_count: number | null
          followers_gained_today: number | null
          following_count: number | null
          handle: string
          id: string
          last_follower_reset: string | null
          last_post_at: string | null
          location: string | null
          owner_id: string
          owner_type: Database["public"]["Enums"]["twaater_owner_type"]
          posts_today: number | null
          profile_views: number | null
          quality_rating: number | null
          updated_at: string | null
          verified: boolean | null
          website_url: string | null
        }
        Insert: {
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name: string
          engagement_score?: number | null
          fame_score?: number | null
          follower_count?: number | null
          followers_gained_today?: number | null
          following_count?: number | null
          handle: string
          id?: string
          last_follower_reset?: string | null
          last_post_at?: string | null
          location?: string | null
          owner_id: string
          owner_type: Database["public"]["Enums"]["twaater_owner_type"]
          posts_today?: number | null
          profile_views?: number | null
          quality_rating?: number | null
          updated_at?: string | null
          verified?: boolean | null
          website_url?: string | null
        }
        Update: {
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          engagement_score?: number | null
          fame_score?: number | null
          follower_count?: number | null
          followers_gained_today?: number | null
          following_count?: number | null
          handle?: string
          id?: string
          last_follower_reset?: string | null
          last_post_at?: string | null
          location?: string | null
          owner_id?: string
          owner_type?: Database["public"]["Enums"]["twaater_owner_type"]
          posts_today?: number | null
          profile_views?: number | null
          quality_rating?: number | null
          updated_at?: string | null
          verified?: boolean | null
          website_url?: string | null
        }
        Relationships: []
      }
      twaater_ai_preferences: {
        Row: {
          account_id: string
          created_at: string | null
          interaction_history: Json | null
          last_updated: string | null
          preferred_genres: string[] | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          interaction_history?: Json | null
          last_updated?: string | null
          preferred_genres?: string[] | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          interaction_history?: Json | null
          last_updated?: string | null
          preferred_genres?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "twaater_ai_preferences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_bookmarks: {
        Row: {
          account_id: string
          created_at: string
          id: string
          twaat_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          twaat_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          twaat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twaater_bookmarks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_bookmarks_twaat_id_fkey"
            columns: ["twaat_id"]
            isOneToOne: false
            referencedRelation: "twaats"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_bot_accounts: {
        Row: {
          account_id: string
          bot_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_posted_at: string | null
          personality_traits: Json | null
          posting_frequency: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          bot_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_posted_at?: string | null
          personality_traits?: Json | null
          posting_frequency?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          bot_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_posted_at?: string | null
          personality_traits?: Json | null
          posting_frequency?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "twaater_bot_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          participant_1_id: string
          participant_2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_1_id: string
          participant_2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_1_id?: string
          participant_2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twaater_conversations_participant_1_id_fkey"
            columns: ["participant_1_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_conversations_participant_2_id_fkey"
            columns: ["participant_2_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      twaater_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twaater_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "twaater_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_notifications: {
        Row: {
          account_id: string
          created_at: string
          id: string
          read_at: string | null
          related_twaat_id: string | null
          source_account_id: string | null
          type: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          related_twaat_id?: string | null
          source_account_id?: string | null
          type: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          related_twaat_id?: string | null
          source_account_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "twaater_notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_notifications_related_twaat_id_fkey"
            columns: ["related_twaat_id"]
            isOneToOne: false
            referencedRelation: "twaats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_notifications_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
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
      twaater_poll_options: {
        Row: {
          display_order: number
          id: string
          option_text: string
          poll_id: string
          vote_count: number
        }
        Insert: {
          display_order?: number
          id?: string
          option_text: string
          poll_id: string
          vote_count?: number
        }
        Update: {
          display_order?: number
          id?: string
          option_text?: string
          poll_id?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "twaater_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "twaater_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_poll_votes: {
        Row: {
          account_id: string
          created_at: string
          id: string
          option_id: string
          poll_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twaater_poll_votes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "twaater_poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "twaater_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_polls: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          question: string
          twaat_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          question: string
          twaat_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          question?: string
          twaat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twaater_polls_twaat_id_fkey"
            columns: ["twaat_id"]
            isOneToOne: false
            referencedRelation: "twaats"
            referencedColumns: ["id"]
          },
        ]
      }
      twaater_profile_views: {
        Row: {
          id: string
          viewed_account_id: string
          viewed_at: string | null
          viewer_account_id: string
        }
        Insert: {
          id?: string
          viewed_account_id: string
          viewed_at?: string | null
          viewer_account_id: string
        }
        Update: {
          id?: string
          viewed_account_id?: string
          viewed_at?: string | null
          viewer_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twaater_profile_views_viewed_account_id_fkey"
            columns: ["viewed_account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaater_profile_views_viewer_account_id_fkey"
            columns: ["viewer_account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
        ]
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
          media_type: string | null
          media_url: string | null
          outcome_code: string | null
          quoted_twaat_id: string | null
          scheduled_for: string | null
          sentiment: number | null
          visibility: Database["public"]["Enums"]["twaater_visibility"] | null
          xp_awarded: number | null
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
          media_type?: string | null
          media_url?: string | null
          outcome_code?: string | null
          quoted_twaat_id?: string | null
          scheduled_for?: string | null
          sentiment?: number | null
          visibility?: Database["public"]["Enums"]["twaater_visibility"] | null
          xp_awarded?: number | null
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
          media_type?: string | null
          media_url?: string | null
          outcome_code?: string | null
          quoted_twaat_id?: string | null
          scheduled_for?: string | null
          sentiment?: number | null
          visibility?: Database["public"]["Enums"]["twaater_visibility"] | null
          xp_awarded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "twaats_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "twaater_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twaats_quoted_twaat_id_fkey"
            columns: ["quoted_twaat_id"]
            isOneToOne: false
            referencedRelation: "twaats"
            referencedColumns: ["id"]
          },
        ]
      }
      underworld_products: {
        Row: {
          category: string
          created_at: string | null
          current_stock: number | null
          description: string | null
          duration_hours: number | null
          effects: Json | null
          icon_name: string | null
          id: string
          is_available: boolean | null
          lore: string | null
          name: string
          price_cash: number | null
          price_token_amount: number | null
          price_token_id: string | null
          rarity: string | null
          restock_at: string | null
          stock_limit: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          current_stock?: number | null
          description?: string | null
          duration_hours?: number | null
          effects?: Json | null
          icon_name?: string | null
          id?: string
          is_available?: boolean | null
          lore?: string | null
          name: string
          price_cash?: number | null
          price_token_amount?: number | null
          price_token_id?: string | null
          rarity?: string | null
          restock_at?: string | null
          stock_limit?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          current_stock?: number | null
          description?: string | null
          duration_hours?: number | null
          effects?: Json | null
          icon_name?: string | null
          id?: string
          is_available?: boolean | null
          lore?: string | null
          name?: string
          price_cash?: number | null
          price_token_amount?: number | null
          price_token_id?: string | null
          rarity?: string | null
          restock_at?: string | null
          stock_limit?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "underworld_products_price_token_id_fkey"
            columns: ["price_token_id"]
            isOneToOne: false
            referencedRelation: "crypto_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      underworld_purchases: {
        Row: {
          applied_at: string | null
          cash_amount: number | null
          created_at: string | null
          effects_applied: Json | null
          expires_at: string | null
          id: string
          is_used: boolean | null
          paid_with: string
          product_id: string
          quantity: number | null
          token_amount: number | null
          token_id: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          cash_amount?: number | null
          created_at?: string | null
          effects_applied?: Json | null
          expires_at?: string | null
          id?: string
          is_used?: boolean | null
          paid_with: string
          product_id: string
          quantity?: number | null
          token_amount?: number | null
          token_id?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          cash_amount?: number | null
          created_at?: string | null
          effects_applied?: Json | null
          expires_at?: string | null
          id?: string
          is_used?: boolean | null
          paid_with?: string
          product_id?: string
          quantity?: number | null
          token_amount?: number | null
          token_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "underworld_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "underworld_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "underworld_purchases_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "crypto_tokens"
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
          class_end_hour: number | null
          class_start_hour: number | null
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
          class_end_hour?: number | null
          class_start_hour?: number | null
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
          class_end_hour?: number | null
          class_start_hour?: number | null
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
      vehicle_catalog: {
        Row: {
          capacity_units: number
          comfort_rating: number | null
          created_at: string | null
          description: string | null
          fuel_cost_per_km: number | null
          id: string
          image_url: string | null
          lease_monthly_cost: number | null
          maintenance_interval_km: number | null
          name: string
          purchase_cost: number
          rental_daily_cost: number
          speed_modifier: number | null
          vehicle_type: string
        }
        Insert: {
          capacity_units?: number
          comfort_rating?: number | null
          created_at?: string | null
          description?: string | null
          fuel_cost_per_km?: number | null
          id?: string
          image_url?: string | null
          lease_monthly_cost?: number | null
          maintenance_interval_km?: number | null
          name: string
          purchase_cost?: number
          rental_daily_cost?: number
          speed_modifier?: number | null
          vehicle_type: string
        }
        Update: {
          capacity_units?: number
          comfort_rating?: number | null
          created_at?: string | null
          description?: string | null
          fuel_cost_per_km?: number | null
          id?: string
          image_url?: string | null
          lease_monthly_cost?: number | null
          maintenance_interval_km?: number | null
          name?: string
          purchase_cost?: number
          rental_daily_cost?: number
          speed_modifier?: number | null
          vehicle_type?: string
        }
        Relationships: []
      }
      venue_bookings: {
        Row: {
          band_id: string | null
          bar_revenue_share_pct: number | null
          booking_date: string
          booking_type: string
          created_at: string
          end_time: string | null
          gig_id: string | null
          id: string
          notes: string | null
          rental_fee: number | null
          start_time: string | null
          status: string
          ticket_revenue_share_pct: number | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          band_id?: string | null
          bar_revenue_share_pct?: number | null
          booking_date: string
          booking_type?: string
          created_at?: string
          end_time?: string | null
          gig_id?: string | null
          id?: string
          notes?: string | null
          rental_fee?: number | null
          start_time?: string | null
          status?: string
          ticket_revenue_share_pct?: number | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          band_id?: string | null
          bar_revenue_share_pct?: number | null
          booking_date?: string
          booking_type?: string
          created_at?: string
          end_time?: string | null
          gig_id?: string | null
          id?: string
          notes?: string | null
          rental_fee?: number | null
          start_time?: string | null
          status?: string
          ticket_revenue_share_pct?: number | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_bookings_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_bookings_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_financial_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          related_booking_id: string | null
          transaction_type: string
          venue_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          related_booking_id?: string | null
          transaction_type: string
          venue_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          related_booking_id?: string | null
          transaction_type?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_financial_transactions_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "venue_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_financial_transactions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_relationships: {
        Row: {
          band_id: string | null
          created_at: string | null
          gigs_performed: number | null
          id: string
          last_performance_date: string | null
          loyalty_points: number | null
          payout_bonus: number | null
          relationship_tier: string | null
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          band_id?: string | null
          created_at?: string | null
          gigs_performed?: number | null
          id?: string
          last_performance_date?: string | null
          loyalty_points?: number | null
          payout_bonus?: number | null
          relationship_tier?: string | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          band_id?: string | null
          created_at?: string | null
          gigs_performed?: number | null
          id?: string
          last_performance_date?: string | null
          loyalty_points?: number | null
          payout_bonus?: number | null
          relationship_tier?: string | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_relationships_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_relationships_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_rider_capabilities: {
        Row: {
          catalog_item_id: string
          cost_modifier: number | null
          created_at: string | null
          id: string
          is_available: boolean | null
          notes: string | null
          quality_level: number | null
          venue_id: string
        }
        Insert: {
          catalog_item_id: string
          cost_modifier?: number | null
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          notes?: string | null
          quality_level?: number | null
          venue_id: string
        }
        Update: {
          catalog_item_id?: string
          cost_modifier?: number | null
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          notes?: string | null
          quality_level?: number | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_rider_capabilities_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "rider_item_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_rider_capabilities_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_staff: {
        Row: {
          created_at: string
          hired_at: string
          id: string
          name: string
          performance_rating: number | null
          role: string
          salary_weekly: number
          skill_level: number
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          hired_at?: string
          id?: string
          name: string
          performance_rating?: number | null
          role: string
          salary_weekly?: number
          skill_level?: number
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          hired_at?: string
          id?: string
          name?: string
          performance_rating?: number | null
          role?: string
          salary_weekly?: number
          skill_level?: number
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_staff_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_upgrades: {
        Row: {
          cost: number
          description: string | null
          id: string
          installed_at: string
          upgrade_level: number
          upgrade_type: string
          venue_id: string | null
        }
        Insert: {
          cost: number
          description?: string | null
          id?: string
          installed_at?: string
          upgrade_level?: number
          upgrade_type: string
          venue_id?: string | null
        }
        Update: {
          cost?: number
          description?: string | null
          id?: string
          installed_at?: string
          upgrade_level?: number
          upgrade_type?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_upgrades_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          alcohol_license: boolean | null
          amenities: Json | null
          audience_type: string | null
          avg_attendance_rate: number | null
          backstage_quality: number | null
          band_revenue_share: number | null
          base_payment: number | null
          capacity: number | null
          city_id: string | null
          company_id: string | null
          created_at: string | null
          daily_operating_cost: number | null
          description: string | null
          district_id: string | null
          economy_factor: number | null
          equipment_quality: number | null
          genre_bias: Json | null
          has_green_room: boolean | null
          has_recording_capability: boolean | null
          id: string
          image_url: string | null
          is_company_owned: boolean | null
          lighting_rating: number | null
          location: string | null
          min_security_guards: number | null
          monthly_rent: number | null
          name: string
          parking_spaces: number | null
          prestige_level: number | null
          reputation: number | null
          reputation_score: number | null
          requirements: Json | null
          security_license_required: number | null
          security_required: boolean | null
          slot_config: Json | null
          slots_per_day: number | null
          sound_system_rating: number | null
          staff_count: number | null
          total_gigs_hosted: number | null
          total_revenue_lifetime: number | null
          venue_cut: number | null
          venue_type: string | null
        }
        Insert: {
          alcohol_license?: boolean | null
          amenities?: Json | null
          audience_type?: string | null
          avg_attendance_rate?: number | null
          backstage_quality?: number | null
          band_revenue_share?: number | null
          base_payment?: number | null
          capacity?: number | null
          city_id?: string | null
          company_id?: string | null
          created_at?: string | null
          daily_operating_cost?: number | null
          description?: string | null
          district_id?: string | null
          economy_factor?: number | null
          equipment_quality?: number | null
          genre_bias?: Json | null
          has_green_room?: boolean | null
          has_recording_capability?: boolean | null
          id?: string
          image_url?: string | null
          is_company_owned?: boolean | null
          lighting_rating?: number | null
          location?: string | null
          min_security_guards?: number | null
          monthly_rent?: number | null
          name: string
          parking_spaces?: number | null
          prestige_level?: number | null
          reputation?: number | null
          reputation_score?: number | null
          requirements?: Json | null
          security_license_required?: number | null
          security_required?: boolean | null
          slot_config?: Json | null
          slots_per_day?: number | null
          sound_system_rating?: number | null
          staff_count?: number | null
          total_gigs_hosted?: number | null
          total_revenue_lifetime?: number | null
          venue_cut?: number | null
          venue_type?: string | null
        }
        Update: {
          alcohol_license?: boolean | null
          amenities?: Json | null
          audience_type?: string | null
          avg_attendance_rate?: number | null
          backstage_quality?: number | null
          band_revenue_share?: number | null
          base_payment?: number | null
          capacity?: number | null
          city_id?: string | null
          company_id?: string | null
          created_at?: string | null
          daily_operating_cost?: number | null
          description?: string | null
          district_id?: string | null
          economy_factor?: number | null
          equipment_quality?: number | null
          genre_bias?: Json | null
          has_green_room?: boolean | null
          has_recording_capability?: boolean | null
          id?: string
          image_url?: string | null
          is_company_owned?: boolean | null
          lighting_rating?: number | null
          location?: string | null
          min_security_guards?: number | null
          monthly_rent?: number | null
          name?: string
          parking_spaces?: number | null
          prestige_level?: number | null
          reputation?: number | null
          reputation_score?: number | null
          requirements?: Json | null
          security_license_required?: number | null
          security_required?: boolean | null
          slot_config?: Json | null
          slots_per_day?: number | null
          sound_system_rating?: number | null
          staff_count?: number | null
          total_gigs_hosted?: number | null
          total_revenue_lifetime?: number | null
          venue_cut?: number | null
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
            foreignKeyName: "venues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      vip_subscriptions: {
        Row: {
          created_at: string | null
          expires_at: string
          gift_message: string | null
          gifted_by_admin_id: string | null
          id: string
          starts_at: string
          status: string
          stripe_subscription_id: string | null
          subscription_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          gift_message?: string | null
          gifted_by_admin_id?: string | null
          id?: string
          starts_at?: string
          status?: string
          stripe_subscription_id?: string | null
          subscription_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          gift_message?: string | null
          gifted_by_admin_id?: string | null
          id?: string
          starts_at?: string
          status?: string
          stripe_subscription_id?: string | null
          subscription_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      website_submissions: {
        Row: {
          band_id: string
          compensation_earned: number | null
          created_at: string | null
          fame_gained: number | null
          fans_gained: number | null
          id: string
          pitch_message: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          song_id: string | null
          status: string | null
          submitted_at: string | null
          website_id: string
        }
        Insert: {
          band_id: string
          compensation_earned?: number | null
          created_at?: string | null
          fame_gained?: number | null
          fans_gained?: number | null
          id?: string
          pitch_message?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          song_id?: string | null
          status?: string | null
          submitted_at?: string | null
          website_id: string
        }
        Update: {
          band_id?: string
          compensation_earned?: number | null
          created_at?: string | null
          fame_gained?: number | null
          fans_gained?: number | null
          id?: string
          pitch_message?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          song_id?: string | null
          status?: string | null
          submitted_at?: string | null
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_submissions_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_submissions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "band_gift_notifications"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "website_submissions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "chart_singles"
            referencedColumns: ["song_id"]
          },
          {
            foreignKeyName: "website_submissions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "released_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_submissions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_submissions_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          compensation_max: number | null
          compensation_min: number | null
          country: string | null
          created_at: string | null
          description: string | null
          fame_boost_max: number | null
          fame_boost_min: number | null
          fan_boost_max: number | null
          fan_boost_min: number | null
          genres: string[] | null
          id: string
          is_active: boolean | null
          min_fame_required: number | null
          name: string
          traffic_rank: number | null
          website_url: string | null
        }
        Insert: {
          compensation_max?: number | null
          compensation_min?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          genres?: string[] | null
          id?: string
          is_active?: boolean | null
          min_fame_required?: number | null
          name: string
          traffic_rank?: number | null
          website_url?: string | null
        }
        Update: {
          compensation_max?: number | null
          compensation_min?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          genres?: string[] | null
          id?: string
          is_active?: boolean | null
          min_fame_required?: number | null
          name?: string
          traffic_rank?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      youtube_channels: {
        Row: {
          avg_views: number | null
          channel_name: string
          channel_type: string | null
          channel_url: string | null
          compensation_max: number | null
          compensation_min: number | null
          created_at: string | null
          description: string | null
          fame_boost_max: number | null
          fame_boost_min: number | null
          fan_boost_max: number | null
          fan_boost_min: number | null
          genres: string[] | null
          host_name: string | null
          id: string
          is_active: boolean | null
          min_fame_required: number | null
          quality_level: number | null
          slots_per_week: number | null
          subscriber_count: number | null
        }
        Insert: {
          avg_views?: number | null
          channel_name: string
          channel_type?: string | null
          channel_url?: string | null
          compensation_max?: number | null
          compensation_min?: number | null
          created_at?: string | null
          description?: string | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          genres?: string[] | null
          host_name?: string | null
          id?: string
          is_active?: boolean | null
          min_fame_required?: number | null
          quality_level?: number | null
          slots_per_week?: number | null
          subscriber_count?: number | null
        }
        Update: {
          avg_views?: number | null
          channel_name?: string
          channel_type?: string | null
          channel_url?: string | null
          compensation_max?: number | null
          compensation_min?: number | null
          created_at?: string | null
          description?: string | null
          fame_boost_max?: number | null
          fame_boost_min?: number | null
          fan_boost_max?: number | null
          fan_boost_min?: number | null
          genres?: string[] | null
          host_name?: string | null
          id?: string
          is_active?: boolean | null
          min_fame_required?: number | null
          quality_level?: number | null
          slots_per_week?: number | null
          subscriber_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_cron_job_runs: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_count: number | null
          error_message: string | null
          id: string | null
          job_name: string | null
          processed_count: number | null
          result_summary: Json | null
          started_at: string | null
          status: string | null
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_count?: number | null
          error_message?: string | null
          id?: string | null
          job_name?: string | null
          processed_count?: number | null
          result_summary?: Json | null
          started_at?: string | null
          status?: string | null
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_count?: number | null
          error_message?: string | null
          id?: string | null
          job_name?: string | null
          processed_count?: number | null
          result_summary?: Json | null
          started_at?: string | null
          status?: string | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      admin_cron_job_summary: {
        Row: {
          allow_manual_trigger: boolean | null
          avg_duration_ms: number | null
          description: string | null
          display_name: string | null
          edge_function_name: string | null
          error_count: number | null
          job_name: string | null
          last_manual_trigger_at: string | null
          last_run_at: string | null
          last_run_duration_ms: number | null
          last_run_started_at: string | null
          last_run_status: string | null
          schedule: string | null
          success_runs: number | null
          total_runs: number | null
        }
        Relationships: []
      }
      admin_game_stats: {
        Row: {
          active_today: number | null
          active_week: number | null
          activities_today: number | null
          completed_gigs: number | null
          total_bands: number | null
          total_economy: number | null
          total_players: number | null
          total_releases: number | null
          total_songs: number | null
        }
        Relationships: []
      }
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
      chart_albums: {
        Row: {
          band_name: string | null
          cassette_sales: number | null
          cd_sales: number | null
          country: string | null
          created_at: string | null
          digital_sales: number | null
          format_type: string | null
          release_id: string | null
          release_status: string | null
          title: string | null
          total_revenue: number | null
          total_units_sold: number | null
          vinyl_sales: number | null
        }
        Relationships: []
      }
      chart_singles: {
        Row: {
          band_name: string | null
          country: string | null
          genre: string | null
          platform_count: number | null
          platform_name: string | null
          song_id: string | null
          streaming_revenue: number | null
          title: string | null
          total_streams: number | null
        }
        Relationships: []
      }
      public_player_cards: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          fame: number | null
          id: string | null
          level: number | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          fame?: number | null
          id?: string | null
          level?: number | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          fame?: number | null
          id?: string | null
          level?: number | null
          username?: string | null
        }
        Relationships: []
      }
      released_songs: {
        Row: {
          band_id: string | null
          created_at: string | null
          genre: string | null
          id: string | null
          quality_score: number | null
          song_rating: number | null
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          band_id?: string | null
          created_at?: string | null
          genre?: string | null
          id?: string | null
          quality_score?: number | null
          song_rating?: number | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          band_id?: string | null
          created_at?: string | null
          genre?: string | null
          id?: string | null
          quality_score?: number | null
          song_rating?: number | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_band_country_fame: {
        Args: {
          p_band_id: string
          p_country: string
          p_fame_amount?: number
          p_fans_amount?: number
        }
        Returns: undefined
      }
      admin_force_complete_release: {
        Args: { p_release_id: string }
        Returns: undefined
      }
      admin_get_cron_job_runs: {
        Args: { _limit?: number }
        Returns: {
          completed_at: string | null
          duration_ms: number | null
          error_count: number | null
          error_message: string | null
          id: string | null
          job_name: string | null
          processed_count: number | null
          result_summary: Json | null
          started_at: string | null
          status: string | null
          triggered_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_cron_job_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_get_cron_job_summary: {
        Args: never
        Returns: {
          allow_manual_trigger: boolean | null
          avg_duration_ms: number | null
          description: string | null
          display_name: string | null
          edge_function_name: string | null
          error_count: number | null
          job_name: string | null
          last_manual_trigger_at: string | null
          last_run_at: string | null
          last_run_duration_ms: number | null
          last_run_started_at: string | null
          last_run_status: string | null
          schedule: string | null
          success_runs: number | null
          total_runs: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_cron_job_summary"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      advance_gig_song: { Args: { p_gig_id: string }; Returns: undefined }
      apply_missed_gig_consequences: {
        Args: { p_gig_id: string; p_reason?: string }
        Returns: Json
      }
      auto_complete_manufacturing: { Args: never; Returns: number }
      auto_complete_songwriting_sessions: {
        Args: never
        Returns: {
          completed_sessions: number
          converted_projects: number
        }[]
      }
      auto_complete_travel: { Args: never; Returns: undefined }
      auto_start_scheduled_gigs: { Args: never; Returns: undefined }
      auto_verify_accounts: { Args: never; Returns: undefined }
      calculate_bail_amount: {
        Args: { p_imprisonment_id: string }
        Returns: number
      }
      calculate_chart_trends: { Args: never; Returns: undefined }
      calculate_early_release_days: {
        Args: { p_behavior_score: number; p_original_sentence: number }
        Returns: number
      }
      calculate_follower_quality: {
        Args: { p_follower_account_id: string }
        Returns: number
      }
      calculate_predicted_tickets: {
        Args: {
          p_band_id: string
          p_scheduled_date: string
          p_venue_capacity: number
        }
        Returns: number
      }
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
      calculate_twaat_xp: {
        Args: { p_account_id: string; p_posts_today: number }
        Returns: number
      }
      calculate_twaater_organic_followers: { Args: never; Returns: undefined }
      check_greatest_hits_eligibility: {
        Args: { p_band_id: string; p_user_id: string }
        Returns: Json
      }
      check_player_in_gig_city: {
        Args: { p_gig_id: string; p_user_id: string }
        Returns: Json
      }
      check_scheduling_conflict: {
        Args: {
          p_end: string
          p_exclude_id?: string
          p_start: string
          p_user_id: string
        }
        Returns: boolean
      }
      check_song_generation_limit: {
        Args: { p_user_id: string }
        Returns: Json
      }
      cleanup_timed_out_generations: { Args: never; Returns: number }
      create_default_habits_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      decay_unreleased_song_hype: { Args: never; Returns: undefined }
      decrement_gettit_comment_vote: {
        Args: { comment_id: string; vote_field: string }
        Returns: undefined
      }
      decrement_gettit_vote: {
        Args: { post_id: string; vote_field: string }
        Returns: undefined
      }
      expire_old_gig_offers: { Args: never; Returns: undefined }
      fix_null_manufacturing_dates: { Args: never; Returns: number }
      get_band_country_fame: {
        Args: { p_band_id: string; p_country: string }
        Returns: number
      }
      get_profile_id_for_user: { Args: { user_uuid: string }; Returns: string }
      get_recent_twaat_count: { Args: never; Returns: number }
      get_setlist_total_duration: {
        Args: { p_setlist_id: string }
        Returns: number
      }
      get_song_vote_score: { Args: { p_song_id: string }; Returns: number }
      get_songs_on_albums: {
        Args: { p_band_id: string; p_user_id: string }
        Returns: {
          album_title: string
          release_id: string
          song_id: string
        }[]
      }
      get_top_played_songs: {
        Args: { p_limit?: number }
        Returns: {
          audio_url: string
          band_id: string
          band_name: string
          genre: string
          quality_score: number
          song_id: string
          title: string
          unique_plays: number
        }[]
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
      hire_player: {
        Args: { p_job_id: string; p_profile_id: string }
        Returns: string
      }
      increment_dikcok_video_views: {
        Args: { p_video_id: string }
        Returns: undefined
      }
      increment_gettit_comment_vote: {
        Args: { comment_id: string; vote_field: string }
        Returns: undefined
      }
      increment_gettit_vote: {
        Args: { post_id: string; vote_field: string }
        Returns: undefined
      }
      increment_release_revenue: {
        Args: { amount: number; release_id: string }
        Returns: undefined
      }
      is_user_imprisoned: { Args: { p_user_id: string }; Returns: boolean }
      is_user_traveling: { Args: { p_user_id: string }; Returns: boolean }
      process_radio_submission: {
        Args: { p_submission_id: string }
        Returns: Json
      }
      quit_job: { Args: { p_employment_id: string }; Returns: undefined }
      reorder_setlist_items: {
        Args: { p_setlist_id: string; p_updates: Json }
        Returns: undefined
      }
      reset_twaater_daily_limits: { Args: never; Returns: undefined }
      simulate_ticket_sales: { Args: never; Returns: undefined }
      swap_gettit_comment_vote: {
        Args: { comment_id: string; new_field: string; old_field: string }
        Returns: undefined
      }
      swap_gettit_vote: {
        Args: { new_field: string; old_field: string; post_id: string }
        Returns: undefined
      }
      sync_job_employee_counts: { Args: never; Returns: undefined }
      sync_twaater_fame_scores: { Args: never; Returns: undefined }
      update_song_fame: {
        Args: { p_fame_amount: number; p_song_id: string; p_source: string }
        Returns: undefined
      }
      update_song_hype: {
        Args: { p_hype_change: number; p_song_id: string }
        Returns: undefined
      }
      update_song_hype_for_pr: {
        Args: { p_hype_boost: number; p_song_id: string }
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
      twaater_owner_type: "persona" | "band" | "bot"
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
      twaater_owner_type: ["persona", "band", "bot"],
      twaater_visibility: ["public", "followers"],
    },
  },
} as const
