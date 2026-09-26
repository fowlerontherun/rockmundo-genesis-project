import { supabase } from "@/integrations/supabase/client";
import type { ScheduledActivity } from "@/hooks/useScheduledActivities";
import { festivalRoutes } from "@/features/festivals/routes";

/**
 * This projection is read-only. A confirmed Festival booking belongs in
 * every active band member's calendar even before a stage time is assigned.
 * We must not invent a gig, reserve another time slot or report a provisional
 * date as a confirmed performance time.
 */
export interface BandFestivalAppearance {
  bookingId: string;
  bandId: string;
  bandName: string;
  editionId: string;
  festivalCompanyId: string;
  festivalName: string;
  festivalSlug: string | null;
  festivalStatus: string;
  festivalStartsOn: string;
  festivalEndsOn: string;
  cityName: string | null;
  countryName: string | null;
  bookingStatus: string;
  billingPosition: string;
  setMinutes: number;
  festivalDate: string;
  confirmedStartAt: string | null;
  confirmedEndAt: string | null;
  stageName: string | null;
  timeConfirmed: boolean;
  sessionStatus: string | null;
}

type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value : "";
const nullableText = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;

export function parseBandFestivalAppearances(data: unknown): BandFestivalAppearance[] {
  if (!Array.isArray(data)) throw new Error("Invalid Festival appearance response");
  const bookings = new Set<string>();
  return data.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid Festival appearance");
    const row = item as Row;
    const bookingId = text(row.booking_id);
    const bandId = text(row.band_id);
    const editionId = text(row.edition_id);
    const festivalDate = text(row.festival_date);
    if (!bookingId || !bandId || !editionId || !/^\d{4}-\d{2}-\d{2}$/.test(festivalDate)) {
      throw new Error("Incomplete Festival appearance");
    }
    return {
      bookingId,
      bandId,
      bandName: text(row.band_name) || "Band",
      editionId,
      festivalCompanyId: text(row.festival_company_id),
      festivalName: text(row.festival_name) || "Festival",
      festivalSlug: nullableText(row.festival_slug),
      festivalStatus: text(row.festival_status),
      festivalStartsOn: text(row.festival_starts_on),
      festivalEndsOn: text(row.festival_ends_on),
      cityName: nullableText(row.city_name),
      countryName: nullableText(row.country_name),
      bookingStatus: text(row.booking_status),
      billingPosition: text(row.billing_position),
      setMinutes: Number(row.set_minutes) || 0,
      festivalDate,
      confirmedStartAt: nullableText(row.confirmed_start_at),
      confirmedEndAt: nullableText(row.confirmed_end_at),
      stageName: nullableText(row.stage_name),
      timeConfirmed: row.time_confirmed === true,
      sessionStatus: nullableText(row.session_status),
    };
  }).filter((appearance) => {
    if (bookings.has(appearance.bookingId)) return false;
    bookings.add(appearance.bookingId);
    return true;
  });
}

export async function fetchMyBandFestivalAppearances(): Promise<BandFestivalAppearance[]> {
  const { data, error } = await (supabase as any).rpc("get_my_band_festival_appearances");
  if (error) throw new Error(error.message || "Could not load band Festival appearances");
  return parseBandFestivalAppearances(data);
}

/** Festival date is a venue-local calendar date; avoid UTC parsing shifts. */
export function localFestivalDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export function appearanceOnLocalDay(appearance: BandFestivalAppearance, date: Date): boolean {
  const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
  return appearance.festivalDate === key;
}

export function appearanceDetailHref(appearance: BandFestivalAppearance): string {
  return festivalRoutes.publicEdition(
    appearance.festivalSlug || appearance.festivalCompanyId,
    appearance.editionId,
  );
}

export function isFutureFestivalAppearance(appearance: BandFestivalAppearance, today = new Date()): boolean {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return localFestivalDate(appearance.festivalDate).getTime() >= midnight;
}

export function festivalAppearanceAsActivity(
  appearance: BandFestivalAppearance,
  userId: string,
  profileId: string,
): ScheduledActivity {
  const start = appearance.timeConfirmed && appearance.confirmedStartAt
    ? new Date(appearance.confirmedStartAt)
    : localFestivalDate(appearance.festivalDate);
  const end = appearance.timeConfirmed && appearance.confirmedEndAt
    ? new Date(appearance.confirmedEndAt)
    : new Date(start.getTime() + 60 * 1000);

  const status: ScheduledActivity["status"] =
    appearance.sessionStatus === "completed" || appearance.festivalStatus === "completed" ? "completed"
      : appearance.sessionStatus === "in_progress" ? "in_progress" : "scheduled";

  return {
    id: `festival_${appearance.bookingId}`,
    user_id: userId,
    profile_id: profileId,
    activity_type: "festival_performance",
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    status,
    title: `Festival: ${appearance.festivalName}`,
    description: [
      appearance.bandName,
      appearance.stageName || "Stage to be announced",
      appearance.timeConfirmed ? null : "Set time to be announced",
    ].filter(Boolean).join(" · "),
    location: [appearance.cityName, appearance.countryName].filter(Boolean).join(", "),
    metadata: {
      auto_scheduled: true,
      is_festival_performance: true,
      festival_booking_id: appearance.bookingId,
      festival_edition_id: appearance.editionId,
      festival_company_id: appearance.festivalCompanyId,
      festival_slug: appearance.festivalSlug,
      festival_date: appearance.festivalDate,
      band_id: appearance.bandId,
      billing_position: appearance.billingPosition,
      stage_name: appearance.stageName,
      date_only: !appearance.timeConfirmed,
      detail_href: appearanceDetailHref(appearance),
    },
  };
}

export const FESTIVAL_APPEARANCE_HIGHLIGHT =
  "border-fuchsia-400/70 bg-gradient-to-r from-fuchsia-500/15 via-violet-500/10 to-fuchsia-500/5 " +
  "ring-1 ring-fuchsia-400/30 shadow-[0_0_24px_rgba(217,70,239,0.22)] " +
  "dark:border-fuchsia-400/65 dark:shadow-[0_0_30px_rgba(217,70,239,0.20)]";
