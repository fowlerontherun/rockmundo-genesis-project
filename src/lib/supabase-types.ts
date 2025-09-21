// Temporary workaround for corrupted supabase types file
// Re-export from client instead of types file
export type { Database } from "@/integrations/supabase/client";

// Define Json type manually since it's not available from client
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
