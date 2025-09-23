// Minimal emergency types to bypass corrupted Supabase types without relying on `any`
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Placeholder supabase client used when the generated types are unavailable
export const supabase = null;

export interface Database {
  public: {
    Tables: Record<string, unknown>;
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, unknown>;
  };
}

type PublicSchema = Database["public"];

export type Tables<T extends string> = T extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][T]
  : unknown;
export type TablesInsert<T extends string> = T extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][T]
  : unknown;
export type TablesUpdate<T extends string> = T extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][T]
  : unknown;
