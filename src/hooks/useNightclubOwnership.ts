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
  verified_purchase_id: string | null;
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

// Display guidance only. The DB enforces the actual staffing cap under a club row lock.
export function getNightclubStaffCap(capacity: number): number {
  return Math.min(20, Math.max(5, Math.ceil(capacity / 100) + 4));
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
      // This column exists in the live DB (2026-10-19 ownership cutover),
      // but the checked-in generated Supabase types can lag the migration.
      // Keep the UI type aligned with the verified live table projection.
      return (data ?? []) as unknown as OwnedNightclub[];
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

type VerifiedNightclubPurchase = {
  receipt_id: string;
  owned_club_id: string;
  club_id: string;
  cash_spent: number;
  replayed: boolean;
};

// Also retain the request ID when sessionStorage is unavailable in a WebView.
const pendingClubPurchases = new Map<string, string>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function usePurchaseNightclub() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clubId }: { clubId: string }) => {
      if (!profileId) throw new Error("Choose your active character to buy a nightclub");
      const key = `nightclub-purchase:${profileId}:${clubId}`;
      let requestId = pendingClubPurchases.get(key);
      if (!requestId) {
        try {
          const stored = sessionStorage.getItem(key);
          if (stored && uuidPattern.test(stored)) requestId = stored;
        } catch { /* Mobile private sessions may block session storage. */ }
      }
      requestId ??= crypto.randomUUID();
      pendingClubPurchases.set(key, requestId);
      try { sessionStorage.setItem(key, requestId); } catch { /* Map provides retry safety. */ }

      // Never debit cash or mint club ownership from the browser.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("purchase_nightclub_atomic", {
        p_profile_id: profileId, p_club_id: clubId, p_request_id: requestId,
      });
      if (error) throw error;
      const receipt = data as VerifiedNightclubPurchase | null;
      if (!receipt || receipt.club_id !== clubId ||
          !uuidPattern.test(receipt.receipt_id ?? "") ||
          !uuidPattern.test(receipt.owned_club_id ?? "") ||
          !Number.isInteger(receipt.cash_spent) || receipt.cash_spent <= 0) {
        throw new Error("Nightclub checkout was not confirmed by the server");
      }
      pendingClubPurchases.delete(key);
      try { sessionStorage.removeItem(key); } catch { /* Best effort. */ }
      return receipt;
    },
    onSuccess: (receipt) => {
      toast.success(`Nightclub purchased for $${receipt.cash_spent.toLocaleString()}!`);
      void queryClient.invalidateQueries({ queryKey: ["owned-nightclubs"] });
      void queryClient.invalidateQueries({ queryKey: ["active-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["game-data"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Nightclub purchase could not be verified"),
  });
}

type StaffActionResult = {
  action: "hire" | "fire";
  staff_id: string;
  owned_club_id: string;
  salary_weekly: number;
  still_employed: boolean;
  replayed: boolean;
};

const pendingStaffActions = new Map<string, string>();
const staffActionKey = (profileId: string, clubId: string, intent: string) =>
  `nightclub-staff-action:${profileId}:${clubId}:${intent}`;

function staffRequestId(key: string): string {
  let requestId = pendingStaffActions.get(key);
  if (!requestId) {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored && uuidPattern.test(stored)) requestId = stored;
    } catch { /* Session storage is optional, in-memory retry remains available. */ }
  }
  requestId ??= crypto.randomUUID();
  pendingStaffActions.set(key, requestId);
  try { sessionStorage.setItem(key, requestId); } catch { /* Best effort. */ }
  return requestId;
}

function completeStaffRequest(key: string) {
  pendingStaffActions.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* Best effort. */ }
}

export function useHireStaff() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async ({ ownedClubId, staffType, name, skillLevel }: {
      ownedClubId: string;
      staffType: string;
      name: string;
      skillLevel: number;
    }) => {
      if (!profileId) throw new Error("Select an active character to hire staff");
      const staffName = name.trim();
      if (!STAFF_TYPES.includes(staffType as StaffType) ||
          staffName.length < 2 || staffName.length > 64 ||
          !Number.isInteger(skillLevel) || skillLevel < 1 || skillLevel > 5) {
        throw new Error("Enter a valid staff name, role and skill level");
      }
      const key = staffActionKey(profileId, ownedClubId,
        `hire:${staffType}:${staffName}:${skillLevel}`);
      const requestId = staffRequestId(key);
      // All salaries and staff caps are determined by the server.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("nightclub_staff_action_atomic", {
        p_owned_club_id: ownedClubId,
        p_action: "hire",
        p_request_id: requestId,
        p_staff_type: staffType,
        p_name: staffName,
        p_skill_level: skillLevel,
      });
      if (error) throw error;
      const result = data as StaffActionResult | null;
      if (!result || result.action !== "hire" || result.owned_club_id !== ownedClubId ||
          !uuidPattern.test(result.staff_id ?? "") ||
          !Number.isInteger(result.salary_weekly) || result.salary_weekly < 0) {
        throw new Error("Staff hire could not be verified by the server");
      }
      completeStaffRequest(key);
      return result;
    },
    onSuccess: (result) => {
      toast.success(result.still_employed ?
        `Staff hired at $${result.salary_weekly}/week` :
        "The previous staff hire was already processed and the staff member has since left");
      void queryClient.invalidateQueries({ queryKey: ["nightclub-staff", result.owned_club_id] });
      void queryClient.invalidateQueries({ queryKey: ["owned-nightclubs"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Unable to hire staff"),
  });
}

export function useFireStaff() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async ({ ownedClubId, staffId }: {
      ownedClubId: string;
      staffId: string;
    }) => {
      if (!profileId) throw new Error("Select an active character to manage club staff");
      const key = staffActionKey(profileId, ownedClubId, `fire:${staffId}`);
      const requestId = staffRequestId(key);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("nightclub_staff_action_atomic", {
        p_owned_club_id: ownedClubId,
        p_action: "fire",
        p_request_id: requestId,
        p_staff_id: staffId,
      });
      if (error) throw error;
      const result = data as StaffActionResult | null;
      if (!result || result.action !== "fire" || result.owned_club_id !== ownedClubId ||
          result.staff_id !== staffId || result.still_employed) {
        throw new Error("Staff dismissal could not be verified by the server");
      }
      completeStaffRequest(key);
      return result;
    },
    onSuccess: (result) => {
      toast.success("Staff member dismissed");
      void queryClient.invalidateQueries({ queryKey: ["nightclub-staff", result.owned_club_id] });
      void queryClient.invalidateQueries({ queryKey: ["owned-nightclubs"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Unable to dismiss staff"),
  });
}

type EditableNightclubSettings = Partial<Pick<OwnedNightclub,
  "cover_charge" | "drink_markup_pct" | "is_open">>;

export function useUpdateOwnedClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clubId, updates }: { clubId: string; updates: EditableNightclubSettings }) => {
      const keys = Object.keys(updates);
      if (!keys.length || keys.some((field) =>
        !["cover_charge", "drink_markup_pct", "is_open"].includes(field))) {
        throw new Error("Only cover, markup and open status can be edited");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("update_nightclub_settings", {
        p_owned_club_id: clubId,
        p_cover_charge: updates.cover_charge ?? null,
        p_drink_markup_pct: updates.drink_markup_pct ?? null,
        p_is_open: updates.is_open ?? null,
      });
      if (error) throw error;
      if ((data as { owned_club_id?: string } | null)?.owned_club_id !== clubId) {
        throw new Error("Club settings were not confirmed by the server");
      }
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["owned-nightclubs"] }); },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Unable to save nightclub settings"),
  });
}
