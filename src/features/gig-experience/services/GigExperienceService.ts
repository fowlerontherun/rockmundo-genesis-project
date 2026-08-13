import { supabase } from "@/integrations/supabase/client";
import { getPerformanceGrade } from "@/utils/gigPerformanceCalculator";
import { EMPTY_GEAR_EFFECTS, type GearModifierEffects } from "@/utils/gearModifiers";
import type { Database } from "@/lib/supabase-types";
import type { GigExperienceDTO, GigExperienceValidationError, GigPostConsequencesDTO } from "../types";
import { resolveSongAudioDescriptor } from "../viewer/audio/audioSourceResolver";
import { metricAvailable, metricLegacyMissing, metricNotApplicable, nullableNumberMetric, metricValue } from "../reportMetric";
import {
  createGigExperienceLoadError,
  isMissingResultReadyAtError,
  logGigExperienceFallback,
  logGigExperienceSuccess,
  type GigExperienceDiagnosticStage,
  type GigExperienceFailure,
} from "../diagnostics";

type GigRow = Database["public"]["Tables"]["gigs"]["Row"] & {
  result_ready_at?: string | null;
  venues?: Database["public"]["Tables"]["venues"]["Row"] | null;
};
type CityRow = Pick<
  Database["public"]["Tables"]["cities"]["Row"],
  "id" | "name" | "country" | "region" | "climate_type" | "is_coastal" | "timezone"
>;
type OutcomeRow = Database["public"]["Tables"]["gig_outcomes"]["Row"];
type SongPerfDatabaseRow = Database["public"]["Tables"]["gig_song_performances"]["Row"];
type SongPerfRow = Omit<SongPerfDatabaseRow, "song_id"> & { song_id: string | null };
type SetlistSongRow = {
  song_id: string | null;
  performance_item_id?: string | null;
  item_type?: string | null;
  position: number;
  songs?: { id: string; title: string | null; genre?: string | null; quality_score?: number | null; audio_url?: string | null; extended_audio_url?: string | null; audio_generation_status?: string | null; duration_seconds?: number | null } | null;
  performance_items_catalog?: { id: string; name: string; item_category: string; required_skill?: string | null; duration_seconds?: number | null } | null;
};
type GigSetlistRow = { gig_setlist_items?: SetlistSongRow[] | null };
type PerformerRow = { id: string; profile_id: string; role_or_instrument: string | null; lineup_status: string | null; profiles?: { display_name?: string | null; username?: string | null } | null };
type BandMemberRow = { id: string; profile_id: string; instrument_role?: string | null; role?: string | null; member_status?: string | null; profiles?: { display_name?: string | null; username?: string | null } | null };
type ConsequenceRow = {
  consequence_key: string;
  category: string;
  target_type: string;
  target_id?: string | null;
  previous_value?: number | null;
  delta_value?: number | null;
  new_value?: number | null;
  status: GigPostConsequencesDTO["consequences"][number]["status"];
  explanation: string;
  source_factors?: string[] | null;
};

const outcomeSelect = "id,gig_id,band_id,venue_id,venue_name,venue_capacity,completed_at,created_at,overall_rating,performance_grade,actual_attendance,attendance_percentage,ticket_revenue,merch_revenue,total_revenue,crew_cost,equipment_cost,venue_cost,total_costs,net_profit,fame_gained,new_followers,casual_fans_gained,dedicated_fans_gained,superfans_gained,fan_conversions,chemistry_change,total_xp_awarded,equipment_quality_avg,crew_skill_avg,band_chemistry_level,member_skill_avg,merch_items_sold,crowd_energy_peak,stage_behavior_used,band_synergy_modifier,social_buzz_impact,audience_memory_impact,promoter_modifier,venue_loyalty_bonus,highlight_moments,xp_breakdown";
const gigSelect = "id,band_id,venue_id,setlist_id,status,scheduled_date,started_at,completed_at,result_ready_at,ticket_price,venues!gigs_venue_id_fkey(id,name,location,capacity,venue_type,city_id)";
const legacyGigSelect = "id,band_id,venue_id,setlist_id,status,scheduled_date,started_at,completed_at,ticket_price,venues!gigs_venue_id_fkey(id,name,location,capacity,venue_type,city_id)";
const songPerformanceSelect = "id,song_id,performance_item_id,position,performance_score,crowd_response,song_quality_contrib,rehearsal_contrib,chemistry_contrib,equipment_contrib,crew_contrib,member_skill_contrib,song_title,performance_item_name,item_type";

type QueryResult<T> = { data: T | null; error: unknown };
interface GigExperienceQueryBuilder extends PromiseLike<QueryResult<unknown>> {
  select(columns: string): GigExperienceQueryBuilder;
  eq(column: string, value: unknown): GigExperienceQueryBuilder;
  order(column: string, options?: Record<string, unknown>): GigExperienceQueryBuilder;
  limit(value: number): GigExperienceQueryBuilder;
  maybeSingle(): Promise<QueryResult<unknown>>;
}
type GigExperienceClient = { from(table: string): GigExperienceQueryBuilder };

function compatibilityWarning(failure: GigExperienceFailure) {
  const code = failure.code ?? "unknown";
  return `Viewer compatibility fallback used for ${failure.stage.replace(/_/g, " ")} (${code}).`;
}

function setlistItemIdentity(row: SetlistSongRow) {
  if (row.item_type === "performance_item" || row.performance_item_id) {
    return `performance_item:${row.performance_item_id ?? "unknown"}`;
  }
  return `song:${row.song_id ?? "unknown"}`;
}

function performanceIdentity(row: SongPerfRow) {
  if (row.item_type === "performance_item" || row.performance_item_id) {
    return `performance_item:${row.performance_item_id ?? row.performance_item_name ?? "unknown"}`;
  }
  return `song:${row.song_id ?? "unknown"}`;
}

export async function getGigExperience(gigId: string, client: unknown = supabase): Promise<GigExperienceDTO | null> {
  const queryClient = client as GigExperienceClient;
  const loadWarnings: string[] = [];
  const compatibilityFailures: GigExperienceFailure[] = [];
  let usedLegacyGigSchema = false;

  const loadGig = (select: string) => queryClient
    .from("gigs")
    .select(select)
    .eq("id", gigId)
    .maybeSingle();

  let gigResult = await loadGig(gigSelect) as QueryResult<GigRow>;
  if (gigResult.error && isMissingResultReadyAtError(gigResult.error)) {
    const failure = logGigExperienceFallback(
      gigId,
      "gig",
      "gigs.result_ready_at",
      gigResult.error,
      "retry gigs without result_ready_at and derive readiness only from completed outcome timestamps",
    );
    compatibilityFailures.push(failure);
    loadWarnings.push(compatibilityWarning(failure));
    usedLegacyGigSchema = true;
    gigResult = await loadGig(legacyGigSelect) as QueryResult<GigRow>;
  }
  if (gigResult.error) throw createGigExperienceLoadError(gigId, "gig", "gigs", gigResult.error);
  if (!gigResult.data) {
    throw createGigExperienceLoadError(gigId, "gig", "gigs", {
      code: "GIG_NOT_FOUND",
      message: "No readable gig row was returned for the requested identifier.",
    });
  }
  const gig = { ...gigResult.data, result_ready_at: gigResult.data.result_ready_at ?? null } as GigRow;

  // Historical completion paths did not always enforce one outcome per gig.
  // Read at most two in a deterministic order, use the newest authoritative
  // row, and log the duplicate instead of letting maybeSingle() fail the viewer.
  const outcomeResult = await queryClient
    .from("gig_outcomes")
    .select(outcomeSelect)
    .eq("gig_id", gigId)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(2) as QueryResult<OutcomeRow[]>;
  if (outcomeResult.error) throw createGigExperienceLoadError(gigId, "outcome", "gig_outcomes", outcomeResult.error);
  const outcomeRows = (outcomeResult.data ?? []) as OutcomeRow[];
  if (outcomeRows.length > 1) {
    const failure = logGigExperienceFallback(
      gigId,
      "outcome",
      "gig_outcomes",
      { code: "DUPLICATE_OUTCOME", message: "Multiple outcome rows were returned for one historical gig." },
      "use the newest completed outcome row",
    );
    compatibilityFailures.push(failure);
    loadWarnings.push(compatibilityWarning(failure));
  }
  const outcome = outcomeRows[0] ?? null;
  const outcomeId = outcome?.id ?? null;
  const [venueCityRes, songPerfsRes, gigSetlistRes, legacySetlistSongsRes, performersRes, replayDescriptorRes, processingRes, consequenceRes] = await Promise.all([
    gig.venues?.city_id
      ? queryClient.from("cities").select("id,name,country,region,climate_type,is_coastal,timezone").eq("id", gig.venues.city_id).maybeSingle()
      : Promise.resolve({ data: null as CityRow | null, error: null }),
    outcomeId
      ? queryClient.from("gig_song_performances").select(songPerformanceSelect).eq("gig_outcome_id", outcomeId).order("position")
      : Promise.resolve({ data: [] as SongPerfRow[], error: null }),
    queryClient
      .from("gig_setlists")
      .select("id,gig_setlist_items(song_id,position,songs(id,title,genre,quality_score,audio_url,extended_audio_url,audio_generation_status,duration_seconds))")
      .eq("gig_id", gigId)
      .maybeSingle(),
    gig?.setlist_id
      ? queryClient.from("setlist_songs").select("song_id,performance_item_id,item_type,position,songs(id,title,genre,quality_score,audio_url,extended_audio_url,audio_generation_status,duration_seconds),performance_items_catalog(id,name,item_category,required_skill,duration_seconds)").eq("setlist_id", gig.setlist_id).order("position")
      : Promise.resolve({ data: [] as SetlistSongRow[], error: null }),
    queryClient.from("gig_performers").select("id,profile_id,role_or_instrument,lineup_status,profiles:profiles!gig_performers_profile_id_fkey(display_name,username)").eq("gig_id", gigId).order("created_at", { ascending: true }),
    queryClient.from("gig_viewer_replays").select("viewer_version,duration_ms,generation_status").eq("gig_id", gigId).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    queryClient.from("gig_post_processing").select("status,processing_version,completed_at").eq("gig_id", gigId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    queryClient.from("gig_consequence_snapshots").select("category,target_type,target_id,consequence_key,previous_value,delta_value,new_value,status,explanation,source_factors,metadata,created_at").eq("gig_id", gigId).order("created_at", { ascending: true }),
  ]);

  const optionalData = <T,>(
    stage: GigExperienceDiagnosticStage,
    source: string,
    result: QueryResult<T>,
    fallback: T,
    fallbackDescription: string,
  ): T => {
    if (!result.error) return result.data ?? fallback;
    const failure = logGigExperienceFallback(gigId, stage, source, result.error, fallbackDescription);
    compatibilityFailures.push(failure);
    loadWarnings.push(compatibilityWarning(failure));
    return fallback;
  };

  const venueCity = optionalData(
    "venue_city",
    "cities",
    venueCityRes as QueryResult<CityRow | null>,
    null,
    "resolve the presentation from the venue location and deterministic generic environment",
  );
  const songPerformances = optionalData(
    "song_performances",
    "gig_song_performances",
    songPerfsRes as QueryResult<SongPerfRow[]>,
    [] as SongPerfRow[],
    "rebuild the presentation from a saved setlist without performance scores",
  );
  const gigSetlistData = optionalData(
    "gig_setlist",
    "gig_setlists/gig_setlist_items",
    gigSetlistRes as QueryResult<GigSetlistRow>,
    null as GigSetlistRow | null,
    "use the legacy band setlist or recorded song performance rows",
  );
  const legacySetlistSongs = optionalData(
    "legacy_setlist",
    "setlist_songs",
    legacySetlistSongsRes as QueryResult<SetlistSongRow[]>,
    [] as SetlistSongRow[],
    "use recorded song performance rows",
  );
  const performerRows = optionalData(
    "performers",
    "gig_performers",
    performersRes as QueryResult<PerformerRow[]>,
    [] as PerformerRow[],
    "use active band members for presentation-only performer positions",
  );
  const replayDescriptor = optionalData(
    "replay_descriptor",
    "gig_viewer_replays",
    replayDescriptorRes as QueryResult<{ viewer_version: number; duration_ms: number; generation_status: string }>,
    null as { viewer_version: number; duration_ms: number; generation_status: string } | null,
    "build a deterministic read-only presentation from canonical gig data",
  );
  const postProcessing = optionalData(
    "post_processing",
    "gig_post_processing",
    processingRes as QueryResult<{ status: string; processing_version: string | null; completed_at: string | null }>,
    null as { status: string; processing_version: string | null; completed_at: string | null } | null,
    "show legacy post-gig consequence status",
  );
  const consequences = optionalData(
    "consequences",
    "gig_consequence_snapshots",
    consequenceRes as QueryResult<ConsequenceRow[]>,
    [] as ConsequenceRow[],
    "omit unavailable post-gig consequence details",
  );

  // Lineup fallback: many gigs have no dedicated performer rows, so use the
  // band's active members so the viewer still shows who was on stage.
  let performers = performerRows;
  if (performers.length === 0 && gig?.band_id) {
    const membersResult = await queryClient
      .from("band_members")
      .select("id,profile_id,instrument_role,role,member_status,profiles:profiles!band_members_profile_id_fkey(display_name,username)")
      .eq("band_id", gig.band_id);
    const members = optionalData(
      "band_members",
      "band_members",
      membersResult as QueryResult<BandMemberRow[]>,
      [] as BandMemberRow[],
      "render the stage without performer markers",
    );
    performers = members
      .filter((row) => !row.member_status || row.member_status === "active")
      .map((row) => ({
        id: row.id,
        profile_id: row.profile_id,
        role_or_instrument: row.instrument_role ?? row.role ?? null,
        lineup_status: "confirmed",
        profiles: row.profiles ?? null,
      }));
  }

  const savedGigSetlist = (gigSetlistData?.gig_setlist_items ?? []) as SetlistSongRow[];
  // The server timeline still executes the assigned band setlist. If it has
  // performance items, use it as the presentation source so those actions are
  // not hidden by the song-only preparation snapshot.
  const legacyHasPerformanceItems = legacySetlistSongs.some((row) => row.item_type === "performance_item" || !!row.performance_item_id);
  const setlistSongs = legacyHasPerformanceItems
    ? legacySetlistSongs
    : savedGigSetlist.length > 0
    ? [...savedGigSetlist].sort((a, b) => a.position - b.position)
    : legacySetlistSongs;

  try {
    const experience = mapGigExperience({
      gig,
      outcome,
      venueCity,
      songPerformances,
      setlistSongs,
      performers,
      replayDescriptor,
      postProcessing,
      consequences,
      loadWarnings,
    });
    logGigExperienceSuccess({
      gigId,
      status: gig.status,
      outcomeId: outcome?.id ?? null,
      usedLegacyGigSchema,
      setlistSource: legacyHasPerformanceItems ? "setlist_songs" : savedGigSetlist.length > 0 ? "gig_setlists" : legacySetlistSongs.length > 0 ? "setlist_songs" : songPerformances.length > 0 ? "song_performances" : "none",
      songCount: experience.songs.length,
      performerCount: experience.performers.length,
      replayAvailable: experience.viewer.replayAvailable,
      compatibilityReferences: compatibilityFailures.map((failure) => failure.reference),
    });
    return experience;
  } catch (error) {
    throw createGigExperienceLoadError(gigId, "mapping", "GigExperienceDTO", error);
  }
}

export function mapGigExperience(input: { gig: GigRow; outcome: OutcomeRow | null; venueCity?: CityRow | null; songPerformances?: SongPerfRow[]; setlistSongs?: SetlistSongRow[]; performers?: PerformerRow[]; replayDescriptor?: { viewer_version: number; duration_ms: number; generation_status: string } | null; postProcessing?: { status: string; processing_version: string | null; completed_at: string | null } | null; consequences?: ConsequenceRow[]; loadWarnings?: string[] }): GigExperienceDTO {
  const { gig, outcome } = input;
  const venue = gig.venues;
  const venueCity = venue?.city_id && input.venueCity?.id === venue.city_id ? input.venueCity : null;
  // Capacity must never be lower than recorded attendance, otherwise the DTO
  // validator rejects otherwise-valid historic outcomes.
  const capacity = Math.max(venue?.capacity ?? 0, outcome?.venue_capacity ?? 0, outcome?.actual_attendance ?? 0);
  const setlistTitles = new Map((input.setlistSongs ?? []).map((row) => [setlistItemIdentity(row), row.songs?.title ?? row.performance_items_catalog?.name ?? "Unknown Setlist Item"]));
  const setlistAudio = new Map((input.setlistSongs ?? []).filter((row) => !!row.song_id).map((row) => [row.song_id!, resolveSongAudioDescriptor(row.songs, "allowed")]));
  // Some historic gigs stored each setlist slot twice (a double-insert during
  // simulation). Collapse duplicates by slot so the viewer shows one entry per
  // song instead of failing DTO validation with "duplicate position".
  const performanceBySlot = new Map<string, SongPerfRow>();
  for (const row of input.songPerformances ?? []) {
    const key = `${row.position}::${performanceIdentity(row)}`;
    const existing = performanceBySlot.get(key);
    if (!existing) {
      performanceBySlot.set(key, row);
      continue;
    }
    const existingScore = Number(existing.performance_score ?? -Infinity);
    const candidateScore = Number(row.performance_score ?? -Infinity);
    if (candidateScore > existingScore) performanceBySlot.set(key, row);
  }
  const seenPositions = new Set<number>();
  const songPerformances = [...performanceBySlot.values()]
    .sort((a, b) => a.position - b.position)
    .filter((row) => (seenPositions.has(row.position) ? false : (seenPositions.add(row.position), true)));
  const positionOffset = songPerformances.some((row) => row.position === 0) ? 1 : 0;
  const unmatchedPerformances = new Set(songPerformances);
  const songSources = (input.setlistSongs ?? []).map((setlistRow) => {
    const performance = songPerformances.find((row) => performanceIdentity(row) === setlistItemIdentity(setlistRow))
      ?? songPerformances.find((row) => row.position + positionOffset === setlistRow.position)
      ?? null;
    if (performance) unmatchedPerformances.delete(performance);
    return { position: setlistRow.position, setlistRow, performance };
  });
  unmatchedPerformances.forEach((performance) => {
    songSources.push({ position: performance.position + positionOffset, setlistRow: null, performance });
  });

  // Older setlist imports can also contain conflicting positions. Prefer the
  // row with an authoritative performance result, then keep one stable slot so
  // a historical data defect does not crash the presentation boundary.
  const sourcesByPosition = new Map<number, typeof songSources[number]>();
  for (const source of songSources.sort((a, b) => a.position - b.position)) {
    const existing = sourcesByPosition.get(source.position);
    if (!existing || (!existing.performance && source.performance)) {
      sourcesByPosition.set(source.position, source);
    }
  }
  const duplicateSongPositionCount = songSources.length - sourcesByPosition.size;

  const songs: GigExperienceDTO["songs"] = [...sourcesByPosition.values()]
    .map(({ position, setlistRow, performance }) => {
      const itemType = performance?.item_type === "performance_item" || setlistRow?.item_type === "performance_item" || !!(performance?.performance_item_id ?? setlistRow?.performance_item_id)
        ? "performance_item" as const
        : "song" as const;
      const performanceItemId = performance?.performance_item_id ?? setlistRow?.performance_item_id ?? null;
      const identity = performance ? performanceIdentity(performance) : setlistRow ? setlistItemIdentity(setlistRow) : `position:${position}`;
      return {
        id: performance?.id ?? `gig-setlist-${identity}`,
        songId: performance?.song_id ?? setlistRow?.song_id ?? null,
        itemType,
        performanceItemId,
        performanceItemCategory: setlistRow?.performance_items_catalog?.item_category ?? null,
        performanceItemRequiredSkill: setlistRow?.performance_items_catalog?.required_skill ?? null,
        position,
        title: performance?.song_title
          ?? setlistTitles.get(identity)
          ?? setlistRow?.songs?.title
          ?? setlistRow?.performance_items_catalog?.name
          ?? performance?.performance_item_name
          ?? "Unknown Setlist Item",
        audio: itemType === "performance_item"
          ? resolveSongAudioDescriptor(null, "allowed")
          : performance?.song_id
            ? setlistAudio.get(performance.song_id)
            : setlistRow?.song_id
              ? setlistAudio.get(setlistRow.song_id)
              : resolveSongAudioDescriptor(null, "allowed"),
        performanceScore: performance
          ? nullableNumberMetric(performance.performance_score, "Setlist item score missing from legacy performance row")
          : metricLegacyMissing<number>("Performance result is not ready"),
        crowdResponse: performance?.crowd_response
          ? metricAvailable<string>(String(performance.crowd_response))
          : metricLegacyMissing<string>(performance ? "Crowd response missing from legacy performance row" : "Performance result is not ready"),
        contributions: {
          songQuality: performance ? nullableNumberMetric(performance.song_quality_contrib, "Song quality contribution missing from legacy row") : metricLegacyMissing<number>("Performance result is not ready"),
          rehearsal: performance ? nullableNumberMetric(performance.rehearsal_contrib, "Rehearsal contribution missing from legacy row") : metricLegacyMissing<number>("Performance result is not ready"),
          chemistry: performance ? nullableNumberMetric(performance.chemistry_contrib, "Chemistry contribution missing from legacy row") : metricLegacyMissing<number>("Performance result is not ready"),
          equipment: performance ? nullableNumberMetric(performance.equipment_contrib, "Equipment contribution missing from legacy row") : metricLegacyMissing<number>("Performance result is not ready"),
          crew: performance ? nullableNumberMetric(performance.crew_contrib, "Crew contribution missing from legacy row") : metricLegacyMissing<number>("Performance result is not ready"),
          memberSkill: performance ? nullableNumberMetric(performance.member_skill_contrib, "Member skill contribution missing from legacy row") : metricLegacyMissing<number>("Performance result is not ready"),
        },
      };
    });
  const performerByProfile = new Map<string, PerformerRow>();
  for (const performer of input.performers ?? []) {
    if (!performer.profile_id) continue;
    const existing = performerByProfile.get(performer.profile_id);
    if (!existing || (existing.lineup_status !== "performed" && performer.lineup_status === "performed")) {
      performerByProfile.set(performer.profile_id, performer);
    }
  }
  const normalizedPerformers = [...performerByProfile.values()];
  const duplicatePerformerCount = (input.performers?.length ?? 0) - normalizedPerformers.length;
  const bestSong = songs
    .filter((song) => song.itemType !== "performance_item" && song.performanceScore.status === "available")
    .reduce<typeof songs[number] | null>((best, song) => !best || metricValue(song.performanceScore, -Infinity) > metricValue(best.performanceScore, -Infinity) ? song : best, null);
  const fans = (outcome?.new_followers ?? outcome?.casual_fans_gained ?? null) !== null
    ? metricAvailable((outcome?.new_followers ?? 0) + (outcome?.casual_fans_gained ?? 0) + (outcome?.dedicated_fans_gained ?? 0) + (outcome?.superfans_gained ?? 0))
    : metricLegacyMissing<number>("Fan-gain columns are absent on this legacy outcome");
  const rating = outcome ? nullableNumberMetric(outcome.overall_rating, "Overall rating is still processing") : metricLegacyMissing<number>("No outcome row exists yet");
  const dto: GigExperienceDTO = {
    schemaVersion: 1,
    gig: {
      id: gig.id,
      bandId: gig.band_id,
      status: gig.status,
      scheduledDate: gig.scheduled_date,
      startedAt: gig.started_at,
      completedAt: gig.completed_at,
      ticketPrice: nullableNumberMetric(gig.ticket_price, "Ticket price missing"),
      venue: {
        id: venue?.id ?? outcome?.venue_id ?? null,
        name: venue?.name ?? outcome?.venue_name ?? "Unknown Venue",
        location: venue?.location ?? venueCity?.name ?? null,
        capacity,
        type: venue?.venue_type ?? null,
        city: venue?.city_id
          ? {
              id: venue.city_id,
              name: venueCity?.name ?? null,
              country: venueCity?.country ?? null,
              region: venueCity?.region ?? null,
              climateType: venueCity?.climate_type ?? null,
              isCoastal: venueCity?.is_coastal ?? null,
              timezone: venueCity?.timezone ?? null,
            }
          : null,
      },
    },
    headline: { overallRating: rating, performanceGrade: outcome?.performance_grade ? metricAvailable(outcome.performance_grade) : rating.status === "available" ? metricAvailable(getPerformanceGrade(rating.value).grade, "derived") : metricLegacyMissing("Grade unavailable until rating exists"), verdict: buildVerdict(metricValue(rating, 0)), attendance: outcome ? nullableNumberMetric(outcome.actual_attendance, "Attendance missing from outcome") : metricLegacyMissing("Outcome is not ready"), capacity: capacity > 0 ? metricAvailable(capacity) : metricLegacyMissing("Venue capacity missing"), netProfit: outcome ? nullableNumberMetric(outcome.net_profit, "Net profit missing from outcome") : metricLegacyMissing("Outcome is not ready"), fameGained: outcome ? nullableNumberMetric(outcome.fame_gained, "Fame gain missing from outcome") : metricLegacyMissing("Outcome is not ready"), fansGained: fans, bestSongTitle: bestSong ? metricAvailable(bestSong.title, bestSong.performanceScore.status === "available" ? "authoritative" : "legacy") : metricLegacyMissing("No song performance rows available") },
    songs,
    performers: normalizedPerformers.map((row) => ({ id: row.id, profileId: row.profile_id, displayName: row.profiles?.display_name ?? row.profiles?.username ?? "Unknown Performer", roleOrInstrument: row.role_or_instrument, lineupStatus: row.lineup_status ?? "unknown" })),
    finances: { ticketRevenue: outcome ? nullableNumberMetric(outcome.ticket_revenue, "Ticket revenue missing") : metricLegacyMissing("Outcome is not ready"), merchRevenue: outcome ? nullableNumberMetric(outcome.merch_revenue, "Merch revenue missing") : metricLegacyMissing("Outcome is not ready"), totalRevenue: outcome ? nullableNumberMetric(outcome.total_revenue, "Total revenue missing") : metricLegacyMissing("Outcome is not ready"), crewCosts: outcome ? nullableNumberMetric(outcome.crew_cost, "Crew cost missing") : metricLegacyMissing("Outcome is not ready"), equipmentWearCost: outcome ? nullableNumberMetric(outcome.equipment_cost, "Equipment wear cost missing") : metricLegacyMissing("Outcome is not ready"), venueCost: outcome ? nullableNumberMetric(outcome.venue_cost, "Venue cost missing") : metricLegacyMissing("Outcome is not ready"), totalCosts: outcome ? nullableNumberMetric(outcome.total_costs, "Total costs missing") : metricLegacyMissing("Outcome is not ready"), netProfit: outcome ? nullableNumberMetric(outcome.net_profit, "Net profit missing") : metricLegacyMissing("Outcome is not ready"), merchItemsSold: outcome ? nullableNumberMetric(outcome.merch_items_sold, "Merch item count missing") : metricLegacyMissing("Outcome is not ready") },
    progression: { fameGained: outcome ? nullableNumberMetric(outcome.fame_gained, "Fame gain missing") : metricLegacyMissing("Outcome is not ready"), chemistryChange: outcome ? nullableNumberMetric(outcome.chemistry_change, "Chemistry change missing") : metricLegacyMissing("Outcome is not ready"), totalXpAwarded: outcome ? nullableNumberMetric(outcome.total_xp_awarded, "XP summary missing") : metricLegacyMissing("Outcome is not ready"), fansGained: fans, fanConversions: outcome ? nullableNumberMetric(outcome.fan_conversions, "Fan conversion count missing") : metricLegacyMissing("Outcome is not ready") },
    analysis: { equipmentQuality: outcome ? nullableNumberMetric(outcome.equipment_quality_avg, "Equipment breakdown missing") : metricLegacyMissing("Outcome is not ready"), crewSkill: outcome ? nullableNumberMetric(outcome.crew_skill_avg, "Crew breakdown missing") : metricLegacyMissing("Outcome is not ready"), bandChemistry: outcome ? nullableNumberMetric(outcome.band_chemistry_level, "Band chemistry breakdown missing") : metricLegacyMissing("Outcome is not ready"), memberSkills: outcome ? nullableNumberMetric(outcome.member_skill_avg, "Member skills breakdown missing") : metricLegacyMissing("Outcome is not ready"), crowdEnergyPeak: outcome ? nullableNumberMetric(outcome.crowd_energy_peak, "Crowd energy peak missing") : metricLegacyMissing("Outcome is not ready"), stageBehaviorUsed: outcome?.stage_behavior_used ? metricAvailable(outcome.stage_behavior_used) : metricNotApplicable("No stage behaviour was recorded"), gearEffects: outcome ? mapGearEffects(outcome) : null, warnings: Array.from(new Set([
      ...buildWarnings(outcome, songs.length, normalizedPerformers.length),
      ...(duplicateSongPositionCount > 0 ? [`${duplicateSongPositionCount} conflicting historical setlist position(s) were collapsed for playback.`] : []),
      ...(duplicatePerformerCount > 0 ? [`${duplicatePerformerCount} duplicate historical performer row(s) were collapsed for playback.`] : []),
      ...(input.loadWarnings ?? []),
    ])) },
    postConsequences: mapPostConsequences(input.postProcessing ?? null, input.consequences ?? []),
    lessons: buildLessons(metricValue(rating, 0), metricValue(outcome ? nullableNumberMetric(outcome.actual_attendance, "") : metricAvailable(0), 0), capacity, metricValue(outcome ? nullableNumberMetric(outcome.net_profit, "") : metricAvailable(0), 0)),
    viewer: {
      ready: !!outcome && !!(gig.result_ready_at ?? (gig.status === "completed" ? outcome.completed_at ?? gig.completed_at : null)),
      outcomeId: outcome?.id ?? null,
      resultReadyAt: gig.result_ready_at ?? (gig.status === "completed" ? outcome?.completed_at ?? gig.completed_at : null),
      replayAvailable: input.replayDescriptor?.generation_status === "ready",
      replay: input.replayDescriptor ? { viewerVersion: input.replayDescriptor.viewer_version, durationMs: input.replayDescriptor.duration_ms, generationStatus: input.replayDescriptor.generation_status } : { viewerVersion: null, durationMs: null, generationStatus: outcome ? "legacy_unavailable" : null },
    },
  };
  const validationErrors = validateGigExperience(dto);
  if (validationErrors.length > 0) throw new Error(`Invalid gig experience DTO: ${validationErrors.map((e) => `${e.field} ${e.message}`).join(", ")}`);
  return dto;
}

export function validateGigExperience(dto: GigExperienceDTO): GigExperienceValidationError[] {
  const errors: GigExperienceValidationError[] = [];
  if (!dto.gig.id) errors.push({ field: "gig.id", message: "is required" });
  if (!dto.gig.venue.name || dto.gig.venue.capacity < 0) errors.push({ field: "gig.venue", message: "is invalid" });
  const attendance = dto.headline.attendance;
  if (attendance.status === "available" && (attendance.value < 0 || attendance.value > dto.gig.venue.capacity)) errors.push({ field: "headline.attendance", message: "must be between 0 and capacity" });
  const rating = dto.headline.overallRating;
  if (rating.status === "available" && (rating.value < 0 || rating.value > 25)) errors.push({ field: "headline.overallRating", message: "must be between 0 and 25" });
  const performerIds = new Set<string>();
  dto.performers.forEach((p) => performerIds.has(p.profileId) ? errors.push({ field: "performers", message: `duplicate performer ${p.profileId}` }) : performerIds.add(p.profileId));
  const positions = new Set<number>();
  dto.songs.forEach((song) => positions.has(song.position) ? errors.push({ field: "songs", message: `duplicate position ${song.position}` }) : positions.add(song.position));
  return errors;
}

function mapGearEffects(outcome: OutcomeRow): GearModifierEffects {
  const attendanceBonus = outcome.social_buzz_impact ?? 0;
  const reliabilityBonus = outcome.audience_memory_impact ?? 0;
  const revenueBonus = outcome.promoter_modifier ?? 0;
  const fameBonus = outcome.venue_loyalty_bonus ?? 0;
  const equipmentBonus = outcome.band_synergy_modifier ?? 0;
  return { ...EMPTY_GEAR_EFFECTS, equipmentQualityBonus: equipmentBonus, crowdEngagementMultiplier: 1 + attendanceBonus / 100, attendanceBonusPercent: attendanceBonus, reliabilityStability: reliabilityBonus / 100, reliabilitySwingReductionPercent: reliabilityBonus, revenueMultiplier: 1 + revenueBonus / 100, revenueBonusPercent: revenueBonus, fameMultiplier: 1 + fameBonus / 100, fameBonusPercent: fameBonus, breakdown: [] };
}
function buildVerdict(rating: number) { if (rating >= 22) return "A landmark performance that the crowd will remember."; if (rating >= 17) return "A strong show with clear momentum."; if (rating >= 10) return "A mixed gig with useful lessons for next time."; return "A rough night that exposed areas to improve."; }
function buildWarnings(outcome: OutcomeRow | null, songCount: number, performerCount: number) { const warnings: string[] = []; if (!outcome) warnings.push("Outcome is still processing or unavailable."); if (outcome && songCount === 0) warnings.push("No song performance rows were found for this outcome."); if (outcome && performerCount === 0) warnings.push("No performer lineup rows were found; legacy performer details are unavailable."); if (outcome && outcome.merch_items_sold === null) warnings.push("Merch item details are missing on this legacy outcome."); return warnings; }
function buildLessons(rating: number, attendance: number, capacity: number, profit: number) { return { worked: [rating >= 17 ? "Overall performance quality was strong." : "The outcome was recorded and can be reviewed."], heldBack: [attendance < capacity * 0.5 ? "Attendance was below half capacity." : profit < 0 ? "Costs outweighed revenue." : "No major blocker was identified in the canonical summary."], recommendations: [attendance < capacity * 0.5 ? "Book a smaller venue or build local demand before returning." : profit < 0 ? "Review ticket price, crew costs, and venue fit before the next gig." : "Use the song breakdown to refine the next setlist."] }; }

function mapPostConsequences(processing: { status: string; processing_version: string | null; completed_at: string | null } | null, rows: ConsequenceRow[]): GigPostConsequencesDTO {
  const consequences = rows.map((row) => ({ key: row.consequence_key, category: row.category, targetType: row.target_type, targetId: row.target_id, previousValue: row.previous_value, deltaValue: row.delta_value, newValue: row.new_value, status: row.status, explanation: row.explanation, sourceFactors: row.source_factors ?? [] }));
  const findDelta = (key: string) => consequences.find((c) => c.key === key)?.deltaValue;
  const media = consequences.find((c) => c.category === "media");
  const timeline = ["Performance completed", "Financial settlement", "Fan response", "Media response", "Reputation changes", "Venue and promoter response", "Performer and crew progression", "Equipment inspection", "Health and recovery", "Future offers"];
  const allowedStatuses = new Set<GigPostConsequencesDTO["processingStatus"]>(["pending", "processing", "completed", "partially_failed", "retry_required", "skipped", "legacy_missing"]);
  const processingStatus = processing && allowedStatuses.has(processing.status as GigPostConsequencesDTO["processingStatus"])
    ? processing.status as GigPostConsequencesDTO["processingStatus"]
    : "legacy_missing";
  return {
    processingStatus,
    processingVersion: processing?.processing_version ?? null,
    processedAt: processing?.completed_at ?? null,
    liveReputationDelta: findDelta("live_reputation.overall") !== undefined ? metricAvailable(findDelta("live_reputation.overall")!) : metricLegacyMissing("Post-gig consequences have not been processed for this legacy result"),
    fanDelta: findDelta("fans.local_delta") !== undefined ? metricAvailable(findDelta("fans.local_delta")!) : metricLegacyMissing("Fan consequence snapshot missing"),
    followerDelta: findDelta("followers.delta") !== undefined ? metricAvailable(findDelta("followers.delta")!) : metricLegacyMissing("Follower consequence snapshot missing"),
    bookingDemandDelta: findDelta("booking_demand.recent") !== undefined ? metricAvailable(findDelta("booking_demand.recent")!) : metricLegacyMissing("Booking-demand consequence snapshot missing"),
    mediaCoverage: media ? metricAvailable(String(media.newValue ?? media.deltaValue ?? media.key)) : metricNotApplicable("No media coverage met the significance threshold"),
    timeline,
    nextActions: buildPostGigNextActions(consequences),
    consequences,
  };
}
function buildPostGigNextActions(consequences: GigPostConsequencesDTO["consequences"]): GigPostConsequencesDTO["nextActions"] {
  const actions: GigPostConsequencesDTO["nextActions"] = [];
  if (consequences.some((c) => c.category === "equipment" && c.status === "negative")) actions.push({ key: "repair_equipment", label: "Inspect and repair damaged equipment", href: "/equipment", priority: "high" });
  if (consequences.some((c) => c.key === "health.fatigue" && (c.deltaValue ?? 0) >= 18)) actions.push({ key: "schedule_recovery", label: "Schedule recovery", href: "/calendar", priority: "medium" });
  if (consequences.some((c) => c.category === "media")) actions.push({ key: "review_press", label: "Review press coverage", href: "/news", priority: "medium" });
  actions.push({ key: "review_feedback", label: "Review audience feedback", href: "/gigs", priority: "low" });
  return actions;
}
