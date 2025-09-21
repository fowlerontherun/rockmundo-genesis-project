// Minimal emergency types to bypass corrupted Supabase types
export type Json = any;

// Use any for everything until types are regenerated
export const supabase: any = null;

export interface Database {
  public: {
    Tables: any;
    Views: any;
    Functions: any;
    Enums: any;
    CompositeTypes: any;
  };
}

export type Tables<T extends string> = any;
export type TablesInsert<T extends string> = any;
export type TablesUpdate<T extends string> = any;