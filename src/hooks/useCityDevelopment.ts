import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CityDevelopment, CityGameplayModifiers } from "@/types/city-development";

export function useCityDevelopment(cityId: string | undefined) {
  return useQuery<CityDevelopment | null>({
    queryKey: ["city-development", cityId],
    queryFn: async () => {
      if (!cityId) return null;
      const { data, error } = await (supabase as any)
        .from("city_development")
        .select("*")
        .eq("city_id", cityId)
        .maybeSingle();
      if (error) throw error;
      return data as CityDevelopment | null;
    },
    enabled: !!cityId,
  });
}

export function useCityGameplayModifiers(cityId: string | undefined) {
  return useQuery<CityGameplayModifiers | null>({
    queryKey: ["city-gameplay-modifiers", cityId],
    queryFn: async () => {
      if (!cityId) return null;
      const { data, error } = await (supabase as any).rpc("city_gameplay_modifiers", {
        p_city_id: cityId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as CityGameplayModifiers | null;
    },
    enabled: !!cityId,
  });
}
