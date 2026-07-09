import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
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

export const useCryptoTokens = (profileId?: string) => {
  const { userId } = useActiveProfile();
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
    queryKey: ["token-holdings", profileId],
    queryFn: async () => {
      if (!profileId) return [];

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
    enabled: !!profileId,
  });

  // Fetch transaction history
  const { data: transactions = [] } = useQuery({
    queryKey: ["token-transactions", profileId],
    queryFn: async () => {
      if (!profileId) return [];

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
    enabled: !!profileId,
  });

  // Buy token mutation
  const buyToken = useMutation({
    mutationFn: async ({
      tokenId,
      quantity,
    }: {
      tokenId: string;
      quantity: number;
      price?: number;
    }) => {
      if (!profileId) throw new Error("User not authenticated");
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Invalid quantity");
      }

      const { error } = await (supabase as any).rpc("trade_crypto_token", {
        p_profile_id: profileId,
        p_token_id: tokenId,
        p_transaction_type: "buy",
        p_quantity: quantity,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["token-holdings", profileId] });
      queryClient.invalidateQueries({ queryKey: ["token-transactions", profileId] });
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
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
    }: {
      tokenId: string;
      quantity: number;
      price?: number;
    }) => {
      if (!profileId) throw new Error("User not authenticated");
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Invalid quantity");
      }

      const { error } = await (supabase as any).rpc("trade_crypto_token", {
        p_profile_id: profileId,
        p_token_id: tokenId,
        p_transaction_type: "sell",
        p_quantity: quantity,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["token-holdings", profileId] });
      queryClient.invalidateQueries({ queryKey: ["token-transactions", profileId] });
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
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
