import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface CurrentMayorOffice {
  mayorId: string;
  cityId: string;
  cityName: string;
  country: string | null;
  approvalRating: number;
  termStart: string;
  termEnd: string | null;
}

export function useCurrentMayorOffice() {
  const { profileId } = useActiveProfile();

  return useQuery<CurrentMayorOffice | null>({
    queryKey: ["current-mayor-office", profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const { data: mayor, error: mayorError } = await supabase
        .from("city_mayors")
        .select("id, city_id, approval_rating, term_start, term_end")
        .eq("profile_id", profileId)
        .eq("is_current", true)
        .order("term_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mayorError) throw mayorError;
      if (!mayor) return null;

      const { data: city, error: cityError } = await supabase
        .from("cities")
        .select("id, name, country")
        .eq("id", mayor.city_id)
        .maybeSingle();

      if (cityError) throw cityError;
      if (!city) return null;

      return {
        mayorId: mayor.id,
        cityId: mayor.city_id,
        cityName: city.name,
        country: city.country ?? null,
        approvalRating: Number(mayor.approval_rating ?? 50),
        termStart: mayor.term_start,
        termEnd: mayor.term_end ?? null,
      };
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });
}
