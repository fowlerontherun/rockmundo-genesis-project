import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/components/ui/use-toast";

export interface MarketPrice {
  id: string;
  country: string;
  price_multiplier: number;
  updated_at: string;
}

export interface HousingType {
  id: string;
  name: string;
  base_price: number;
  description: string | null;
  image_url: string | null;
  prestige_level: number;
  max_occupants: number;
}

export interface PlayerProperty {
  id: string;
  profile_id: string;
  housing_type_id: string;
  country: string;
  purchase_price: number;
  daily_upkeep: number;
  is_rented_out: boolean;
  rental_income_daily: number;
  purchased_at: string;
  housing_types?: HousingType;
}

export interface RentalType {
  id: string;
  name: string;
  base_weekly_cost: number;
  description: string | null;
  prestige_level: number;
}

export interface PlayerRental {
  id: string;
  profile_id: string;
  rental_type_id: string;
  country: string;
  weekly_cost: number;
  status: string;
  started_at: string;
  ended_at: string | null;
  rental_types?: RentalType;
}

export function useHousingTypes() {
  return useQuery({
    queryKey: ["housing-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("housing_types")
        .select("*")
        .order("base_price", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HousingType[];
    },
  });
}

export function useRentalTypes() {
  return useQuery({
    queryKey: ["rental-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_types")
        .select("*")
        .order("base_weekly_cost", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RentalType[];
    },
  });
}

export function usePlayerProperties() {
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ["player-properties", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("player_properties")
        .select("*, housing_types(*)")
        .eq("profile_id", profileId)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlayerProperty[];
    },
    enabled: !!profileId,
  });
}

export function usePlayerRental() {
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ["player-rental", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("player_rentals")
        .select("*, rental_types(*)")
        .eq("profile_id", profileId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data as PlayerRental | null;
    },
    enabled: !!profileId,
  });
}

export function useBuyProperty() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ housingType, country, marketMultiplier = 1 }: { housingType: HousingType; country: string; marketMultiplier?: number }) => {
      if (!profileId) throw new Error("Not authenticated");

      const marketPrice = getMarketPrice(housingType.base_price, marketMultiplier);

      // Get player cash
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      if (profileError) throw profileError;
      if ((profile.cash || 0) < marketPrice) {
        throw new Error("Not enough cash to buy this property");
      }

      // Deduct cash
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) - marketPrice })
        .eq("id", profileId);
      if (cashError) throw cashError;

      // Create property record with upkeep based on market price
      const dailyUpkeep = Math.round(marketPrice * 0.001);
      const { error: insertError } = await supabase
        .from("player_properties")
        .insert({
          user_id: profileId,
          housing_type_id: housingType.id,
          country,
          purchase_price: marketPrice,
          daily_upkeep: dailyUpkeep,
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-properties"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Property Purchased!", description: "You now own this property." });
    },
    onError: (error: Error) => {
      toast({ title: "Purchase Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useStartRental() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      rentalType,
      country,
      weeklyCost,
    }: {
      rentalType: RentalType;
      country: string;
      weeklyCost: number;
    }) => {
      if (!profileId) throw new Error("Not authenticated");

      // Check no active rental
      const { data: existing } = await supabase
        .from("player_rentals")
        .select("id")
        .eq("profile_id", profileId)
        .eq("status", "active")
        .maybeSingle();
      if (existing) throw new Error("You already have an active rental. End it first.");

      // Check cash for first week
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      if (!profile || (profile.cash || 0) < weeklyCost) {
        throw new Error("Not enough cash for the first week's rent");
      }

      // Deduct first week
      await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) - weeklyCost })
        .eq("id", profileId);

      // Create rental
      const { error } = await supabase.from("player_rentals").insert({
        user_id: profileId,
        rental_type_id: rentalType.id,
        country,
        weekly_cost: weeklyCost,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-rental"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Rental Started!", description: "Your first week's rent has been paid." });
    },
    onError: (error: Error) => {
      toast({ title: "Rental Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useEndRental() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rentalId: string) => {
      if (!profileId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("player_rentals")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", rentalId)
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-rental"] });
      toast({ title: "Rental Ended", description: "Your lease has been terminated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function calculateWeeklyRent(baseWeeklyCost: number, marketMultiplier: number = 1): number {
  return Math.round(baseWeeklyCost * marketMultiplier);
}

export function calculateDailyUpkeep(purchasePrice: number): number {
  return Math.round(purchasePrice * 0.001);
}

export function calculateSellPrice(purchasePrice: number, marketMultiplier: number = 1): number {
  return Math.round(purchasePrice * 0.85 * marketMultiplier);
}

export function getMarketPrice(basePrice: number, marketMultiplier: number = 1): number {
  return Math.round(basePrice * marketMultiplier);
}

export function useMarketPrices() {
  return useQuery({
    queryKey: ["housing-market-prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("housing_market_prices")
        .select("*")
        .order("country");
      if (error) throw error;
      return (data ?? []) as MarketPrice[];
    },
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });
}

export function useMarketPriceForCountry(country: string | null) {
  const { data: allPrices } = useMarketPrices();
  if (!country || !allPrices) return null;
  return allPrices.find(p => p.country === country) ?? null;
}

export function calculateRentalIncome(purchasePrice: number): number {
  return Math.round(purchasePrice * 0.005);
}

export function useSellProperty() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ property, marketMultiplier = 1 }: { property: PlayerProperty; marketMultiplier?: number }) => {
      if (!profileId) throw new Error("Not authenticated");
      const sellPrice = calculateSellPrice(property.purchase_price, marketMultiplier);

      // Credit cash back
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      if (profileError) throw profileError;

      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) + sellPrice })
        .eq("id", profileId);
      if (cashError) throw cashError;

      // Delete property
      const { error: deleteError } = await supabase
        .from("player_properties")
        .delete()
        .eq("id", property.id)
        .eq("profile_id", profileId);
      if (deleteError) throw deleteError;

      return sellPrice;
    },
    onSuccess: (sellPrice) => {
      queryClient.invalidateQueries({ queryKey: ["player-properties"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-cash"] });
      toast({ title: "Property Sold!", description: `You received $${sellPrice.toLocaleString()}.` });
    },
    onError: (error: Error) => {
      toast({ title: "Sale Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useToggleRentOut() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (property: PlayerProperty) => {
      if (!profileId) throw new Error("Not authenticated");
      const newRentedOut = !property.is_rented_out;
      const rentalIncome = newRentedOut ? calculateRentalIncome(property.purchase_price) : 0;

      const { error } = await supabase
        .from("player_properties")
        .update({
          is_rented_out: newRentedOut,
          rental_income_daily: rentalIncome,
        })
        .eq("id", property.id)
        .eq("profile_id", profileId);
      if (error) throw error;

      return newRentedOut;
    },
    onSuccess: (isRentedOut) => {
      queryClient.invalidateQueries({ queryKey: ["player-properties"] });
      toast({
        title: isRentedOut ? "Property Rented Out" : "Rental Stopped",
        description: isRentedOut ? "You're now earning rental income." : "You stopped renting out this property.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function usePlayerCash() {
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ["player-cash-housing", profileId],
    queryFn: async () => {
      if (!profileId) return 0;
      const { data, error } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      if (error) throw error;
      return (data?.cash ?? 0) as number;
    },
    enabled: !!profileId,
  });
}
