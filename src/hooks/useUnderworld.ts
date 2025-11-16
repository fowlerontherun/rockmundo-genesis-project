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
        .order("market_cap", { ascending: false });
      
      if (error) throw error;
      return (data || []) as CryptoToken[];
    },
  });

  return {
    tokens,
    tokensLoading,
  };
};
