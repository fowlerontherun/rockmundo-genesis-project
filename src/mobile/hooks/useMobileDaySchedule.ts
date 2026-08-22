import { useQuery } from "@tanstack/react-query";
import { addDays, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { ScheduledActivity } from "@/hooks/useScheduledActivities";
import { withoutDuplicateBandScheduleActivities } from "@/utils/bandActivityScheduling";

export type MobileScheduleSource =
  | "core schedule"
  | "work"
  | "band membership"
  | "gigs"
  | "rehearsals"
  | "recordings"
  | "tour travel"
  | "releases";

interface MobileDaySchedulePayload {
  activities: ScheduledActivity[];
  warnings: MobileScheduleSource[];
  coreScheduleAvailable: boolean;
}

const STATUS_VALUES = ["scheduled", "in_progress", "completed", "confirmed"];

export function mobileLocalDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function activityOverlapsWindow(
  startValue: string | null | undefined,
  endValue: string | null | undefined,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  if (!startValue || !endValue) return false;
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  return Number.isFinite(start)
    && Number.isFinite(end)
    && start < windowEnd.getTime()
    && end > windowStart.getTime();
}

function statusFor(value: unknown): ScheduledActivity["status"] {
  if (value === "active" || value === "in_progress") return "in_progress";
  if (value === "completed") return "completed";
  if (value === "cancelled") return "cancelled";
  if (value === "missed") return "missed";
  return "scheduled";
}

function sourceWarningMessage(source: MobileScheduleSource): MobileScheduleSource {
  return source;
}

function dedupeKey(activity: ScheduledActivity): string {
  if (activity.linked_gig_id) return `gig:${activity.linked_gig_id}`;
  if (activity.linked_rehearsal_id) return `rehearsal:${activity.linked_rehearsal_id}`;
  if (activity.linked_recording_id) return `recording:${activity.linked_recording_id}`;
  if (activity.linked_job_shift_id) return `work:${activity.linked_job_shift_id}`;
  if (activity.activity_type === "release_manufacturing" && activity.metadata?.release_id) {
    return `release:${activity.metadata.release_id}`;
  }
  if (activity.activity_type === "travel" && activity.metadata?.tour_travel_leg_id) {
    return `tour-travel:${activity.metadata.tour_travel_leg_id}`;
  }
  return `${activity.activity_type}:${activity.id}`;
}

export function useMobileDaySchedule(
  date: Date,
  userId?: string | null,
  profileId?: string | null,
) {
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);
  const dayStartIso = dayStart.toISOString();
  const dayEndIso = dayEnd.toISOString();
  const dateKey = mobileLocalDateKey(date);

  const query = useQuery({
    queryKey: ["mobile-day-schedule", profileId, dateKey],
    enabled: Boolean(userId && profileId),
    staleTime: 30_000,
    queryFn: async (): Promise<MobileDaySchedulePayload> => {
      if (!userId || !profileId) {
        return { activities: [], warnings: [], coreScheduleAvailable: false };
      }

      const warnings: MobileScheduleSource[] = [];
      const safe = async <T,>(
        source: MobileScheduleSource,
        promise: PromiseLike<{ data: T | null; error: any }>,
        fallback: T,
      ): Promise<T> => {
        try {
          const { data, error } = await promise;
          if (error) {
            console.warn(`[RockMundo mobile day] ${source} unavailable`, error);
            warnings.push(sourceWarningMessage(source));
            return fallback;
          }
          return data ?? fallback;
        } catch (error) {
          console.warn(`[RockMundo mobile day] ${source} unavailable`, error);
          warnings.push(sourceWarningMessage(source));
          return fallback;
        }
      };

      const canonical = await safe<any[]>(
        "core schedule",
        (supabase as any)
          .from("player_scheduled_activities")
          .select("*")
          .eq("profile_id", profileId)
          .lt("scheduled_start", dayEndIso)
          .gt("scheduled_end", dayStartIso)
          .in("status", ["scheduled", "in_progress", "completed"])
          .order("scheduled_start", { ascending: true }),
        [],
      );

      const workRows = await safe<any[]>(
        "work",
        (supabase as any)
          .from("profile_activity_statuses")
          .select("*, metadata")
          .eq("profile_id", profileId)
          .eq("activity_type", "work_shift")
          .lt("started_at", dayEndIso)
          .gt("ends_at", dayStartIso),
        [],
      );

      const membershipRows = await safe<any[]>(
        "band membership",
        (supabase as any)
          .from("band_members")
          .select("band_id")
          .eq("profile_id", profileId)
          .eq("member_status", "active"),
        [],
      );
      const bandIds = Array.from(new Set(membershipRows.map((row) => row.band_id).filter(Boolean))) as string[];

      const gigStart = new Date(dayStart.getTime() - (6 * 60 * 60 * 1000));
      const gigsPromise = bandIds.length
        ? (supabase as any)
            .from("gigs")
            .select("*, venues:venues!gigs_venue_id_fkey(name, city_id, cities:city_id(name)), tours:tours!gigs_tour_id_fkey(name)")
            .in("band_id", bandIds)
            .gte("scheduled_date", gigStart.toISOString())
            .lt("scheduled_date", dayEndIso)
            .in("status", STATUS_VALUES)
        : Promise.resolve({ data: [], error: null });

      const rehearsalsPromise = bandIds.length
        ? (supabase as any)
            .from("band_rehearsals")
            .select("*, rehearsal_rooms(name, location), bands:band_id(name)")
            .in("band_id", bandIds)
            .lt("scheduled_start", dayEndIso)
            .gt("scheduled_end", dayStartIso)
            .in("status", ["scheduled", "in_progress", "completed"])
        : Promise.resolve({ data: [], error: null });

      const tourTravelPromise = bandIds.length
        ? (supabase as any)
            .from("tour_travel_legs")
            .select("*, from_city:from_city_id(name), to_city:to_city_id(name), tours!inner(band_id, name, status)")
            .lt("departure_date", dayEndIso)
            .gt("arrival_date", dayStartIso)
            .neq("status", "cancelled")
        : Promise.resolve({ data: [], error: null });

      const releasesPromise = bandIds.length
        ? (supabase as any)
            .from("releases")
            .select("*, bands(name)")
            .in("band_id", bandIds)
            .eq("release_status", "manufacturing")
            .gte("manufacturing_complete_at", dayStartIso)
            .lt("manufacturing_complete_at", dayEndIso)
        : Promise.resolve({ data: [], error: null });

      const profileRecordingsPromise = (supabase as any)
        .from("recording_sessions")
        .select("id,user_id,profile_id,band_id,scheduled_start,scheduled_end,status,city_studios(name),songs:song_id(title)")
        .eq("profile_id", profileId)
        .lt("scheduled_start", dayEndIso)
        .gt("scheduled_end", dayStartIso)
        .in("status", ["scheduled", "in_progress", "completed"]);

      const legacyRecordingsPromise = (supabase as any)
        .from("recording_sessions")
        .select("id,user_id,profile_id,band_id,scheduled_start,scheduled_end,status,city_studios(name),songs:song_id(title)")
        .eq("user_id", userId)
        .is("profile_id", null)
        .lt("scheduled_start", dayEndIso)
        .gt("scheduled_end", dayStartIso)
        .in("status", ["scheduled", "in_progress", "completed"]);

      const bandRecordingsPromise = bandIds.length
        ? (supabase as any)
            .from("recording_sessions")
            .select("id,user_id,profile_id,band_id,scheduled_start,scheduled_end,status,city_studios(name),songs:song_id(title)")
            .in("band_id", bandIds)
            .lt("scheduled_start", dayEndIso)
            .gt("scheduled_end", dayStartIso)
            .in("status", ["scheduled", "in_progress", "completed"])
        : Promise.resolve({ data: [], error: null });

      const [gigs, rehearsals, tourTravelRows, releaseRows, profileRecordings, legacyRecordings, bandRecordings] = await Promise.all([
        safe<any[]>("gigs", gigsPromise, []),
        safe<any[]>("rehearsals", rehearsalsPromise, []),
        safe<any[]>("tour travel", tourTravelPromise, []),
        safe<any[]>("releases", releasesPromise, []),
        safe<any[]>("recordings", profileRecordingsPromise, []),
        safe<any[]>("recordings", legacyRecordingsPromise, []),
        safe<any[]>("recordings", bandRecordingsPromise, []),
      ]);

      const recordingMap = new Map<string, any>();
      for (const row of [...profileRecordings, ...legacyRecordings, ...bandRecordings]) {
        if (row?.id) recordingMap.set(row.id, row);
      }

      const externalActivities: ScheduledActivity[] = [
        ...workRows
          .filter((shift) => !["cancelled", "missed"].includes(String(shift.status ?? "").toLowerCase()))
          .map((shift): ScheduledActivity => ({
            id: `work_${shift.id}`,
            user_id: userId,
            profile_id: profileId,
            activity_type: "work",
            scheduled_start: shift.started_at,
            scheduled_end: shift.ends_at,
            status: statusFor(shift.status),
            title: `Work: ${shift.metadata?.job_title || "Job"}`,
            description: shift.metadata?.company_name ? `Working at ${shift.metadata.company_name}` : undefined,
            linked_job_shift_id: shift.metadata?.shift_history_id ?? null,
            metadata: { ...shift.metadata, auto_scheduled: true, from_activity_status: true, activity_status_id: shift.id },
          })),
        ...gigs.map((gig): ScheduledActivity => {
          const starts = new Date(gig.scheduled_date);
          const ends = new Date(starts.getTime() + (4 * 60 * 60 * 1000));
          return {
            id: `gig_${gig.id}`,
            user_id: userId,
            profile_id: profileId,
            activity_type: "gig",
            scheduled_start: gig.scheduled_date,
            scheduled_end: ends.toISOString(),
            status: statusFor(gig.status),
            title: gig.tour_id ? `Tour Gig: ${gig.venues?.name ?? "Venue"}` : `Gig: ${gig.venues?.name ?? "Venue"}`,
            location: gig.venues?.cities?.name,
            linked_gig_id: gig.id,
            metadata: gig.tour_id ? { tour_id: gig.tour_id, tour_name: gig.tours?.name } : undefined,
          };
        }),
        ...rehearsals.map((rehearsal): ScheduledActivity => ({
          id: `rehearsal_${rehearsal.id}`,
          user_id: userId,
          profile_id: profileId,
          activity_type: "rehearsal",
          scheduled_start: rehearsal.scheduled_start,
          scheduled_end: rehearsal.scheduled_end,
          status: statusFor(rehearsal.status),
          title: `Rehearsal: ${rehearsal.bands?.name || "Band"}`,
          location: rehearsal.rehearsal_rooms?.location || rehearsal.rehearsal_rooms?.name,
          linked_rehearsal_id: rehearsal.id,
        })),
        ...Array.from(recordingMap.values()).map((session): ScheduledActivity => ({
          id: `recording_${session.id}`,
          user_id: userId,
          profile_id: profileId,
          activity_type: "recording",
          scheduled_start: session.scheduled_start,
          scheduled_end: session.scheduled_end,
          status: statusFor(session.status),
          title: `Recording: ${session.songs?.title || "Studio session"}`,
          location: session.city_studios?.name,
          linked_recording_id: session.id,
        })),
        ...tourTravelRows
          .filter((leg) => bandIds.includes(leg.tours?.band_id) && leg.tours?.status !== "cancelled")
          .map((leg): ScheduledActivity => ({
            id: `tour_travel_${leg.id}`,
            user_id: userId,
            profile_id: profileId,
            activity_type: "travel",
            scheduled_start: leg.departure_date,
            scheduled_end: leg.arrival_date,
            status: statusFor(leg.status),
            title: `Tour Travel: ${leg.from_city?.name ?? "Departure"} → ${leg.to_city?.name ?? "Destination"}`,
            location: leg.travel_mode,
            metadata: { tour_travel_leg: true, tour_travel_leg_id: leg.id, tour_name: leg.tours?.name },
          })),
        ...releaseRows.map((release): ScheduledActivity => {
          const starts = new Date(release.manufacturing_complete_at);
          return {
            id: `release_${release.id}`,
            user_id: userId,
            profile_id: profileId,
            activity_type: "release_manufacturing",
            scheduled_start: starts.toISOString(),
            scheduled_end: new Date(starts.getTime() + (60 * 60 * 1000)).toISOString(),
            status: "scheduled",
            title: `Release Ready: ${release.title}`,
            description: `${release.bands?.name ?? "Band"} — ${release.release_type ?? "release"}`,
            metadata: { auto_scheduled: true, release_id: release.id, release_type: release.release_type },
          };
        }),
      ];

      const allActivities = [...(canonical as ScheduledActivity[]), ...externalActivities]
        .filter((activity) => activityOverlapsWindow(activity.scheduled_start, activity.scheduled_end, dayStart, dayEnd));

      const deduped = withoutDuplicateBandScheduleActivities(allActivities);
      const seen = new Set<string>();
      const unique = deduped.filter((activity) => {
        const key = dedupeKey(activity);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return {
        activities: unique.sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()),
        warnings: Array.from(new Set(warnings)),
        coreScheduleAvailable: !warnings.includes("core schedule"),
      };
    },
  });

  return {
    ...query,
    data: query.data?.activities ?? [],
    warnings: query.data?.warnings ?? [],
    coreScheduleAvailable: query.data?.coreScheduleAvailable ?? true,
  };
}
