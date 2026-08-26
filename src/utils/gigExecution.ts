import { supabase } from "@/integrations/supabase/client";

interface GigExecutionData {
  gigId: string;
  bandId: string;
  setlistId: string;
  venueCapacity: number;
  ticketPrice: number;
}

/**
 * Resolve a gig through the authoritative server completion path.
 *
 * The additional fields are retained in the public input shape because existing
 * callers already provide them, but the server owns scoring, finance, rewards,
 * equipment wear, crew effects and the final completed status.
 */
export async function executeGigPerformance(data: GigExecutionData) {
  const { data: authoritativeResult, error: completionError } = await supabase.functions.invoke(
    "complete-gig",
    {
      body: { gigId: data.gigId },
    },
  );

  if (completionError) throw completionError;
  return authoritativeResult;
}
