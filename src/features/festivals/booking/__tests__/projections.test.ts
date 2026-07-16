import { describe, expect, it } from "vitest";
import {
  mapFestivalApplicationEligibility,
  mapFestivalRepresentedBand,
  mapFestivalRepertoire,
  mapFestivalSetlistPreflight,
} from "../projections";

describe("festival booking projections", () => {
  it("maps represented-band authority from server fields", () => {
    expect(
      mapFestivalRepresentedBand({
        band_id: "band-1",
        band_name: "The Tests",
        member_role: "manager",
        can_apply: true,
      }),
    ).toMatchObject({
      id: "band-1",
      name: "The Tests",
      role: "manager",
      canApply: true,
    });
  });

  it("maps eligibility warnings and blockers", () => {
    expect(
      mapFestivalApplicationEligibility({
        outcome: "warning",
        can_apply: true,
        authority_allowed: true,
        edition_status_allowed: true,
        application_window_open: true,
        hard_conflicts: [],
        advisory_conflicts: ["tour hold"],
        available_slot_types: ["support"],
        reasons: [],
        warnings: ["schedule warning"],
      }),
    ).toMatchObject({
      outcome: "warning",
      advisoryConflicts: ["tour hold"],
      warnings: ["schedule warning"],
    });
  });

  it("maps repertoire and setlist preflight validation", () => {
    expect(
      mapFestivalRepertoire({
        song_id: "song-1",
        title: "Encore",
        writers: ["A"],
        currently_used_in_setlist: true,
      }),
    ).toMatchObject({
      songId: "song-1",
      title: "Encore",
      currentlyUsedInSetlist: true,
    });
    expect(
      mapFestivalSetlistPreflight({
        outcome: "blocked",
        total_duration_seconds: 120,
        contracted_maximum_seconds: 60,
        minimum_recommended_seconds: 60,
        invalid_songs: ["bad"],
        duplicate_songs: [],
        unavailable_songs: [],
        guest_performer_issues: [],
        readiness_warnings: [],
        blocking_reasons: ["too long"],
        warnings: [],
      }),
    ).toMatchObject({
      outcome: "blocked",
      invalidSongs: ["bad"],
      blockingReasons: ["too long"],
    });
  });
});
