import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";

export interface CryptoToken {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  volume_24h: number;
  market_cap: number;
  price_history: { timestamp: string; price: number }[];
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface TokenHolding {
  id: string;
  token_id: string;
  quantity: number;
  average_buy_price: number | null;
  crypto_tokens?: Pick<CryptoToken, "symbol" | "name" | "current_price">;
}

export interface TokenTransaction {
  id: string;
  token_id: string;
  transaction_type: "buy" | "sell";
  quantity: number;
  price_per_token: number;
  total_amount: number;
  created_at: string;
  crypto_tokens?: Pick<CryptoToken, "symbol" | "name">;
}

type TradePayload = {
  tokenId: string;
  quantity: number;
  pricePerToken: number;
  type: "buy" | "sell";
};

export const useUnderworld = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: tokens = [],
    isLoading: tokensLoading,
  } = useQuery({
    queryKey: ["crypto-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crypto_tokens")
        .select("*")
        .order("market_cap", { ascending: false });

      if (error) throw error;
      return (data || []) as CryptoToken[];
    },
  });

  const {
    data: holdings = [],
    isLoading: holdingsLoading,
  } = useQuery({
    queryKey: ["token-holdings", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_token_holdings")
        .select("id, token_id, quantity, average_buy_price, crypto_tokens(symbol, name, current_price)")
        .eq("user_id", user?.id as string)
        .order("quantity", { ascending: false });

      if (error) throw error;
      return (data || []) as TokenHolding[];
    },
  });

  const {
    data: transactions = [],
    isLoading: transactionsLoading,
  } = useQuery({
    queryKey: ["token-transactions", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_transactions")
        .select("id, token_id, transaction_type, quantity, price_per_token, total_amount, created_at, crypto_tokens(symbol, name)")
        .eq("user_id", user?.id as string)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as TokenTransaction[];
    },
  });

  const tradeMutation = useMutation({
    mutationFn: async ({ tokenId, quantity, pricePerToken, type }: TradePayload) => {
      if (!user) {
        throw new Error("You need to be signed in to trade tokens.");
      }

      const normalizedQuantity = Number(quantity);
      const normalizedPrice = Number(pricePerToken);

      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        throw new Error("Enter a valid quantity to trade.");
      }

      if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
        throw new Error("Enter a valid price per token.");
      }

      const { data: existingHolding, error: holdingError } = await supabase
        .from("player_token_holdings")
        .select("*")
        .eq("user_id", user.id)
        .eq("token_id", tokenId)
        .maybeSingle();

      if (holdingError) throw holdingError;

      if (type === "sell" && (!existingHolding || Number(existingHolding.quantity) < normalizedQuantity)) {
        throw new Error("You do not have enough tokens to complete this sale.");
      }

      const totalAmount = normalizedQuantity * normalizedPrice;

      const { error: txError } = await supabase.from("token_transactions").insert([
        {
          user_id: user.id,
          token_id: tokenId,
          transaction_type: type,
          quantity: normalizedQuantity,
          price_per_token: normalizedPrice,
          total_amount: totalAmount,
        },
      ]);

      if (txError) throw txError;

      if (type === "buy") {
        const currentQuantity = Number(existingHolding?.quantity || 0);
        const currentAverage = Number(existingHolding?.average_buy_price || 0);
        const newQuantity = currentQuantity + normalizedQuantity;
        const newAverage = newQuantity > 0 ? (currentQuantity * currentAverage + normalizedQuantity * normalizedPrice) / newQuantity : normalizedPrice;

        if (existingHolding) {
          const { error } = await supabase
            .from("player_token_holdings")
            .update({
              quantity: newQuantity,
              average_buy_price: newAverage,
            })
            .eq("id", existingHolding.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("player_token_holdings").insert([
            {
              user_id: user.id,
              token_id: tokenId,
              quantity: normalizedQuantity,
              average_buy_price: normalizedPrice,
            },
          ]);
          if (error) throw error;
        }
      } else {
        const currentQuantity = Number(existingHolding?.quantity || 0);
        const remaining = currentQuantity - normalizedQuantity;

        if (remaining <= 0 && existingHolding) {
          const { error } = await supabase
            .from("player_token_holdings")
            .delete()
            .eq("id", existingHolding.id);
          if (error) throw error;
        } else if (existingHolding) {
          const { error } = await supabase
            .from("player_token_holdings")
            .update({ quantity: remaining })
            .eq("id", existingHolding.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["crypto-tokens"] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["token-holdings", user.id] });
        queryClient.invalidateQueries({ queryKey: ["token-transactions", user.id] });
      }

      toast({
        title: variables.type === "buy" ? "Purchase complete" : "Sale complete",
        description: `Successfully ${variables.type === "buy" ? "bought" : "sold"} ${variables.quantity} token${variables.quantity === 1 ? "" : "s"}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to process trade",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    tokens,
    tokensLoading,
    holdings,
    holdingsLoading,
    transactions,
    transactionsLoading,
    placeOrder: tradeMutation.mutateAsync,
    placingOrder: tradeMutation.isPending,
  };
};
