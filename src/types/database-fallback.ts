// Comprehensive fallback types when supabase types file is corrupted
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          display_name: string;
          avatar_url?: string;
          bio?: string;
          age: number;
          level?: number;
          experience?: number;
          cash?: number;
          fame?: number;
          fans?: number;
          experience_at_last_weekly_bonus?: number;
          last_weekly_bonus_at?: string;
          weekly_bonus_streak?: number;
          weekly_bonus_metadata?: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          username: string;
          display_name: string;
          avatar_url?: string;
          bio?: string;
          age?: number;
          level?: number;
          experience?: number;
          cash?: number;
          fame?: number;
          fans?: number;
          experience_at_last_weekly_bonus?: number;
          last_weekly_bonus_at?: string;
          weekly_bonus_streak?: number;
          weekly_bonus_metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          username?: string;
          display_name?: string;
          avatar_url?: string;
          bio?: string;
          age?: number;
          level?: number;
          experience?: number;
          cash?: number;
          fame?: number;
          fans?: number;
          experience_at_last_weekly_bonus?: number;
          last_weekly_bonus_at?: string;
          weekly_bonus_streak?: number;
          weekly_bonus_metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      profile_activity_statuses: {
        Row: {
          id: string;
          profile_id: string;
          status: string;
          started_at: string;
          duration_minutes?: number | null;
          ends_at?: string | null;
          song_id?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          status: string;
          started_at?: string;
          duration_minutes?: number | null;
          song_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          status?: string;
          started_at?: string;
          duration_minutes?: number | null;
          song_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      cities: {
        Row: {
          id: string;
          name: string;
          country: string;
          population?: number;
          music_scene?: number;
          cost_of_living?: number;
          dominant_genre?: string;
          venues?: number;
          local_bonus?: number;
          cultural_events?: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          country: string;
          population?: number;
          music_scene?: number;
          cost_of_living?: number;
          dominant_genre?: string;
          venues?: number;
          local_bonus?: number;
          cultural_events?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          country?: string;
          population?: number;
          music_scene?: number;
          cost_of_living?: number;
          dominant_genre?: string;
          venues?: number;
          local_bonus?: number;
          cultural_events?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      player_skills: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      player_attributes: {
        Row: {
          id: string;
          user_id: string;
          profile_id?: string;
          attribute_points?: number;
          attribute_points_spent?: number;
          business_acumen?: number;
          charisma?: number;
          creative_insight?: number;
          crowd_engagement?: number;
          looks?: number;
          marketing_savvy?: number;
          mental_focus?: number;
          musical_ability?: number;
          musicality?: number;
          physical_endurance?: number;
          rhythm_sense?: number;
          social_reach?: number;
          stage_presence?: number;
          technical_mastery?: number;
          vocal_talent?: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id?: string;
          attribute_points?: number;
          attribute_points_spent?: number;
          business_acumen?: number;
          charisma?: number;
          creative_insight?: number;
          crowd_engagement?: number;
          looks?: number;
          marketing_savvy?: number;
          mental_focus?: number;
          musical_ability?: number;
          musicality?: number;
          physical_endurance?: number;
          rhythm_sense?: number;
          social_reach?: number;
          stage_presence?: number;
          technical_mastery?: number;
          vocal_talent?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string;
          attribute_points?: number;
          attribute_points_spent?: number;
          business_acumen?: number;
          charisma?: number;
          creative_insight?: number;
          crowd_engagement?: number;
          looks?: number;
          marketing_savvy?: number;
          mental_focus?: number;
          musical_ability?: number;
          musicality?: number;
          physical_endurance?: number;
          rhythm_sense?: number;
          social_reach?: number;
          stage_presence?: number;
          technical_mastery?: number;
          vocal_talent?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      player_xp_wallet: {
        Row: {
          profile_id: string;
          xp_balance: number;
          xp_spent: number;
          lifetime_xp: number;
          skill_points_earned: number;
          attribute_points_earned: number;
          last_recalculated: string;
        };
        Insert: {
          profile_id: string;
          xp_balance?: number;
          xp_spent?: number;
          lifetime_xp?: number;
          skill_points_earned?: number;
          attribute_points_earned?: number;
          last_recalculated?: string;
        };
        Update: {
          profile_id?: string;
          xp_balance?: number;
          xp_spent?: number;
          lifetime_xp?: number;
          skill_points_earned?: number;
          attribute_points_earned?: number;
          last_recalculated?: string;
        };
      };
      education_youtube_resources: {
        Row: {
          id: string;
          title: string;
          url: string;
          skill?: string;
          difficulty?: string;
          resource_name?: string;
          resource_format?: string;
          resource_focus?: string;
          resource_url?: string;
          resource_summary?: string;
          resource_sort_order?: number;
          collection_key?: string;
          collection_title?: string;
          collection_description?: string;
          collection_sort_order?: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          url: string;
          skill?: string;
          difficulty?: string;
          resource_name?: string;
          resource_format?: string;
          resource_focus?: string;
          resource_url?: string;
          resource_summary?: string;
          resource_sort_order?: number;
          collection_key?: string;
          collection_title?: string;
          collection_description?: string;
          collection_sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          url?: string;
          skill?: string;
          difficulty?: string;
          resource_name?: string;
          resource_format?: string;
          resource_focus?: string;
          resource_url?: string;
          resource_summary?: string;
          resource_sort_order?: number;
          collection_key?: string;
          collection_title?: string;
          collection_description?: string;
          collection_sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      education_youtube_lessons: {
        Row: {
          id: string;
          title: string;
          skill?: string;
          difficulty?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          skill?: string;
          difficulty?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          skill?: string;
          difficulty?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      profile_daily_xp_grants: {
        Row: {
          id: string;
          profile_id: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          amount?: number;
          created_at?: string;
        };
      };
      skill_definitions: {
        Row: {
          id: string;
          slug: string;
          display_name: string;
          description?: string;
          tier_caps?: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          display_name: string;
          description?: string;
          tier_caps?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          display_name?: string;
          description?: string;
          tier_caps?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      skill_progress: {
        Row: {
          id: string;
          profile_id: string;
          skill_slug: string;
          current_level: number;
          current_xp: number;
          required_xp: number;
          last_practiced_at?: string;
          metadata?: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          skill_slug: string;
          current_level?: number;
          current_xp?: number;
          required_xp?: number;
          last_practiced_at?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          skill_slug?: string;
          current_level?: number;
          current_xp?: number;
          required_xp?: number;
          last_practiced_at?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      achievements: {
        Row: {
          id: string;
          name: string;
          description: string;
          icon: string;
          rarity: string;
          category: string;
          requirements: Json;
          rewards: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          icon: string;
          rarity: string;
          category: string;
          requirements: Json;
          rewards: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          icon?: string;
          rarity?: string;
          category?: string;
          requirements?: Json;
          rewards?: Json;
          created_at?: string;
        };
      };
      activity_feed: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          activity_type: string;
          message: string;
          metadata?: Json;
          earnings?: number;
          created_at: string;
          status?: string | null;
          duration_minutes?: number | null;
          status_id?: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          activity_type: string;
          message: string;
          metadata?: Json;
          earnings?: number;
          created_at?: string;
          status?: string | null;
          duration_minutes?: number | null;
          status_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string;
          activity_type?: string;
          message?: string;
          metadata?: Json;
          earnings?: number;
          created_at?: string;
          status?: string | null;
          duration_minutes?: number | null;
          status_id?: string | null;
        };
      };
      band_members: {
        Row: {
          id: string;
          band_id: string;
          profile_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          band_id: string;
          profile_id: string;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          band_id?: string;
          profile_id?: string;
          role?: string;
          created_at?: string;
        };
      };
      bands: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      chart_entries: {
        Row: {
          id: string;
          song_id: string;
          chart_position: number;
          week: string;
          genre: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          song_id: string;
          chart_position: number;
          week: string;
          genre: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          song_id?: string;
          chart_position?: number;
          week?: string;
          genre?: string;
          created_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          message?: string;
          created_at?: string;
        };
      };
      equipment_items: {
        Row: {
          id: string;
          name: string;
          type: string;
          rarity: string;
          effects: Json;
          price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          rarity: string;
          effects: Json;
          price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          rarity?: string;
          effects?: Json;
          price?: number;
          created_at?: string;
        };
      };
      game_events: {
        Row: {
          id: string;
          title: string;
          description: string;
          start_date: string;
          end_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          start_date: string;
          end_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          start_date?: string;
          end_date?: string;
          created_at?: string;
        };
      };
      gigs: {
        Row: {
          id: string;
          venue_id: string;
          performer_id: string;
          date: string;
          payment: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          performer_id: string;
          date: string;
          payment: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          performer_id?: string;
          date?: string;
          payment?: number;
          created_at?: string;
        };
      };
      inventory: {
        Row: {
          id: string;
          user_id: string;
          item_id: string;
          quantity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_id: string;
          quantity: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_id?: string;
          quantity?: number;
          created_at?: string;
        };
      };
      songs: {
        Row: {
          id: string;
          title: string;
          artist_id: string;
          genre: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          artist_id: string;
          genre: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          artist_id?: string;
          genre?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      streaming_platforms: {
        Row: {
          id: string;
          name: string;
          base_rate: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          base_rate: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          base_rate?: number;
          created_at?: string;
        };
      };
      tours: {
        Row: {
          id: string;
          name: string;
          artist_id: string;
          start_date: string;
          end_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          artist_id: string;
          start_date: string;
          end_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          artist_id?: string;
          start_date?: string;
          end_date?: string;
          created_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
      };
      venues: {
        Row: {
          id: string;
          name: string;
          location: string;
          capacity: number;
          venue_type: string;
          prestige_level: number;
          base_payment: number;
          requirements: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location: string;
          capacity: number;
          venue_type: string;
          prestige_level: number;
          base_payment: number;
          requirements: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string;
          capacity?: number;
          venue_type?: string;
          prestige_level?: number;
          base_payment?: number;
          requirements?: Json;
          created_at?: string;
        };
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, any>;
      };
    };
    Functions: {
      [key: string]: {
        Args: Record<string, any>;
        Returns: any;
      };
    };
    Enums: {
      [key: string]: string;
    };
    CompositeTypes: {
      [key: string]: Record<string, any>;
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];