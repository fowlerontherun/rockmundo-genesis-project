import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hooks = readFileSync("src/hooks/useAwards.ts", "utf8");
const page = readFileSync("src/pages/Awards.tsx", "utf8");
const ceremony = readFileSync("src/components/awards/AwardCeremonyExperience.tsx", "utf8");

describe("published awards and verified ceremony lineup", () => {
  it("never compares profile IDs to account-owned nominations and wins", () => {
    expect(hooks).toContain("supabase.auth.getUser()");
    expect(hooks).toContain("`user_id.eq.${accountId}`");
    expect(hooks).toContain("`band_id.eq.${bandId}`");
    expect(hooks).toContain("`invitee_user_id.eq.${accountId}`");
    expect(hooks).toContain("`invitee_user_id.eq.${userId}`");
    expect(hooks).not.toContain('.eq("user_id", userId)');
  });

  it("shows only completed show winners in public history", () => {
    expect(page).toContain("completedShows = shows.filter(s => s.status === 'completed')");
    expect(page).toContain('queryKey: ["award-published-results"');
    expect(page).toContain('.from("award_wins")');
    expect(page).toContain('.in("award_show_id", completedShowIds)');
    expect(page).toContain("Official published results");
    expect(page).toContain("win.winner_name");
    expect(page).not.toContain('rpc("award_admin_preview_results"');
  });

  it("does not invent performers, songs, or prize outcomes in ceremony previews", () => {
    expect(page).toContain('.from("award_performance_bookings")');
    expect(page).toContain('.eq("status", "confirmed")');
    expect(page).toContain("confirmedPerformances={bookedPerformances}");
    expect(ceremony).toContain("confirmedPerformances.find");
    expect(ceremony).toContain("if (!booking || !booking.band_name) return []");
    expect(ceremony).toContain("songs: undefined");
    expect(ceremony).toContain("Ceremony Preview Complete");
    expect(ceremony).toContain("only existing, confirmed slots");
    expect(ceremony).not.toContain("Headliner Collective");
    expect(ceremony).not.toContain("Interlude Song ");
  });
});
