import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export interface PrimaryBandRecord {
  id: string;
  band_id: string;
  role: string;
  joined_at: string | null;
  bands?: {
    id: string;
    name: string | null;
    fame: number | null;
    band_balance: number | null;
  } | null;
}

export const usePrimaryBand = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["primary-band", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return null;
      }

      const { data, error } = await supabase
        .from("band_members")
        .select(
          `id, band_id, role, joined_at, bands ( id, name, fame, band_balance )`
        )
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return (data as PrimaryBandRecord) ?? null;
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
};
