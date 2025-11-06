import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export interface PrimaryBandRecord {
  id: string;
  band_id: string;
  role: string;
  joined_at: string | null;
  member_status: string | null;
  is_touring_member: boolean | null;
  bands?: {
    id: string;
    name: string | null;
    fame: number | null;
    band_balance: number | null;
    status: string | null;
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
          `
            id,
            band_id,
            role,
            joined_at,
            member_status,
            is_touring_member,
            bands!inner (
              id,
              name,
              fame,
              band_balance,
              status
            )
          `
        )
        .eq("user_id", user.id)
        .eq("bands.status", "active")
        .neq("is_touring_member", true)
        .or("member_status.eq.active,member_status.is.null")
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!data) {
        return null;
      }

      if (data.member_status && data.member_status !== "active") {
        return null;
      }

      return data as PrimaryBandRecord;
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
};
