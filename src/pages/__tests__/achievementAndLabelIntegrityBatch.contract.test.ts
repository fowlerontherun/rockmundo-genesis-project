import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (file: string) => readFileSync(
  fileURLToPath(new URL(file, import.meta.url)), "utf8"
);
const achievements = read("../../../supabase/migrations/20261013184000_achievement_event_reward_integrity.sql");
const stats = read("../../../supabase/migrations/20261013184500_profile_scoped_award_stats.sql");
const labels = read("../../../supabase/migrations/20261013185000_guard_label_contract_termination.sql");

describe("achievement and label integrity migrations", () => {
  it("#3916: gates mapped AND direct completion on every numeric criterion", () => {
    expect(achievements).toContain("FOR v_criterion IN SELECT * FROM public.achievement_criteria");
    expect(achievements).toContain("RETURN v_seen>0");
    expect(achievements).toContain("v_event.payload->v_criterion.target_key");
    expect(achievements).toContain("v_progress->v_criterion.target_key");
    expect(achievements).toContain("IS DISTINCT FROM 'number' THEN RETURN false");
    expect(achievements).toMatch(/IF public.achievement_event_criteria_met\(v_event.profile_id,v_mapping.id,p_event_id\) THEN/);
    expect(achievements).toMatch(/IF p_source_event_id IS NOT NULL AND NOT public.achievement_event_criteria_met/);
  });

  it("#3917: remembers every source event rather than only the last one", () => {
    expect(achievements).toContain("PRIMARY KEY (profile_id, achievement_id, source_event_id)");
    expect(achievements).toContain("INSERT INTO public.achievement_processed_events");
    expect(achievements).toContain("ON CONFLICT DO NOTHING");
    expect(achievements).toContain("IF v_new=0 THEN RETURN NULL");
    expect(achievements).toContain("v_has_existing:=FOUND");
    expect(achievements).toContain("pg_advisory_xact_lock");
  });

  it("#3918: settles all automatic currencies with transaction-scoped unique receipts", () => {
    for (const type of ["'cash'", "'skill_xp'", "'attribute_point'"]) {
      expect(achievements).toContain(type);
    }
    expect(achievements).toContain("PRIMARY KEY (profile_id, achievement_id, reward_id, completion_number)");
    expect(achievements).toContain("UPDATE public.profiles SET cash=");
    expect(achievements).toContain("skill_xp_balance=coalesce(skill_xp_balance,0)+v_reward.amount");
    expect(achievements).toContain("attribute_points_balance=coalesce(attribute_points_balance,0)+v_reward.amount");
    expect(achievements).toContain("'reward_granted'");
  });

  it("#3919: does not attribute account-wide award statistics to sibling characters", () => {
    expect(stats).toContain("bm.profile_id = p_profile_id AND bm.joined_at <= aw.won_at");
    expect(stats).toContain("an.nominee_id=p_profile_id::text");
    expect(stats).toContain("bm.joined_at <= an.created_at");
    expect(stats).not.toContain("aw.user_id = v_user_id");
    expect(stats).not.toContain("an.user_id = v_user_id");
    expect(stats).not.toContain("s.user_id = v_user_id");
    expect(stats).toContain("authored.profile_id=p_profile_id");
  });

  it("#2936: blocks direct label termination and unaccounted liabilities", () => {
    expect(labels).toContain("BEFORE UPDATE OF status ON public.artist_label_contracts");
    expect(labels).toContain("current_user NOT IN ('postgres','service_role','supabase_admin')");
    expect(labels).toContain("UNRECOUPED_ADVANCE_REQUIRES_SETTLEMENT");
    expect(labels).toContain("coalesce(NEW.termination_fee_paid,0)<v_outstanding");
    expect(labels).toContain("TERMINATION_TIMESTAMP_REQUIRED");
  });
});
