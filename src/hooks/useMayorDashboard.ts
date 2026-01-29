import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CityMayor, CityLaws } from "@/types/city-governance";
import { useAuth } from "@/hooks/use-auth-context";
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
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-mayor", cityId, user?.id],
    queryFn: async () => {
      if (!cityId || !user?.id) return false;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return false;

      const { data, error } = await supabase
        .from("city_mayors")
        .select("id")
        .eq("city_id", cityId)
        .eq("profile_id", profile.id)
        .eq("is_current", true)
        .maybeSingle();

      if (error) return false;
      return !!data;
    },
    enabled: !!cityId && !!user?.id,
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
  const { user } = useAuth();

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
      if (!user?.id) throw new Error("Must be logged in");

      // Get user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Verify user is mayor
      const { data: mayor, error: mayorError } = await supabase
        .from("city_mayors")
        .select("id, policies_enacted")
        .eq("city_id", cityId)
        .eq("profile_id", profile.id)
        .eq("is_current", true)
        .single();

      if (mayorError || !mayor) {
        throw new Error("You must be the current mayor to update laws");
      }

      // Get current laws for history tracking
      const { data: currentLaws } = await supabase
        .from("city_laws")
        .select("*")
        .eq("city_id", cityId)
        .is("effective_until", null)
        .single();

      // Prepare update object (exclude id and city_id)
      const { id, city_id, created_at, effective_from, effective_until, enacted_by_mayor_id, ...cleanUpdates } = updates as any;
      
      // Update laws
      const { data, error } = await supabase
        .from("city_laws")
        .update({
          ...cleanUpdates,
          enacted_by_mayor_id: mayor.id,
        })
        .eq("city_id", cityId)
        .is("effective_until", null)
        .select()
        .single();

      if (error) throw error;

      // Record law changes in history
      if (currentLaws) {
        const historyEntries = Object.entries(cleanUpdates)
          .filter(([key, value]) => {
            const oldValue = (currentLaws as any)[key];
            return JSON.stringify(oldValue) !== JSON.stringify(value);
          })
          .map(([key, value]) => ({
            city_id: cityId,
            mayor_id: mayor.id,
            law_field: key,
            old_value: String((currentLaws as any)[key]),
            new_value: String(value),
            change_reason: changeReason || null,
            game_year: gameYear || null,
          }));

        if (historyEntries.length > 0) {
          await supabase.from("city_law_history").insert(historyEntries);
        }
      }

      // Increment policies enacted count
      await supabase
        .from("city_mayors")
        .update({ policies_enacted: (mayor.policies_enacted || 0) + 1 })
        .eq("id", mayor.id);

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
