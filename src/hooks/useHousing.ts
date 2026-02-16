import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/components/ui/use-toast";

export interface HousingType {
  id: string;
  country: string;
  name: string;
  description: string;
  tier: number;
  base_price: number;
  image_url: string | null;
  style_tags: string[];
  bedrooms: number;
  is_active: boolean;
  created_at: string;
}

export interface PlayerProperty {
  id: string;
  user_id: string;
  housing_type_id: string;
  country: string;
  purchased_at: string;
  purchase_price: number;
  is_primary: boolean;
  daily_upkeep: number;
  is_rented_out: boolean;
  rental_income_daily: number;
  created_at: string;
  housing_types?: HousingType;
}

export interface RentalType {
  id: string;
  name: string;
  description: string;
  base_weekly_cost: number;
  tier: number;
  created_at: string;
}

export interface PlayerRental {
  id: string;
  user_id: string;
  rental_type_id: string;
  country: string;
  weekly_cost: number;
  started_at: string;
  ended_at: string | null;
  last_charged_at: string;
  status: string;
  created_at: string;
  rental_types?: RentalType;
}

export function useHousingTypes(country: string | null) {
  return useQuery({
    queryKey: ["housing-types", country],
    queryFn: async () => {
      if (!country) return [];
      const { data, error } = await supabase
        .from("housing_types")
        .select("*")
        .eq("country", country)
        .eq("is_active", true)
        .order("tier", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HousingType[];
    },
    enabled: !!country,
  });
}

export function useRentalTypes() {
  return useQuery({
    queryKey: ["rental-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_types")
        .select("*")
        .order("tier", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RentalType[];
    },
  });
}

export function usePlayerProperties() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["player-properties", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("player_properties")
        .select("*, housing_types(*)")
        .eq("user_id", user.id)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlayerProperty[];
    },
    enabled: !!user,
  });
}

export function usePlayerRental() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["player-rental", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("player_rentals")
        .select("*, rental_types(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data as PlayerRental | null;
    },
    enabled: !!user,
  });
}

export function useBuyProperty() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ housingType, country }: { housingType: HousingType; country: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Get player cash
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", user.id)
        .single();
      if (profileError) throw profileError;
      if ((profile.cash || 0) < housingType.base_price) {
        throw new Error("Not enough cash to buy this property");
      }

      // Deduct cash
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) - housingType.base_price })
        .eq("user_id", user.id);
      if (cashError) throw cashError;

      // Create property record with upkeep
      const dailyUpkeep = Math.round(housingType.base_price * 0.001);
      const { error: insertError } = await supabase
        .from("player_properties")
        .insert({
          user_id: user.id,
          housing_type_id: housingType.id,
          country,
          purchase_price: housingType.base_price,
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
  const { user } = useAuth();
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
      if (!user) throw new Error("Not authenticated");

      // Check no active rental
      const { data: existing } = await supabase
        .from("player_rentals")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (existing) throw new Error("You already have an active rental. End it first.");

      // Check cash for first week
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", user.id)
        .single();
      if (!profile || (profile.cash || 0) < weeklyCost) {
        throw new Error("Not enough cash for the first week's rent");
      }

      // Deduct first week
      await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) - weeklyCost })
        .eq("user_id", user.id);

      // Create rental
      const { error } = await supabase.from("player_rentals").insert({
        user_id: user.id,
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rentalId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("player_rentals")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", rentalId)
        .eq("user_id", user.id);
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

// Helper to calculate rental cost scaled by country cost_of_living
export function calculateWeeklyRent(baseWeeklyCost: number, costOfLiving: number): number {
  return Math.round(baseWeeklyCost * (0.4 + (costOfLiving / 100) * 1.2));
}

// Helper formulas
export function calculateDailyUpkeep(basePrice: number): number {
  return Math.round(basePrice * 0.001);
}

export function calculateSellPrice(purchasePrice: number): number {
  return Math.round(purchasePrice * 0.7);
}

export function calculateRentalIncome(purchasePrice: number): number {
  return Math.round(purchasePrice * 0.005);
}

export function useSellProperty() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (property: PlayerProperty) => {
      if (!user) throw new Error("Not authenticated");
      const sellPrice = calculateSellPrice(property.purchase_price);

      // Credit cash back
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", user.id)
        .single();
      if (profileError) throw profileError;

      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) + sellPrice })
        .eq("user_id", user.id);
      if (cashError) throw cashError;

      // Delete property
      const { error: deleteError } = await supabase
        .from("player_properties")
        .delete()
        .eq("id", property.id)
        .eq("user_id", user.id);
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (property: PlayerProperty) => {
      if (!user) throw new Error("Not authenticated");
      const newRentedOut = !property.is_rented_out;
      const rentalIncome = newRentedOut ? calculateRentalIncome(property.purchase_price) : 0;

      const { error } = await supabase
        .from("player_properties")
        .update({
          is_rented_out: newRentedOut,
          rental_income_daily: rentalIncome,
        })
        .eq("id", property.id)
        .eq("user_id", user.id);
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
  const { user } = useAuth();
  return useQuery({
    queryKey: ["player-cash-housing", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return (data?.cash ?? 0) as number;
    },
    enabled: !!user,
  });
}
