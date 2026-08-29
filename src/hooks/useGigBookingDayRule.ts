import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GigBookingDayRuleReason =
  | "no_same_day_show"
  | "same_venue_gap_ok"
  | "different_venue"
  | "insufficient_gap"
  | "overlap";

export interface ExistingSameDayShow {
  gig_id: string;
  venue_id: string;
  venue_name: string;
  scheduled_start: string;
  scheduled_end: string;
  time_slot: string | null;
}

export interface GigBookingDayRuleResult {
  allowed: boolean;
  reason: GigBookingDayRuleReason;
  minimum_gap_minutes: number;
  actual_gap_minutes: number | null;
  same_day_show_count: number;
  existing_show?: ExistingSameDayShow;
  candidate_start: string;
  candidate_end: string;
  venue_timezone: string;
  local_date: string;
  slot: string;
}

export function toLocalDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function useGigBookingDayRule(
  bandId: string | undefined,
  venueId: string | undefined,
  date: Date | undefined,
  slot: string | undefined,
) {
  const localDate = date ? toLocalDateKey(date) : undefined;

  return useQuery({
    queryKey: ["gig-booking-day-rule", bandId, venueId, localDate, slot],
    queryFn: async (): Promise<GigBookingDayRuleResult | null> => {
      if (!bandId || !venueId || !localDate || !slot) return null;

      const { data, error } = await supabase.rpc("check_gig_booking_day_rule", {
        p_band_id: bandId,
        p_venue_id: venueId,
        p_local_date: localDate,
        p_slot: slot,
      });
      if (error) throw error;
      if (!data || typeof data !== "object") {
        throw new Error("gig_booking_day_rule_invalid_response");
      }

      return data as unknown as GigBookingDayRuleResult;
    },
    enabled: Boolean(bandId && venueId && localDate && slot),
    staleTime: 10_000,
    retry: 1,
  });
}
