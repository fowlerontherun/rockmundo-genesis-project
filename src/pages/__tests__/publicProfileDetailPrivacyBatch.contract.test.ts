import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (name: string) => readFileSync(
  fileURLToPath(new URL(name, import.meta.url)), "utf8",
);
const sql = read("../../../supabase/migrations/20261013195000_public_profile_visibility_and_badges.sql");
const page = read("../../../src/pages/PlayerProfile.tsx");

describe("public profile social, achievement and privacy integration", () => {
  it("#3933 requires an authenticated, active viewer and never trusts a spoofed viewer", () => {
    expect(sql).toContain("IF auth.uid() IS NULL THEN");
    expect(sql).toContain("v_viewer := public._caller_profile_id()");
    expect(sql).toContain("viewer_profile_id IS DISTINCT FROM v_viewer");
    expect(sql).toContain("public._social_blocked(v_viewer,target_profile_id)");
    expect(sql).toContain("FROM PUBLIC,anon");
  });
  it("#3934 rejects private profiles and applies per-section and per-field privacy", () => {
    expect(sql).toContain("v_settings.visibility::text IS DISTINCT FROM 'public'");
    expect(sql).toContain("coalesce(v_settings.show_city,true)");
    expect(sql).toContain("coalesce(v_settings.show_career_history,true)");
    expect(sql).toContain("coalesce(v_settings.show_achievements,true)");
    expect(sql).toContain("coalesce(v_settings.show_activity,true)");
    expect(sql).toContain("v_settings.show_skills");
    expect(sql).toContain("CREATE POLICY \"Public badges follow character privacy\"");
    expect(sql).toContain("CREATE POLICY \"Public activity follows character privacy\"");
    expect(sql).toContain("CREATE POLICY \"Public milestones follow character privacy\"");
  });
  it("#3935 projects real social settings rather than null placeholders", () => {
    expect(sql).toContain("SELECT * INTO v_settings FROM public.player_profiles");
    expect(sql).toContain("'social_profile',CASE WHEN v_settings.profile_id IS NULL THEN NULL ELSE");
    expect(sql).toContain("'preferred_roles',v_settings.preferred_roles");
    expect(sql).toContain("'status_message',v_settings.status_message");
  });
  it("#3936 returns only five approved public activities", () => {
    expect(sql).toContain("FROM public.player_profile_activity");
    expect(sql).toContain("WHERE profile_id=target_profile_id AND (is_public OR v_owner)");
    expect(sql).toContain("ORDER BY occurred_at DESC LIMIT 5");
  });
  it("#3937 returns and displays only approved character-scoped milestones", () => {
    expect(sql).toContain("FROM public.player_career_milestones");
    expect(sql).toContain("ORDER BY achieved_at DESC LIMIT 5");
    expect(sql).toContain("WHERE bm.profile_id=target_profile_id");
    expect(page).toContain('aria-label="Published career milestones"');
    expect(page).toContain("profile.career_summary.milestones.map");
  });
  it("#3927 bridges canonical and legacy badges with key deduplication", () => {
    expect(sql).toContain("FROM public.player_profile_badges pb");
    expect(sql).toContain("FROM public.profile_badges cb");
    expect(sql).toContain("LEFT JOIN public.achievements a ON a.id=cb.achievement_id");
    expect(sql).toContain("SELECT DISTINCT ON (all_badges.badge_key)");
    expect(sql).toContain("coalesce(a.name,cb.badge_key)");
  });
  it("fails closed when required migrations have not been installed", () => {
    for (const table of ["player_profiles", "player_profile_badges", "player_profile_activity",
      "player_career_milestones", "profile_badges", "achievements"]) {
      expect(sql).toContain("('" + table + "')");
    }
    expect(sql).toContain("public_profile_dependencies_missing");
  });
});
