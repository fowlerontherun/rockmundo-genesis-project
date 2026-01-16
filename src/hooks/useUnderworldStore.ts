import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";

export interface UnderworldProduct {
  id: string;
  name: string;
  description: string | null;
  lore: string | null;
  category: string;
  rarity: string;
  price_cash: number | null;
  price_token_id: string | null;
  price_token_amount: number | null;
  effects: Record<string, number | string>;
  duration_hours: number | null;
  is_available: boolean;
  stock_limit: number | null;
  current_stock: number | null;
  icon_name: string | null;
  created_at: string;
}

export interface ActiveBoost {
  id: string;
  user_id: string;
  product_id: string;
  boost_type: string;
  boost_value: number;
  started_at: string;
  expires_at: string;
  is_active: boolean;
  product?: UnderworldProduct;
}

export interface UnderworldPurchase {
  id: string;
  user_id: string;
  product_id: string;
  paid_with: string;
  cash_amount: number | null;
  token_id: string | null;
  token_amount: number | null;
  effects_applied: Record<string, number | string>;
  applied_at: string;
  expires_at: string | null;
  created_at: string;
  product?: UnderworldProduct;
}

export const useUnderworldStore = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all available products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["underworld-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("underworld_products")
        .select("*")
        .eq("is_available", true)
        .order("category", { ascending: true });

      if (error) throw error;
      return (data || []) as UnderworldProduct[];
    },
  });

  // Fetch user's cash balance
  const { data: userBalance = 0, isLoading: balanceLoading } = useQuery({
    queryKey: ["user-cash-balance", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data?.cash || 0;
    },
    enabled: !!user?.id,
  });

  // Fetch user's active boosts
  const { data: activeBoosts = [], isLoading: boostsLoading } = useQuery({
    queryKey: ["active-boosts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("player_active_boosts")
        .select(`
          *,
          product:underworld_products(*)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString());

      if (error) throw error;
      return (data || []) as ActiveBoost[];
    },
    enabled: !!user?.id,
  });

  // Fetch purchase history
  const { data: purchaseHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["purchase-history", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("underworld_purchases")
        .select(`
          *,
          product:underworld_products(*)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as UnderworldPurchase[];
    },
    enabled: !!user?.id,
  });

  // Purchase product mutation
  const purchaseProduct = useMutation({
    mutationFn: async ({
      product,
      paymentMethod,
    }: {
      product: UnderworldProduct;
      paymentMethod: "cash" | "crypto";
    }) => {
      if (!user?.id) throw new Error("Not logged in");

      // Validate payment
      if (paymentMethod === "cash") {
        if (!product.price_cash) throw new Error("Product cannot be purchased with cash");
        if (userBalance < product.price_cash) throw new Error("Insufficient funds");

        // Deduct cash
        const { error: cashError } = await supabase
          .from("profiles")
          .update({ cash: userBalance - product.price_cash })
          .eq("user_id", user.id);

        if (cashError) throw cashError;
      } else {
        // TODO: Implement crypto payment when token holdings are available
        throw new Error("Crypto payments coming soon");
      }

      // Apply effects based on product category
      const effects = product.effects || {};

      // Apply instant effects to profile
      if (effects.health || effects.energy || effects.xp || effects.fame) {
        const { data: profile, error: profileFetchError } = await supabase
          .from("profiles")
          .select("health, energy, experience, fame")
          .eq("user_id", user.id)
          .single();

        if (profileFetchError) throw profileFetchError;

        const updates: Record<string, number> = {};
        if (effects.health) {
          updates.health = Math.min(100, (profile?.health || 0) + (effects.health as number));
        }
        if (effects.energy) {
          updates.energy = Math.min(100, (profile?.energy || 0) + (effects.energy as number));
        }
        if (effects.xp) {
          updates.experience = (profile?.experience || 0) + (effects.xp as number);
        }
        if (effects.fame) {
          updates.fame = (profile?.fame || 0) + (effects.fame as number);
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("profiles")
            .update(updates)
            .eq("user_id", user.id);

          if (updateError) throw updateError;
        }
      }

      // Apply skill XP if applicable
      if (effects.skill_slug && effects.skill_xp) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (profile?.id) {
          const { data: skillProgress, error: skillFetchError } = await supabase
            .from("skill_progress")
            .select("*")
            .eq("profile_id", profile.id)
            .eq("skill_slug", String(effects.skill_slug))
            .single();

          if (!skillFetchError && skillProgress) {
            const skillXpToAdd = typeof effects.skill_xp === 'number' ? effects.skill_xp : parseInt(String(effects.skill_xp), 10);
            const { error: skillUpdateError } = await supabase
              .from("skill_progress")
              .update({
                current_xp: (skillProgress.current_xp || 0) + skillXpToAdd,
              })
              .eq("id", skillProgress.id);

            if (skillUpdateError) throw skillUpdateError;
          }
        }
      }

      // Create boost if product has duration
      let expiresAt: string | null = null;
      if (product.duration_hours) {
        expiresAt = new Date(
          Date.now() + product.duration_hours * 60 * 60 * 1000
        ).toISOString();

        // Determine boost type from effects
        let boostType = "unknown";
        let boostValue = 1;

        if (effects.xp_multiplier) {
          boostType = "xp_multiplier";
          boostValue = effects.xp_multiplier as number;
        } else if (effects.fame_multiplier) {
          boostType = "fame_multiplier";
          boostValue = effects.fame_multiplier as number;
        } else if (effects.energy_regen) {
          boostType = "energy_regen";
          boostValue = effects.energy_regen as number;
        } else if (effects.all_multiplier) {
          boostType = "all_multiplier";
          boostValue = effects.all_multiplier as number;
        }

        const { error: boostError } = await supabase
          .from("player_active_boosts")
          .insert({
            user_id: user.id,
            product_id: product.id,
            boost_type: boostType,
            boost_value: boostValue,
            expires_at: expiresAt,
          });

        if (boostError) throw boostError;
      }

      // Record the purchase
      const { error: purchaseError } = await supabase
        .from("underworld_purchases")
        .insert({
          user_id: user.id,
          product_id: product.id,
          paid_with: paymentMethod,
          cash_amount: paymentMethod === "cash" ? product.price_cash : null,
          effects_applied: effects,
          expires_at: expiresAt,
        });

      if (purchaseError) throw purchaseError;

      return { success: true, expiresAt };
    },
    onSuccess: (_, { product }) => {
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["active-boosts"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-history"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      toast({
        title: "Purchase Complete",
        description: `You acquired ${product.name}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if a specific boost is active
  const hasActiveBoost = (boostType: string): boolean => {
    return activeBoosts.some((boost) => boost.boost_type === boostType);
  };

  // Get active boost multiplier
  const getBoostMultiplier = (boostType: string): number => {
    const boost = activeBoosts.find((b) => b.boost_type === boostType);
    return boost?.boost_value || 1;
  };

  return {
    products,
    productsLoading,
    userBalance,
    balanceLoading,
    activeBoosts,
    boostsLoading,
    purchaseHistory,
    historyLoading,
    purchaseProduct,
    hasActiveBoost,
    getBoostMultiplier,
  };
};
