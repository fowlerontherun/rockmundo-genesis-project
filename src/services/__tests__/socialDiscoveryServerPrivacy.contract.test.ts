import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (filename: string) =>
  readFileSync(fileURLToPath(new URL(filename, import.meta.url)), "utf8");

const shared = read("../../../supabase/migrations/20261013210000_social_discovery_authoritative_viewer.sql");
const discovery = read("../../../supabase/migrations/20261013210100_private_discovery_filters_and_sorting.sql");

describe("public-profile and discovery server privacy", () => {
  it("#3931 binds both search surfaces and detail to an owned viewer; null cannot evade a block", () => {
    expect(shared).toContain("p.id=p_viewer_profile_id AND p.user_id=auth.uid()");
    expect(shared).toContain("v_viewer:=public._caller_profile_id()");
    expect(shared).toContain("v_viewer := public.resolve_authorized_social_viewer(viewer_profile_id)");
    expect(shared).toContain("v_viewer:=public.resolve_authorized_social_viewer(viewer_profile_id)");
    expect(shared).toContain("NOT public._social_blocked(v_viewer,p.id)");
    expect(shared).toContain("public._social_blocked(v_viewer,target_profile_id)");
    expect(discovery).toContain("v_viewer:=public.resolve_authorized_social_viewer(viewer_profile_id)");
    expect(discovery).toContain("NOT public._social_blocked(v_viewer,p.id)");
  });

  it("#3930 blocks unpublished/private profile details, hides city and band history", () => {
    expect(shared).toContain("IF NOT v_owner AND v_settings.profile_id IS NULL THEN");
    expect(shared).toContain("v_settings.visibility::text IS DISTINCT FROM 'public'");
    expect(shared).toContain("v_owner OR coalesce(v_settings.show_city,true)");
    expect(shared).toContain("'bands',CASE WHEN v_owner OR coalesce(v_settings.show_career_history,true)");
    expect(shared).toContain("p.user_id=auth.uid()");
  });

  it("#3929 returns only public or own live identities, and filters before counting", () => {
    expect(discovery).toContain("JOIN public.player_profiles social ON social.profile_id=p.id");
    expect(discovery).toContain("p.deleted_at IS NULL AND p.died_at IS NULL AND p.is_active IS TRUE");
    expect(discovery).toContain("(p.user_id=auth.uid() OR social.visibility::text='public')");
    expect(discovery).toContain("AND NOT public._social_blocked(v_viewer,p.id)");
    expect(discovery).toContain("counted AS (SELECT count(*)::integer total FROM base)");
    expect(shared).toContain("JOIN public.player_profiles social ON social.profile_id=p.id");
    expect(shared).toContain("social.visibility::text='public'");
    expect(shared).toContain("REVOKE ALL ON FUNCTION public.search_public_profiles");
    expect(discovery).toContain("REVOKE ALL ON FUNCTION public.search_player_discovery");
  });

  it("#3956 actually applies recruitment, instrument, skill and availability filters", () => {
    expect(discovery).toContain("lower(social.primary_instrument)=lower(v_instrument)");
    expect(discovery).toContain("unnest(social.secondary_instruments)");
    expect(discovery).toContain("unnest(social.preferred_roles)");
    for (const key of [
      "lookingForBand", "lookingForMembers", "sessionAvailable",
      "collaborationAvailable", "gigAvailable", "teachingAvailable",
      "socialAvailable", "employmentAvailable", "onlineNow",
    ]) {
      expect(discovery).toContain("v_filters->>'" + key + "'");
    }
    expect(discovery).toContain("v_mode<>'band-recruitment' OR social.looking_for_band");
    expect(discovery).toContain("v_mode<>'session-work' OR social.available_for_session_work");
    expect(discovery).toContain("DISCOVERY_FILTER_NOT_SUPPORTED");
  });

  it("#3957 masks nonconsensual online/last-active, including filters and order", () => {
    expect(discovery).toContain("CASE WHEN social.show_last_active THEN p.last_login_at ELSE NULL END AS safe_last_active");
    expect(discovery).toContain("social.show_online_status AND p.last_login_at>now()-interval '15 minutes'");
    expect(discovery).toContain("CASE WHEN social.show_city THEN c.name ELSE NULL END AS city_name");
    expect(discovery).toContain("v_city IS NULL OR (social.show_city AND c.name=v_city)");
    expect(discovery).toContain("safe_last_active END DESC NULLS LAST");
    expect(discovery).not.toContain("last_login_at DESC NULLS LAST");
    expect(discovery).toContain("WHEN social.show_last_active AND p.last_login_at");
  });

  it("#3958 implements newest/online-now/availability order with deterministic tiebreaking", () => {
    expect(discovery).toContain("v_sort='newest' THEN created_at END DESC");
    expect(discovery).toContain("v_sort='online-now' AND publicly_online THEN 0");
    expect(discovery).toContain("v_sort='availability' THEN availability_score END DESC");
    expect(discovery).toContain("fame DESC,id ASC");
    expect(discovery).toContain("jsonb_agg(");
    expect(discovery).toContain("ORDER BY o.display_rank");
  });

  it("guards production migration order and denies anonymous RPC use", () => {
    expect(shared).toContain("SOCIAL_DISCOVERY_PRIVACY_DEPENDENCIES_MISSING");
    expect(shared).toContain("REVOKE ALL ON FUNCTION public.resolve_authorized_social_viewer(uuid)");
    expect(discovery).toContain("GRANT EXECUTE ON FUNCTION public.search_player_discovery(jsonb,uuid)");
  });
});
