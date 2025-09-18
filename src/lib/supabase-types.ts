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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}