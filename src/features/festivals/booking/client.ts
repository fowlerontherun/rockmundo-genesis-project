import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Generated Supabase types are updated from a live project; this PR adds calls before
// regeneration is available in the local environment, so booking services use a
// structurally typed client without `(supabase as any)` casts.
export const bookingSupabase = supabase as SupabaseClient;
