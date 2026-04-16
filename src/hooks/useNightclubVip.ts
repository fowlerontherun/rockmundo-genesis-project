import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface VipPackage {
  id: string;
  club_id: string;
  package_name: string;
  price: number;
  perks: {
    free_drinks?: number;
    fame_boost_pct?: number;
    skip_cover?: boolean;
    exclusive_npc_access?: boolean;
    drink_discount_pct?: number;
  };
  min_reputation_tier: string;
  max_guests: number;
}

export interface VipBooking {
  id: string;
  profile_id: string;
  club_id: string;
  package_id: string;
  booked_at: string;
  expires_at: string;
  status: string;
}

const TIER_ORDER = ["newcomer", "regular", "vip", "legend"];

export function meetsMinTier(playerTier: string, requiredTier: string): boolean {
  return TIER_ORDER.indexOf(playerTier) >= TIER_ORDER.indexOf(requiredTier);
}

export function useVipPackages(clubId: string | undefined) {
  return useQuery({
    queryKey: ["vip-packages", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("nightclub_vip_packages")
        .select("*")
        .eq("club_id", clubId)
        .order("price", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        perks: typeof d.perks === "object" && d.perks ? d.perks : {},
      })) as VipPackage[];
    },
    enabled: !!clubId,
  });
}

export function useActiveVipBooking(clubId: string | undefined) {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["vip-booking", profileId, clubId],
    queryFn: async () => {
      if (!profileId || !clubId) return null;
      const { data, error } = await supabase
        .from("player_vip_bookings")
        .select("*")
        .eq("profile_id", profileId)
        .eq("club_id", clubId)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString())
        .order("booked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as VipBooking | null;
    },
    enabled: !!profileId && !!clubId,
  });
}

export function useBookVip() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clubId, pkg }: { clubId: string; pkg: VipPackage }) => {
      if (!profileId) throw new Error("Not authenticated");

      // Deduct cash
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      if (!profile) throw new Error("Profile not found");
      if ((profile.cash ?? 0) < pkg.price) throw new Error(`Need $${pkg.price} for ${pkg.package_name}`);

      await supabase
        .from("profiles")
        .update({ cash: Math.max(0, (profile.cash ?? 0) - pkg.price) })
        .eq("id", profileId);

      // Create booking (24 game hours = 6 real hours at 1:4 scale)
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("player_vip_bookings")
        .insert({
          profile_id: profileId,
          club_id: clubId,
          package_id: pkg.id,
          expires_at: expiresAt,
          status: "active",
        });
      if (error) throw error;
    },
    onSuccess: (_, { pkg }) => {
      toast.success(`🥂 VIP booked: ${pkg.package_name}`);
      queryClient.invalidateQueries({ queryKey: ["vip-booking"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
    },
    onError: (err: any) => toast.error(err.message),
  });
}
