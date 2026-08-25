import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFestivalRewardSummary } from "../attendance/festivalRewards";

const migration = readFileSync("supabase/migrations/20260825144000_festival_c8_attendee_rewards.sql", "utf8");
const unlockMigration = readFileSync("supabase/migrations/20260825144100_festival_c8_reward_unlock_hooks.sql", "utf8");
const repository = readFileSync("src/features/festival-company/attendance/festivalRewardsRepository.ts", "utf8");
const ui = readFileSync("src/features/festival-company/attendance/FestivalModeRewards.tsx", "utf8");
const shell = readFileSync("src/features/festival-company/attendance/FestivalModeShell.tsx", "utf8");

const attendanceId = "11111111-1111-4111-8111-111111111111";
const editionId = "22222222-2222-4222-8222-222222222222";

describe("Festival C8 reward authority", () => {
  it("settles one bounded reward per authoritative attendance", () => {
    expect(migration).toContain("attendance_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("skill_xp_awarded integer NOT NULL DEFAULT 0 CHECK (skill_xp_awarded BETWEEN 0 AND 600)");
    expect(migration).toContain("attribute_points_awarded integer NOT NULL DEFAULT 0 CHECK (attribute_points_awarded BETWEEN 0 AND 3)");
    expect(migration).toContain("IF v_attendance.status NOT IN ('completed','left_early')");
    expect(migration).toContain("SELECT * INTO v_existing FROM public.festival_attendee_reward_settlements WHERE attendance_id = p_attendance_id");
    expect(migration).toContain("least(v_completed, 8)");
    expect(migration).toContain("least(v_watched, 4)");
    expect(migration).toContain("least(v_moments, 4)");
  });

  it("uses verified check-in/completion rather than ticket count for owner signal", () => {
    expect(migration).toContain("count(DISTINCT a.profile_id) FILTER (WHERE a.checked_in_at IS NOT NULL)");
    expect(migration).toContain("count(DISTINCT a.profile_id) FILTER (WHERE a.status = 'completed')");
    expect(migration).toContain("owner_boost_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (owner_boost_percent BETWEEN 0 AND 5)");
    expect(migration).toContain("'ticketCountUsed', false");
    expect(migration).not.toContain("tickets_sold *");
  });

  it("writes permanent recap memory and canonical achievement event only once", () => {
    expect(migration).toContain("UNIQUE(attendance_id, memory_key)");
    expect(migration).toContain("'festival_attendance_completed'");
    expect(migration).toContain("PERFORM public.evaluate_achievements_for_event(v_achievement_event)");
    expect(migration).toContain("'festival-first-completion'");
  });

  it("records a bounded inspiration unlock hook without browser-controlled skill effects", () => {
    expect(unlockMigration).toContain("festival_inspiration_boost");
    expect(unlockMigration).toContain("NEW.inspiration_score >= 75");
    expect(unlockMigration).toContain("NEW.settled_at + interval '72 hours'");
    expect(unlockMigration).toContain("UNIQUE(attendance_id, unlock_key)");
    expect(unlockMigration).toContain("future-skill-learning-rpc");
  });

  it("keeps direct reward tables private and exposes a narrow player RPC", () => {
    expect(migration).toContain("REVOKE ALL ON public.festival_attendee_reward_settlements");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_my_festival_reward_summary");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.get_my_festival_reward_summary(uuid) TO authenticated, service_role");
    expect(repository).toContain('festivalRpc("get_my_festival_reward_summary"');
  });
});

describe("Festival C8 client contract", () => {
  it("strictly parses bounded reward summaries", () => {
    const value = { attendanceId, festivalEditionId: editionId, attendanceStatus: "attending", settled: false, skillXp: 285, attributePoints: 2, completedActivities: 4, watchedActs: 2, resolvedMoments: 1, distinctActivityTypes: 4, inspiration: 72, settledAt: null, breakdown: { preview: true }, serverNow: "2030-07-01T21:00:00Z" };
    expect(parseFestivalRewardSummary(value)).toEqual(value);
    expect(() => parseFestivalRewardSummary({ ...value, skillXp: 601 })).toThrow("malformed_festival_reward_summary");
    expect(() => parseFestivalRewardSummary({ ...value, attributePoints: 4 })).toThrow("malformed_festival_reward_summary");
  });

  it("exposes rewards in Festival Mode and explains caps", () => {
    expect(shell).toContain('id: "rewards"');
    expect(shell).toContain("<FestivalModeRewards attendance={attendance} />");
    expect(ui).toContain("Maximum 600 per attendance");
    expect(ui).toContain("capped at 2");
    expect(ui).toContain("one reward settlement");
  });
});
