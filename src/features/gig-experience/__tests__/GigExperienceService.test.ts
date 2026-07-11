import { describe, expect, it } from "vitest";
import { mapGigExperience, validateGigExperience } from "../services/GigExperienceService";
import { metricAvailable, metricLegacyMissing, renderMetricValue } from "../reportMetric";

const gig = { id: "gig-1", band_id: "band-1", status: "completed", scheduled_date: "2026-07-11T20:00:00Z", started_at: null, completed_at: "2026-07-11T22:00:00Z", ticket_price: 20, venues: { id: "venue-1", name: "Club Test", location: "NYC", capacity: 100 } } as any;
const outcome = { id: "out-1", gig_id: "gig-1", band_id: "band-1", venue_id: "venue-1", venue_name: "Club Test", venue_capacity: 100, completed_at: "2026-07-11T22:00:00Z", created_at: "2026-07-11T22:00:00Z", overall_rating: 20, performance_grade: null, actual_attendance: 100, attendance_percentage: 100, ticket_revenue: 2000, merch_revenue: 100, total_revenue: 2100, crew_cost: 300, equipment_cost: 50, venue_cost: 500, total_costs: 850, net_profit: 1250, fame_gained: 10, new_followers: 5, casual_fans_gained: 1, dedicated_fans_gained: 2, superfans_gained: 3, fan_conversions: 11, chemistry_change: -1, total_xp_awarded: 75, equipment_quality_avg: 13, crew_skill_avg: 12, band_chemistry_level: 14, member_skill_avg: 15, merch_items_sold: 4, crowd_energy_peak: 90, stage_behavior_used: "balanced", band_synergy_modifier: 1, social_buzz_impact: 2, audience_memory_impact: 3, promoter_modifier: 4, venue_loyalty_bonus: 5 } as any;
const song = (overrides = {}) => ({ id: "sp-1", song_id: "song-1", position: 1, performance_score: 23, crowd_response: "ecstatic", song_quality_contrib: 20, rehearsal_contrib: 18, chemistry_contrib: 15, equipment_contrib: 12, crew_contrib: 11, member_skill_contrib: 19, song_title: "Opener", performance_item_name: null, ...overrides } as any);

describe("GigExperienceService", () => {
  it("maps current gig outcomes into one canonical DTO", () => {
    const dto = mapGigExperience({ gig, outcome, songPerformances: [song()], setlistSongs: [], performers: [{ id: "gp-1", profile_id: "p-1", role_or_instrument: "Vocals", lineup_status: "performed", profiles: { display_name: "Alex" } }] });
    expect(dto.headline.attendance).toEqual(metricAvailable(100));
    expect(dto.headline.bestSongTitle).toEqual(metricAvailable("Opener", "authoritative"));
    expect(dto.finances.netProfit).toEqual(metricAvailable(1250));
    expect(dto.performers).toHaveLength(1);
  });

  it("preserves zero attendance as available rather than missing", () => {
    const dto = mapGigExperience({ gig, outcome: { ...outcome, actual_attendance: 0, attendance_percentage: 0 }, songPerformances: [song()], performers: [] });
    expect(dto.headline.attendance).toEqual(metricAvailable(0));
  });

  it("keeps negative profit available", () => {
    const dto = mapGigExperience({ gig, outcome: { ...outcome, net_profit: -250 }, songPerformances: [song()], performers: [] });
    expect(dto.finances.netProfit).toEqual(metricAvailable(-250));
  });

  it("marks missing breakdown fields as legacy metrics", () => {
    const dto = mapGigExperience({ gig, outcome: { ...outcome, equipment_quality_avg: null }, songPerformances: [song()], performers: [] });
    expect(dto.analysis.equipmentQuality.status).toBe("legacy_missing");
  });

  it("supports missing songs and performers with compatibility warnings", () => {
    const dto = mapGigExperience({ gig, outcome, songPerformances: [], performers: [] });
    expect(dto.songs).toEqual([]);
    expect(dto.analysis.warnings).toContain("No song performance rows were found for this outcome.");
    expect(dto.analysis.warnings).toContain("No performer lineup rows were found; legacy performer details are unavailable.");
  });

  it("rejects impossible attendance over capacity", () => {
    expect(() => mapGigExperience({ gig, outcome: { ...outcome, actual_attendance: 101 }, songPerformances: [song()], performers: [] })).toThrow(/attendance/);
  });

  it("validates rating limits, duplicate performers, and duplicate song positions", () => {
    const dto = mapGigExperience({ gig, outcome, songPerformances: [song({ id: "sp-1", position: 1 }), song({ id: "sp-2", position: 2, song_id: "song-2" })], performers: [{ id: "gp-1", profile_id: "p-1", role_or_instrument: null, lineup_status: "performed" }] });
    dto.headline.overallRating = metricAvailable(30);
    dto.performers.push({ id: "gp-2", profileId: "p-1", displayName: "Dup", roleOrInstrument: null, lineupStatus: "performed" });
    dto.songs[1].position = 1;
    expect(validateGigExperience(dto).map((e) => e.field)).toEqual(expect.arrayContaining(["headline.overallRating", "performers", "songs"]));
  });

  it("renders ReportMetric statuses without coercing missing values to zero", () => {
    expect(renderMetricValue(metricAvailable(0))).toBe("0");
    expect(renderMetricValue(metricLegacyMissing<number>("legacy"))).toBe("Legacy data unavailable");
  });
});
