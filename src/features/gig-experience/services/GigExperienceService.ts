import { supabase } from "@/integrations/supabase/client";
import { getPerformanceGrade } from "@/utils/gigPerformanceCalculator";
import { EMPTY_GEAR_EFFECTS, type GearModifierEffects } from "@/utils/gearModifiers";
import type { Database } from "@/lib/supabase-types";
import type { GigExperienceDTO, GigExperienceValidationError, GigPostConsequencesDTO } from "../types";
import { resolveSongAudioDescriptor } from "../viewer/audio/audioSourceResolver";
import { metricAvailable, metricLegacyMissing, metricNotApplicable, nullableNumberMetric, metricValue } from "../reportMetric";

type GigRow = Database["public"]["Tables"]["gigs"]["Row"] & { venues?: Database["public"]["Tables"]["venues"]["Row"] | null };
type OutcomeRow = Database["public"]["Tables"]["gig_outcomes"]["Row"];
type SongPerfRow = Database["public"]["Tables"]["gig_song_performances"]["Row"];
type SetlistSongRow = { song_id: string; position: number; songs?: { id: string; title: string | null; genre?: string | null; quality_score?: number | null; audio_url?: string | null; extended_audio_url?: string | null; audio_generation_status?: string | null; duration_seconds?: number | null } | null };
type PerformerRow = { id: string; profile_id: string; role_or_instrument: string | null; lineup_status: string | null; profiles?: { display_name?: string | null; username?: string | null } | null };

const outcomeSelect = "id,gig_id,band_id,venue_id,venue_name,venue_capacity,completed_at,created_at,overall_rating,performance_grade,actual_attendance,attendance_percentage,ticket_revenue,merch_revenue,total_revenue,crew_cost,equipment_cost,venue_cost,total_costs,net_profit,fame_gained,new_followers,casual_fans_gained,dedicated_fans_gained,superfans_gained,fan_conversions,chemistry_change,total_xp_awarded,equipment_quality_avg,crew_skill_avg,band_chemistry_level,member_skill_avg,merch_items_sold,crowd_energy_peak,stage_behavior_used,band_synergy_modifier,social_buzz_impact,audience_memory_impact,promoter_modifier,venue_loyalty_bonus,highlight_moments,xp_breakdown";

export async function getGigExperience(gigId: string): Promise<GigExperienceDTO | null> {
  const { data: gig, error: gigError } = await supabase
    .from("gigs")
    .select("id,band_id,venue_id,setlist_id,status,scheduled_date,started_at,completed_at,ticket_price,venues!gigs_venue_id_fkey(id,name,location,capacity,city_id)")
    .eq("id", gigId)
    .single();
  if (gigError) throw gigError;

  const { data: outcome, error: outcomeError } = await supabase
    .from("gig_outcomes")
    .select(outcomeSelect)
    .eq("gig_id", gigId)
    .maybeSingle();
  if (outcomeError) throw outcomeError;

  const outcomeId = outcome?.id ?? null;
  const [songPerfsRes, setlistSongsRes, performersRes, replayDescriptorRes, processingRes, consequenceRes] = await Promise.all([
    outcomeId
      ? supabase.from("gig_song_performances").select("id,song_id,position,performance_score,crowd_response,song_quality_contrib,rehearsal_contrib,chemistry_contrib,equipment_contrib,crew_contrib,member_skill_contrib,song_title,performance_item_name,item_type").eq("gig_outcome_id", outcomeId).order("position")
      : Promise.resolve({ data: [] as SongPerfRow[], error: null }),
    gig?.setlist_id
      ? supabase.from("setlist_songs").select("song_id,position,songs(id,title,genre,quality_score,audio_url,extended_audio_url,audio_generation_status,duration_seconds)").eq("setlist_id", gig.setlist_id).order("position")
      : Promise.resolve({ data: [] as SetlistSongRow[], error: null }),
    (supabase as any).from("gig_performers").select("id,profile_id,role_or_instrument,lineup_status,profiles:profiles!gig_performers_profile_id_fkey(display_name,username)").eq("gig_id", gigId).order("created_at", { ascending: true }),
    (supabase as any).from("gig_viewer_replays").select("viewer_version,duration_ms,generation_status").eq("gig_id", gigId).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    (supabase as any).from("gig_post_processing").select("status,processing_version,completed_at").eq("gig_id", gigId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    (supabase as any).from("gig_consequence_snapshots").select("category,target_type,target_id,consequence_key,previous_value,delta_value,new_value,status,explanation,source_factors,metadata,created_at").eq("gig_id", gigId).order("created_at", { ascending: true }),
  ]);
  if (songPerfsRes.error) throw songPerfsRes.error;
  if (setlistSongsRes.error) throw setlistSongsRes.error;
  if (performersRes.error) throw performersRes.error;
  if (replayDescriptorRes.error && replayDescriptorRes.error.code !== "42P01") throw replayDescriptorRes.error;
  if (processingRes.error && processingRes.error.code !== "42P01") throw processingRes.error;
  if (consequenceRes.error && consequenceRes.error.code !== "42P01") throw consequenceRes.error;

  return mapGigExperience({
    gig: gig as unknown as GigRow,
    outcome: outcome as OutcomeRow | null,
    songPerformances: (songPerfsRes.data ?? []) as SongPerfRow[],
    setlistSongs: (setlistSongsRes.data ?? []) as unknown as SetlistSongRow[],
    performers: (performersRes.data ?? []) as PerformerRow[],
    replayDescriptor: replayDescriptorRes.data ?? null,
    postProcessing: processingRes.data ?? null,
    consequences: consequenceRes.data ?? [],
  });
}

export function mapGigExperience(input: { gig: GigRow; outcome: OutcomeRow | null; songPerformances?: SongPerfRow[]; setlistSongs?: SetlistSongRow[]; performers?: PerformerRow[]; replayDescriptor?: { viewer_version: number; duration_ms: number; generation_status: string } | null; postProcessing?: { status: string; processing_version: string | null; completed_at: string | null } | null; consequences?: any[] }): GigExperienceDTO {
  const { gig, outcome } = input;
  const venue = gig.venues;
  const capacity = venue?.capacity ?? outcome?.venue_capacity ?? 0;
  const setlistTitles = new Map((input.setlistSongs ?? []).map((row) => [row.song_id, row.songs?.title ?? "Unknown Song"]));
  const setlistAudio = new Map((input.setlistSongs ?? []).map((row) => [row.song_id, resolveSongAudioDescriptor(row.songs, "allowed")]));
  const songPerformances = [...(input.songPerformances ?? [])].sort((a, b) => a.position - b.position);
  const songs: GigExperienceDTO["songs"] = songPerformances.map((row) => ({
    id: row.id,
    songId: row.song_id ?? null,
    position: row.position,
    title: row.song_title ?? (row.song_id ? setlistTitles.get(row.song_id) : undefined) ?? row.performance_item_name ?? "Unknown Song",
    audio: row.song_id ? setlistAudio.get(row.song_id) : resolveSongAudioDescriptor(null, "allowed"),
    performanceScore: nullableNumberMetric(row.performance_score, "Song score missing from legacy performance row"),
    crowdResponse: row.crowd_response ? metricAvailable<string>(String(row.crowd_response)) : metricLegacyMissing<string>("Crowd response missing from legacy performance row"),
    contributions: {
      songQuality: nullableNumberMetric(row.song_quality_contrib, "Song quality contribution missing from legacy row"),
      rehearsal: nullableNumberMetric(row.rehearsal_contrib, "Rehearsal contribution missing from legacy row"),
      chemistry: nullableNumberMetric(row.chemistry_contrib, "Chemistry contribution missing from legacy row"),
      equipment: nullableNumberMetric(row.equipment_contrib, "Equipment contribution missing from legacy row"),
      crew: nullableNumberMetric(row.crew_contrib, "Crew contribution missing from legacy row"),
      memberSkill: nullableNumberMetric(row.member_skill_contrib, "Member skill contribution missing from legacy row"),
    },
  }));
  const bestSong = songs.reduce<typeof songs[number] | null>((best, song) => !best || metricValue(song.performanceScore, -Infinity) > metricValue(best.performanceScore, -Infinity) ? song : best, null);
  const fans = (outcome?.new_followers ?? outcome?.casual_fans_gained ?? null) !== null
    ? metricAvailable((outcome?.new_followers ?? 0) + (outcome?.casual_fans_gained ?? 0) + (outcome?.dedicated_fans_gained ?? 0) + (outcome?.superfans_gained ?? 0))
    : metricLegacyMissing<number>("Fan-gain columns are absent on this legacy outcome");
  const rating = outcome ? nullableNumberMetric(outcome.overall_rating, "Overall rating is still processing") : metricLegacyMissing<number>("No outcome row exists yet");
  const dto: GigExperienceDTO = {
    schemaVersion: 1,
    gig: { id: gig.id, bandId: gig.band_id, status: gig.status, scheduledDate: gig.scheduled_date, startedAt: gig.started_at, completedAt: gig.completed_at, ticketPrice: nullableNumberMetric(gig.ticket_price, "Ticket price missing"), venue: { id: venue?.id ?? outcome?.venue_id ?? null, name: venue?.name ?? outcome?.venue_name ?? "Unknown Venue", location: venue?.location ?? null, capacity } },
    headline: { overallRating: rating, performanceGrade: outcome?.performance_grade ? metricAvailable(outcome.performance_grade) : rating.status === "available" ? metricAvailable(getPerformanceGrade(rating.value).grade, "derived") : metricLegacyMissing("Grade unavailable until rating exists"), verdict: buildVerdict(metricValue(rating, 0)), attendance: outcome ? nullableNumberMetric(outcome.actual_attendance, "Attendance missing from outcome") : metricLegacyMissing("Outcome is not ready"), capacity: capacity > 0 ? metricAvailable(capacity) : metricLegacyMissing("Venue capacity missing"), netProfit: outcome ? nullableNumberMetric(outcome.net_profit, "Net profit missing from outcome") : metricLegacyMissing("Outcome is not ready"), fameGained: outcome ? nullableNumberMetric(outcome.fame_gained, "Fame gain missing from outcome") : metricLegacyMissing("Outcome is not ready"), fansGained: fans, bestSongTitle: bestSong ? metricAvailable(bestSong.title, bestSong.performanceScore.status === "available" ? "authoritative" : "legacy") : metricLegacyMissing("No song performance rows available") },
    songs,
    performers: (input.performers ?? []).map((row) => ({ id: row.id, profileId: row.profile_id, displayName: row.profiles?.display_name ?? row.profiles?.username ?? "Unknown Performer", roleOrInstrument: row.role_or_instrument, lineupStatus: row.lineup_status ?? "unknown" })),
    finances: { ticketRevenue: outcome ? nullableNumberMetric(outcome.ticket_revenue, "Ticket revenue missing") : metricLegacyMissing("Outcome is not ready"), merchRevenue: outcome ? nullableNumberMetric(outcome.merch_revenue, "Merch revenue missing") : metricLegacyMissing("Outcome is not ready"), totalRevenue: outcome ? nullableNumberMetric(outcome.total_revenue, "Total revenue missing") : metricLegacyMissing("Outcome is not ready"), crewCosts: outcome ? nullableNumberMetric(outcome.crew_cost, "Crew cost missing") : metricLegacyMissing("Outcome is not ready"), equipmentWearCost: outcome ? nullableNumberMetric(outcome.equipment_cost, "Equipment wear cost missing") : metricLegacyMissing("Outcome is not ready"), venueCost: outcome ? nullableNumberMetric(outcome.venue_cost, "Venue cost missing") : metricLegacyMissing("Outcome is not ready"), totalCosts: outcome ? nullableNumberMetric(outcome.total_costs, "Total costs missing") : metricLegacyMissing("Outcome is not ready"), netProfit: outcome ? nullableNumberMetric(outcome.net_profit, "Net profit missing") : metricLegacyMissing("Outcome is not ready"), merchItemsSold: outcome ? nullableNumberMetric(outcome.merch_items_sold, "Merch item count missing") : metricLegacyMissing("Outcome is not ready") },
    progression: { fameGained: outcome ? nullableNumberMetric(outcome.fame_gained, "Fame gain missing") : metricLegacyMissing("Outcome is not ready"), chemistryChange: outcome ? nullableNumberMetric(outcome.chemistry_change, "Chemistry change missing") : metricLegacyMissing("Outcome is not ready"), totalXpAwarded: outcome ? nullableNumberMetric(outcome.total_xp_awarded, "XP summary missing") : metricLegacyMissing("Outcome is not ready"), fansGained: fans, fanConversions: outcome ? nullableNumberMetric(outcome.fan_conversions, "Fan conversion count missing") : metricLegacyMissing("Outcome is not ready") },
    analysis: { equipmentQuality: outcome ? nullableNumberMetric(outcome.equipment_quality_avg, "Equipment breakdown missing") : metricLegacyMissing("Outcome is not ready"), crewSkill: outcome ? nullableNumberMetric(outcome.crew_skill_avg, "Crew breakdown missing") : metricLegacyMissing("Outcome is not ready"), bandChemistry: outcome ? nullableNumberMetric(outcome.band_chemistry_level, "Band chemistry breakdown missing") : metricLegacyMissing("Outcome is not ready"), memberSkills: outcome ? nullableNumberMetric(outcome.member_skill_avg, "Member skills breakdown missing") : metricLegacyMissing("Outcome is not ready"), crowdEnergyPeak: outcome ? nullableNumberMetric(outcome.crowd_energy_peak, "Crowd energy peak missing") : metricLegacyMissing("Outcome is not ready"), stageBehaviorUsed: outcome?.stage_behavior_used ? metricAvailable(outcome.stage_behavior_used) : metricNotApplicable("No stage behaviour was recorded"), gearEffects: outcome ? mapGearEffects(outcome) : null, warnings: buildWarnings(outcome, songs.length, input.performers?.length ?? 0) },
    postConsequences: mapPostConsequences(input.postProcessing ?? null, input.consequences ?? []),
    lessons: buildLessons(metricValue(rating, 0), metricValue(outcome ? nullableNumberMetric(outcome.actual_attendance, "") : metricAvailable(0), 0), capacity, metricValue(outcome ? nullableNumberMetric(outcome.net_profit, "") : metricAvailable(0), 0)),
    viewer: { ready: !!outcome, outcomeId: outcome?.id ?? null, resultReadyAt: outcome?.completed_at ?? gig.completed_at ?? null, replayAvailable: input.replayDescriptor?.generation_status === "ready", replay: input.replayDescriptor ? { viewerVersion: input.replayDescriptor.viewer_version, durationMs: input.replayDescriptor.duration_ms, generationStatus: input.replayDescriptor.generation_status } : { viewerVersion: null, durationMs: null, generationStatus: outcome ? "legacy_unavailable" : null } },
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

function mapPostConsequences(processing: { status: string; processing_version: string | null; completed_at: string | null } | null, rows: any[]): GigPostConsequencesDTO {
  const consequences = rows.map((row) => ({ key: row.consequence_key, category: row.category, targetType: row.target_type, targetId: row.target_id, previousValue: row.previous_value, deltaValue: row.delta_value, newValue: row.new_value, status: row.status, explanation: row.explanation, sourceFactors: row.source_factors ?? [] }));
  const findDelta = (key: string) => consequences.find((c) => c.key === key)?.deltaValue;
  const media = consequences.find((c) => c.category === "media");
  const timeline = ["Performance completed", "Financial settlement", "Fan response", "Media response", "Reputation changes", "Venue and promoter response", "Performer and crew progression", "Equipment inspection", "Health and recovery", "Future offers"];
  return {
    processingStatus: (processing?.status as any) ?? "legacy_missing",
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
