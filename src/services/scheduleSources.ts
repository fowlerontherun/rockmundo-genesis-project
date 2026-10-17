import { supabase } from "@/integrations/supabase/client";
import type { CharacterTravelRow, UniversityClassRow } from "@/utils/scheduleVisibility";

/** Character-scoped travel includes all booking paths, not just band tour legs. */
export async function fetchCharacterTravelForDay(
  profileId: string, dayStart: Date, dayEnd: Date,
): Promise<CharacterTravelRow[]> {
  const { data, error } = await (supabase as any)
    .from("player_travel_history")
    .select("id,profile_id,status,departure_time,scheduled_departure_time,arrival_time,transport_type,tour_leg_id,from_city:from_city_id(name),to_city:to_city_id(name)")
    .eq("profile_id", profileId)
    .in("status", ["scheduled", "in_progress", "completed"])
    .gt("arrival_time", dayStart.toISOString())
    .or(`departure_time.lt.${dayEnd.toISOString()},scheduled_departure_time.lt.${dayEnd.toISOString()}`);
  if (error) throw error;
  return (data ?? []) as CharacterTravelRow[];
}

/** Real recurring university class hours are attached to active enrolments. */
export async function fetchEnrolledUniversityClasses(profileId: string): Promise<{
  enrollments: UniversityClassRow[];
  campusTimeZones: Record<string, string>;
}> {
  const { data, error } = await (supabase as any)
    .from("player_university_enrollments")
    .select("id,status,enrolled_at,scheduled_end_date,university_courses(name,class_start_hour,class_end_hour),universities(name,city)")
    .eq("profile_id", profileId)
    .in("status", ["enrolled", "in_progress"]);
  if (error) throw error;
  const enrollments = (data ?? []) as UniversityClassRow[];
  const cities = [...new Set(enrollments.map((row) => row.universities?.city).filter((city): city is string => !!city))];
  const campusTimeZones: Record<string, string> = {};
  if (cities.length) {
    const { data: timeZones, error: cityError } = await supabase
      .from("cities").select("name,timezone").in("name", cities);
    // The calendar remains useful if the optional city-timezone lookup fails.
    if (cityError) console.warn("[schedule] campus timezone unavailable", cityError);
    else for (const city of timeZones ?? []) {
      if (city.name && city.timezone) campusTimeZones[city.name] = city.timezone;
    }
  }
  return { enrollments, campusTimeZones };
}
