import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currentNightclubEvent, type NightclubGameDate } from "@/utils/nightclubGameEvents";

export interface NightclubEvent {
  id: string;
  club_id: string;
  event_name: string;
  event_type: string;
  genre_focus: string | null;
  day_of_week: number | null;
  scheduled_date: string | null;
  cover_charge_override: number | null;
  fame_multiplier: number;
  xp_multiplier: number;
  special_guest_name: string | null;
  description: string | null;
  is_recurring: boolean;
  is_active: boolean;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function getDayName(day: number): string {
  return DAY_NAMES[day] ?? "Unknown";
}

export function getEventTypeLabel(type: string): string {
  switch (type) {
    case "theme_night": return "Theme Night";
    case "special_event": return "Special Event";
    case "competition": return "Competition";
    default: return type;
  }
}

export function useClubEvents(clubId: string | undefined) {
  return useQuery({
    queryKey: ["nightclub-events", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("nightclub_events")
        .select("*")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("day_of_week", { ascending: true });
      if (error) throw error;
      return (data ?? []) as NightclubEvent[];
    },
    enabled: !!clubId,
  });
}

export function getTonightsEvent(
  events: NightclubEvent[],
  gameDate: NightclubGameDate | null | undefined,
): NightclubEvent | null {
  return currentNightclubEvent(events, gameDate);
}
