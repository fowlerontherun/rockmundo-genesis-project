import type { Database } from "@/integrations/supabase/types";
import type { FestivalEditionStatus } from "./lifecycle";
export type { FestivalEditionStatus };

export type FestivalBrand = Database["public"]["Tables"]["festivals"]["Row"];

export type FestivalEdition = Database["public"]["Tables"] extends {
  festival_editions: { Row: infer Row };
}
  ? Row
  : {
      id: string;
      festival_id: string;
      edition_number: number;
      edition_year: number | null;
      title: string | null;
      status: FestivalEditionStatus;
      start_at: string | null;
      end_at: string | null;
      city_id: string | null;
      venue_id: string | null;
      expected_attendance: number | null;
      capacity: number | null;
    };

export type FestivalEditionLifecycleEvent =
  Database["public"]["Tables"] extends {
    festival_edition_lifecycle_events: { Row: infer Row };
  }
    ? Row
    : {
        id: string;
        edition_id: string;
        from_status: FestivalEditionStatus | null;
        to_status: FestivalEditionStatus;
        actor_profile_id: string | null;
        reason: string | null;
        created_at: string;
      };

export type FestivalLegacyMapping = Database["public"]["Tables"] extends {
  festival_legacy_mappings: { Row: infer Row };
}
  ? Row
  : {
      id: string;
      edition_id: string;
      legacy_source:
        | "game_event"
        | "dedicated_festival_row"
        | "festival_lineup_source";
      legacy_id: string;
      legacy_festival_id: string | null;
      created_at: string;
    };

export type FestivalLegacySource = FestivalLegacyMapping["legacy_source"];
