import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CryptoToken {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  volume_24h: number;
  price_history: any;
}

export interface TokenHolding {
  id: string;
  token_id: string;
  quantity: number;
  average_buy_price: number;
  token: CryptoToken;
}

export const useCryptoTokens = (userId?: string) => {
  const queryClient = useQueryClient();

  // Fetch all tokens
  const { data: tokens = [], isLoading: tokensLoading } = useQuery({
    queryKey: ["crypto-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crypto_tokens")
        .select("*")
        .eq("is_active", true)
        .eq("is_rugged", false)
        .order("market_cap", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as any as CryptoToken[];
    },
    refetchInterval: 30000,
  });

  // Fetch user holdings
  const { data: holdings = [], isLoading: holdingsLoading } = useQuery({
    queryKey: ["token-holdings", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("player_token_holdings")
        .select(`
          *,
          token:crypto_tokens(*)
        `)
        .eq("user_id", userId);

      if (error) throw error;
      return data as any as TokenHolding[];
    },
    enabled: !!userId,
  });

  // Fetch transaction history
  const { data: transactions = [] } = useQuery({
    queryKey: ["token-transactions", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("token_transactions")
        .select(`
          *,
          token:crypto_tokens(symbol, name)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Buy token mutation
  const buyToken = useMutation({
    mutationFn: async ({
      tokenId,
      quantity,
      price,
    }: {
      tokenId: string;
      quantity: number;
      price: number;
    }) => {
      if (!userId) throw new Error("User not authenticated");

      const totalCost = quantity * price;

      // Check user balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", userId)
        .single();

      if (!profile || profile.cash < totalCost) {
        throw new Error("Insufficient funds");
      }

      // Deduct cash
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: profile.cash - totalCost })
        .eq("user_id", userId);

      if (cashError) throw cashError;

      // Record transaction
      const { error: txError } = await supabase.from("token_transactions").insert({
        user_id: userId,
        token_id: tokenId,
        transaction_type: "buy",
        quantity,
        price_per_token: price,
        total_amount: totalCost,
      });

      if (txError) throw txError;

      // Fetch fresh holding from DB to avoid stale closure
      const { data: existingHoldings } = await supabase
        .from("player_token_holdings")
        .select("*")
        .eq("user_id", userId)
        .eq("token_id", tokenId)
        .limit(1);

      const existing = existingHoldings?.[0];

      if (existing) {
        const newQuantity = existing.quantity + quantity;
        const newAvgPrice = 
          (existing.average_buy_price * existing.quantity + price * quantity) / newQuantity;

        const { error: holdingError } = await supabase
          .from("player_token_holdings")
          .update({
            quantity: newQuantity,
            average_buy_price: newAvgPrice,
          })
          .eq("id", existing.id);

        if (holdingError) throw holdingError;
      } else {
        const { error: holdingError } = await supabase
          .from("player_token_holdings")
          .insert({
            user_id: userId,
            token_id: tokenId,
            quantity,
            average_buy_price: price,
          });

        if (holdingError) throw holdingError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["token-holdings", userId] });
      queryClient.invalidateQueries({ queryKey: ["token-transactions", userId] });
      toast.success("Token purchased successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to buy token", { description: error.message });
    },
  });

  // Sell token mutation
  const sellToken = useMutation({
    mutationFn: async ({
      tokenId,
      quantity,
      price,
    }: {
      tokenId: string;
      quantity: number;
      price: number;
    }) => {
      if (!userId) throw new Error("User not authenticated");

      // Fetch fresh holding from DB to avoid stale closure
      const { data: freshHoldings } = await supabase
        .from("player_token_holdings")
        .select("*")
        .eq("user_id", userId)
        .eq("token_id", tokenId)
        .limit(1);

      const holding = freshHoldings?.[0];
      if (!holding || holding.quantity < quantity) {
        throw new Error("Insufficient token balance");
      }

      const totalRevenue = quantity * price;

      // Add cash
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", userId)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: profile.cash + totalRevenue })
        .eq("user_id", userId);

      if (cashError) throw cashError;

      // Record transaction
      const { error: txError } = await supabase.from("token_transactions").insert({
        user_id: userId,
        token_id: tokenId,
        transaction_type: "sell",
        quantity,
        price_per_token: price,
        total_amount: totalRevenue,
      });

      if (txError) throw txError;

      // Update holding
      const newQuantity = holding.quantity - quantity;
      
      if (newQuantity > 0) {
        const { error: holdingError } = await supabase
          .from("player_token_holdings")
          .update({ quantity: newQuantity })
          .eq("id", holding.id);

        if (holdingError) throw holdingError;
      } else {
        const { error: holdingError } = await supabase
          .from("player_token_holdings")
          .delete()
          .eq("id", holding.id);

        if (holdingError) throw holdingError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["token-holdings", userId] });
      queryClient.invalidateQueries({ queryKey: ["token-transactions", userId] });
      toast.success("Token sold successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to sell token", { description: error.message });
    },
  });

  return {
    tokens,
    holdings,
    transactions,
    isLoading: tokensLoading || holdingsLoading,
    buyToken: buyToken.mutate,
    sellToken: sellToken.mutate,
    isBuying: buyToken.isPending,
    isSelling: sellToken.isPending,
  };
};
