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
  is_rugged: boolean;
  volatility_tier: string;
  trend_direction: number;
  is_active: boolean;
}

export const useUnderworld = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tokens = [], isLoading: tokensLoading } = useQuery({
    queryKey: ["crypto-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crypto_tokens")
        .select("*")
        .eq("is_active", true)
        .eq("is_rugged", false)
        .order("market_cap", { ascending: false });
      
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        price_history: (t.price_history || []) as { timestamp: string; price: number }[],
      })) as CryptoToken[];
    },
    refetchInterval: 30000,
  });

  return {
    tokens,
    tokensLoading,
  };
};
