import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

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
    genre: string | null;
    fame: number | null;
    band_balance: number | null;
    chemistry_level: number | null;
    weekly_fans: number | null;
    performance_count: number | null;
    status: string | null;
    logo_url: string | null;
  } | null;
}

export const usePrimaryBand = () => {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["primary-band", profileId],
    queryFn: async () => {
      if (!profileId) return null;

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
            bands:bands!band_members_band_id_fkey (
              id,
              name,
              genre,
              fame,
              band_balance,
              chemistry_level,
              weekly_fans,
              performance_count,
              status,
              logo_url
            )
          `
        )
        .eq("profile_id", profileId)
        .or("member_status.is.null,member_status.eq.active")
        .order("joined_at", { ascending: false });

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      const memberships = (data ?? []) as PrimaryBandRecord[];
      const primary = memberships.find(
        row => !row.is_touring_member && (!row.bands?.status || row.bands.status === "active"),
      );
      return primary ?? null;
    },
    enabled: !!profileId,
    staleTime: 60 * 1000,
  });
};