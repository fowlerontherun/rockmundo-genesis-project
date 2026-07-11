import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BAND_CONTRIBUTION_LIMIT, type BandContributionEvent } from "@/lib/bandContributions";

export function useBandContributions(bandId: string, limit = BAND_CONTRIBUTION_LIMIT) {
  return useQuery({
    queryKey: ["band-contributions", bandId, limit],
    enabled: Boolean(bandId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("band_contribution_events")
        .select(
          "id, band_id, profile_id, contribution_type, source_entity_type, source_entity_id, occurred_at, metadata, created_at, voided_at, voided_by_correction_request_id, profiles:profiles!band_contribution_events_profile_id_fkey(id, username, display_name, avatar_url)",
        )
        .eq("band_id", bandId)
        .is("voided_at", null)
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as BandContributionEvent[];
    },
  });
}
