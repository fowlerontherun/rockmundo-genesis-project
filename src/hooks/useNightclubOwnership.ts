import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface OwnedNightclub {
  id: string;
  profile_id: string;
  club_id: string | null;
  club_name: string;
  city_id: string | null;
  quality_level: number;
  capacity: number;
  cover_charge: number;
  drink_markup_pct: number;
  staff_count: number;
  weekly_revenue: number;
  weekly_expenses: number;
  reputation_score: number;
  is_open: boolean;
  purchased_at: string;
  purchase_price: number;
}

export interface NightclubStaff {
  id: string;
  owned_club_id: string;
  staff_type: string;
  name: string;
  skill_level: number;
  salary_weekly: number;
  hired_at: string;
}

const STAFF_TYPES = ["bouncer", "bartender", "dj", "promoter", "manager"] as const;
export type StaffType = typeof STAFF_TYPES[number];

const STAFF_BASE_SALARY: Record<string, number> = {
  bouncer: 200,
  bartender: 250,
  dj: 400,
  promoter: 350,
  manager: 500,
};

const PURCHASE_PRICE_BY_QUALITY: Record<number, number> = {
  1: 5000,
  2: 15000,
  3: 50000,
  4: 150000,
  5: 500000,
};

export function getStaffTypes() {
  return STAFF_TYPES;
}

export function getStaffBaseSalary(type: string): number {
  return STAFF_BASE_SALARY[type] ?? 200;
}

export function getPurchasePrice(qualityLevel: number): number {
  return PURCHASE_PRICE_BY_QUALITY[qualityLevel] ?? 10000;
}

export function calculateWeeklyRevenue(club: OwnedNightclub): number {
  if (!club.is_open) return 0;
  const base = club.capacity * club.quality_level * 5;
  const coverRev = club.cover_charge * club.capacity * 0.3;
  const drinkRev = club.capacity * 0.5 * (10 + club.drink_markup_pct * 0.1);
  const repBonus = 1 + club.reputation_score / 1000;
  return Math.round((base + coverRev + drinkRev) * repBonus);
}

export function calculateWeeklyExpenses(club: OwnedNightclub, staff: NightclubStaff[]): number {
  const staffCost = staff.reduce((s, st) => s + st.salary_weekly, 0);
  const maintenance = club.capacity * club.quality_level * 2;
  return staffCost + maintenance;
}

export function useOwnedNightclubs() {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["owned-nightclubs", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("player_owned_nightclubs")
        .select("*")
        .eq("profile_id", profileId)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OwnedNightclub[];
    },
    enabled: !!profileId,
  });
}

export function useNightclubStaff(ownedClubId: string | undefined) {
  return useQuery({
    queryKey: ["nightclub-staff", ownedClubId],
    queryFn: async () => {
      if (!ownedClubId) return [];
      const { data, error } = await supabase
        .from("nightclub_staff")
        .select("*")
        .eq("owned_club_id", ownedClubId)
        .order("hired_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as NightclubStaff[];
    },
    enabled: !!ownedClubId,
  });
}

export function usePurchaseNightclub() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clubId, clubName, cityId, qualityLevel, capacity, coverCharge }: {
      clubId: string;
      clubName: string;
      cityId: string;
      qualityLevel: number;
      capacity: number;
      coverCharge: number;
    }) => {
      if (!profileId) throw new Error("Not authenticated");
      const price = getPurchasePrice(qualityLevel);

      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      if (!profile) throw new Error("Profile not found");
      if ((profile.cash ?? 0) < price) throw new Error(`Need $${price.toLocaleString()} to purchase this club`);

      await supabase
        .from("profiles")
        .update({ cash: Math.max(0, (profile.cash ?? 0) - price) })
        .eq("id", profileId);

      const { error } = await supabase
        .from("player_owned_nightclubs")
        .insert({
          profile_id: profileId,
          club_id: clubId,
          club_name: clubName,
          city_id: cityId,
          quality_level: qualityLevel,
          capacity,
          cover_charge: coverCharge,
          purchase_price: price,
        });
      if (error) throw error;
    },
    onSuccess: (_, { clubName }) => {
      toast.success(`🏢 Purchased ${clubName}!`);
      queryClient.invalidateQueries({ queryKey: ["owned-nightclubs"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useHireStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ownedClubId, staffType, name, skillLevel }: {
      ownedClubId: string;
      staffType: string;
      name: string;
      skillLevel: number;
    }) => {
      const salary = getStaffBaseSalary(staffType) * (1 + (skillLevel - 1) * 0.25);
      const { error } = await supabase
        .from("nightclub_staff")
        .insert({
          owned_club_id: ownedClubId,
          staff_type: staffType,
          name,
          skill_level: skillLevel,
          salary_weekly: Math.round(salary),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff hired!");
      queryClient.invalidateQueries({ queryKey: ["nightclub-staff"] });
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useFireStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase
        .from("nightclub_staff")
        .delete()
        .eq("id", staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff fired");
      queryClient.invalidateQueries({ queryKey: ["nightclub-staff"] });
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useUpdateOwnedClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clubId, updates }: { clubId: string; updates: Partial<OwnedNightclub> }) => {
      const { error } = await supabase
        .from("player_owned_nightclubs")
        .update(updates)
        .eq("id", clubId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owned-nightclubs"] });
    },
    onError: (err: any) => toast.error(err.message),
  });
}
