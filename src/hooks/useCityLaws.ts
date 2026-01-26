import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CityLaws, CityLawHistory, DrugPolicyStatus } from "@/types/city-governance";

// Fetch current active laws for a city
export function useCityLaws(cityId: string | undefined) {
  return useQuery({
    queryKey: ["city-laws", cityId],
    queryFn: async () => {
      if (!cityId) return null;

      const { data, error } = await supabase
        .from("city_laws")
        .select("*")
        .eq("city_id", cityId)
        .is("effective_until", null)
        .maybeSingle();

      if (error) throw error;
      return data as CityLaws | null;
    },
    enabled: !!cityId,
  });
}

// Fetch law history for a city
export function useCityLawHistory(cityId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["city-law-history", cityId, limit],
    queryFn: async () => {
      if (!cityId) return [];

      const { data, error } = await supabase
        .from("city_law_history")
        .select("*")
        .eq("city_id", cityId)
        .order("changed_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      // Fetch mayor names separately if needed
      const historyWithMayors = await Promise.all(
        (data || []).map(async (item) => {
          if (item.mayor_id) {
            const { data: mayor } = await supabase
              .from("city_mayors")
              .select("profile_id")
              .eq("id", item.mayor_id)
              .single();
            
            if (mayor?.profile_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("stage_name")
                .eq("id", mayor.profile_id)
                .single();
              
              return {
                ...item,
                mayor: {
                  profile: profile
                }
              };
            }
          }
          return item;
        })
      );
      
      return historyWithMayors as CityLawHistory[];
    },
    enabled: !!cityId,
  });
}

// Create default laws for a city (system use)
export function useCreateDefaultCityLaws() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cityId: string) => {
      // Check if laws already exist
      const { data: existing } = await supabase
        .from("city_laws")
        .select("id")
        .eq("city_id", cityId)
        .is("effective_until", null)
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from("city_laws")
        .insert({
          city_id: cityId,
          income_tax_rate: 10.0,
          sales_tax_rate: 8.0,
          travel_tax: 50.0,
          alcohol_legal_age: 21,
          drug_policy: "prohibited" as DrugPolicyStatus,
          noise_curfew_hour: 23,
          busking_license_fee: 0,
          venue_permit_cost: 500,
          prohibited_genres: [],
          promoted_genres: [],
          festival_permit_required: true,
          community_events_funding: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, cityId) => {
      queryClient.invalidateQueries({ queryKey: ["city-laws", cityId] });
    },
  });
}

// Calculate tax on an amount based on city laws
export function calculateIncomeTax(amount: number, laws: CityLaws | null): number {
  if (!laws) return 0;
  return Math.round(amount * (laws.income_tax_rate / 100) * 100) / 100;
}

export function calculateSalesTax(amount: number, laws: CityLaws | null): number {
  if (!laws) return 0;
  return Math.round(amount * (laws.sales_tax_rate / 100) * 100) / 100;
}

// Check if a genre is prohibited in the city
export function isGenreProhibited(genre: string, laws: CityLaws | null): boolean {
  if (!laws) return false;
  return laws.prohibited_genres.some(
    (g) => g.toLowerCase() === genre.toLowerCase()
  );
}

// Check if a genre is promoted in the city
export function isGenrePromoted(genre: string, laws: CityLaws | null): boolean {
  if (!laws) return false;
  return laws.promoted_genres.some(
    (g) => g.toLowerCase() === genre.toLowerCase()
  );
}

// Check if gig time is after curfew
export function isAfterCurfew(gigHour: number, laws: CityLaws | null): boolean {
  if (!laws || laws.noise_curfew_hour === null) return false;
  // Handle midnight wrap (e.g., curfew at 23 means gigs at 0, 1, 2 are after curfew)
  const curfew = laws.noise_curfew_hour;
  if (curfew >= 20 && curfew <= 23) {
    return gigHour >= curfew || gigHour < 6;
  }
  // For extended hours (24, 25, 26 = midnight, 1am, 2am)
  return gigHour >= (curfew - 24) && gigHour < 6;
}

// Check if player meets alcohol age requirement
export function meetsAlcoholAge(playerAge: number, laws: CityLaws | null): boolean {
  if (!laws) return true;
  return playerAge >= laws.alcohol_legal_age;
}
