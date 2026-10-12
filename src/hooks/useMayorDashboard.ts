import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CityMayor, CityLaws } from "@/types/city-governance";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

// Fetch current mayor for a city
export function useCityMayor(cityId: string | undefined) {
  return useQuery({
    queryKey: ["city-mayor", cityId],
    queryFn: async () => {
      if (!cityId) return null;

      const { data, error } = await supabase
        .from("city_mayors")
        .select("*")
        .eq("city_id", cityId)
        .eq("is_current", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      // Fetch profile separately
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", data.profile_id)
        .single();
      
      return {
        ...data,
        profile: profile ? {
          id: profile.id,
          stage_name: profile.display_name,
          avatar_url: profile.avatar_url,
        } : undefined
      } as unknown as CityMayor;
    },
    enabled: !!cityId,
  });
}

// Check if current user is mayor of a city
export function useIsCurrentMayor(cityId: string | undefined) {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["is-mayor", cityId, profileId],
    queryFn: async () => {
      if (!cityId || !profileId) return false;

      const { data, error } = await supabase
        .from("city_mayors")
        .select("id")
        .eq("city_id", cityId)
        .eq("profile_id", profileId)
        .eq("is_current", true)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!cityId && !!profileId,
  });
}

// Fetch mayor history for a city
export function useMayorHistory(cityId: string | undefined) {
  return useQuery({
    queryKey: ["mayor-history", cityId],
    queryFn: async () => {
      if (!cityId) return [];

      const { data, error } = await supabase
        .from("city_mayors")
        .select("*")
        .eq("city_id", cityId)
        .order("term_start", { ascending: false })
        .limit(10);

      if (error) throw error;
      
      // Fetch profiles separately
      const mayorsWithProfiles = await Promise.all(
        (data || []).map(async (mayor) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .eq("id", mayor.profile_id)
            .single();
          
          return {
            ...mayor,
            profile: profile ? {
              id: profile.id,
              stage_name: profile.display_name,
              avatar_url: profile.avatar_url,
            } : undefined
          };
        })
      );
      
      return mayorsWithProfiles as unknown as CityMayor[];
    },
    enabled: !!cityId,
  });
}

// Update city laws (mayor only)
export function useUpdateCityLaws() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async ({
      cityId,
      updates,
      changeReason,
      gameYear,
    }: {
      cityId: string;
      updates: Partial<CityLaws>;
      changeReason?: string;
      gameYear?: number;
    }) => {
      if (!profileId) throw new Error("Must be logged in");

      const allowedFields = [
        "income_tax_rate","sales_tax_rate","travel_tax","alcohol_legal_age",
        "drug_policy","noise_curfew_hour","busking_license_fee","venue_permit_cost",
        "prohibited_genres","promoted_genres","festival_permit_required",
        "max_concert_capacity","community_events_funding",
      ];
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => allowedFields.includes(key)),
      );
      const { data, error } = await (supabase as any).rpc("update_city_laws_atomic", {
        p_profile_id: profileId, p_city_id: cityId, p_updates: cleanUpdates,
        p_change_reason: changeReason ?? null, p_game_year: gameYear ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { cityId }) => {
      queryClient.invalidateQueries({ queryKey: ["city-laws", cityId] });
      queryClient.invalidateQueries({ queryKey: ["city-law-history", cityId] });
      queryClient.invalidateQueries({ queryKey: ["city-mayor", cityId] });
      toast.success("Laws updated successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
