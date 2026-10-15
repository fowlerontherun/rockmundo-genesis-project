import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
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
  addiction_type: string | null;
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
  const { profileId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // A lost response must retry the same intended purchase, not charge twice.
  const purchaseRequestIds = useRef<Record<string, string>>({});

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
    queryKey: ["user-cash-balance", profileId],
    queryFn: async () => {
      if (!profileId) return 0;
      const { data, error } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();

      if (error) throw error;
      return data?.cash || 0;
    },
    enabled: !!profileId,
  });

  // Fetch user's active boosts
  const { data: activeBoosts = [], isLoading: boostsLoading } = useQuery({
    queryKey: ["active-boosts", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("player_active_boosts")
        .select(`
          *,
          product:underworld_products(*)
        `)
      .eq("profile_id", profileId)
      .eq("is_active", true)
        .gt("expires_at", new Date().toISOString());

      if (error) throw error;
      return (data || []) as ActiveBoost[];
    },
    enabled: !!profileId,
  });

  // Fetch purchase history
  const { data: purchaseHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["purchase-history", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const history: UnderworldPurchase[] = [];
      for (let offset = 0; offset < 100_000; offset += 1000) {
        const { data, error } = await supabase
          .from("underworld_purchases")
          .select(`*, product:underworld_products(*)`)
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 999);
        if (error) throw error;
        history.push(...((data || []) as UnderworldPurchase[]));
        if (!data || data.length < 1000) return history;
      }
      throw new Error("Purchase history exceeds pagination safety limit");
    },
    enabled: !!profileId,
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
      if (!profileId) throw new Error("Not logged in");
      const requestKey = `${profileId}:${product.id}:${paymentMethod}`;
      const requestId = purchaseRequestIds.current[requestKey]
        ?? (purchaseRequestIds.current[requestKey] = crypto.randomUUID());
      const { data, error } = await (supabase as any).rpc("buy_underworld_product_atomic", {
        p_profile_id: profileId,
        p_product_id: product.id,
        p_payment_method: paymentMethod,
        p_request_id: requestId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error("Underworld transaction was not confirmed");
      // The purchase trigger has already committed any arrest in the same
      // transaction. Read the authoritative prison record, never roll in JS.
      const { data: imprisonment, error: arrestError } = await (supabase as any)
        .from("player_imprisonments")
        .select("bail_amount, original_sentence_days, reason")
        .eq("profile_id", profileId)
        .eq("status", "imprisoned")
        .gte("imprisoned_at", new Date(Date.now() - 120_000).toISOString())
        .order("imprisoned_at", { ascending: false })
        .limit(1).maybeSingle();
      if (arrestError) throw arrestError;
      return { success: true, expiresAt: data.expiresAt ?? null,
        storedInInventory: Boolean(data.storedInInventory),
        arrestResult: imprisonment ? {
          arrested: true, bailAmount: imprisonment.bail_amount,
          sentenceDays: imprisonment.original_sentence_days,
          description: imprisonment.reason,
        } : null };
    },
    onSuccess: (result, { product, paymentMethod }) => {
      if (profileId) delete purchaseRequestIds.current[`${profileId}:${product.id}:${paymentMethod}`];
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["active-boosts"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-history"] });
      queryClient.invalidateQueries({ queryKey: ["underworld-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      if (result.arrestResult?.arrested) {
        toast({
          title: "🚔 You've Been Arrested!",
          description: `${result.arrestResult.description}. Bail: $${result.arrestResult.bailAmount}. Sentence: ${result.arrestResult.sentenceDays} days.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Purchase Complete",
          description: result.storedInInventory 
            ? `${product.name} has been added to your inventory!`
            : `You acquired ${product.name}!`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [boostClock, setBoostClock] = useState(() => Date.now());
  useEffect(() => { const interval = window.setInterval(() => setBoostClock(Date.now()), 30_000); return () => window.clearInterval(interval); }, []);
  const validBoosts = activeBoosts.filter(boost => boost.is_active && new Date(boost.expires_at).getTime() > boostClock);

  // Check if a specific boost is active
  const hasActiveBoost = (boostType: string): boolean => {
    return validBoosts.some((boost) => boost.boost_type === boostType);
  };

  // Get active boost multiplier
  const getBoostMultiplier = (boostType: string): number => {
    // Use strongest eligible boost rather than whichever database row was first.
    return Math.max(1, ...validBoosts.filter(b => b.boost_type === boostType).map(b => Number(b.boost_value) || 1));
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
