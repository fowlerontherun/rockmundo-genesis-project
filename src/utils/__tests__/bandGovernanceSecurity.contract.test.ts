import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const migration = read("supabase/migrations/20300106190000_harden_band_governance_profile_identity.sql");
const client = read("src/utils/bandMembers.ts");
const settings = read("src/components/band/BandSettingsTab.tsx");
const fn = (name: string) => {
  const pos = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(pos, `missing function ${name}`).toBeGreaterThan(-1);
  return migration.slice(pos, migration.indexOf("$$;", pos) + 3);
};

describe("eight band-governance audit regressions", () => {
  it("#4011 verifies leadership transfer against the owning active profile, not auth UID", () => {
    const sql = fn("transfer_band_leadership_atomic");
    expect(sql).toContain("v_actor_profile uuid := public.current_profile_id()");
    expect(sql).toContain("v_actor_profile IS DISTINCT FROM p_current_leader_id");
    expect(sql).toContain("p.user_id=auth.uid()");
    expect(sql).toContain("v_band.leader_id IS DISTINCT FROM v_actor_profile");
    expect(sql).not.toContain("auth.uid()<>p_current_leader_id");
  });

  it("#4012 stores a live successor profile ID rather than the auth user ID", () => {
    const sql = fn("transfer_band_leadership_atomic");
    expect(sql).toContain("bm.profile_id=p_new_leader_id");
    expect(sql).toContain("next_leader.id=bm.profile_id");
    expect(sql).toContain("next_leader.deleted_at IS NULL AND next_leader.died_at IS NULL");
    expect(sql).toContain("SET leader_id=p_new_leader_id");
    expect(sql).not.toContain("user_id=p_new_leader_id");
    expect(settings).toContain("value={leader.profile_id}");
    expect(settings).not.toContain("value={leader.user_id}");
  });

  it("#4013 prevents former/touring/dead successors appearing in the picker", () => {
    expect(client).toContain(".eq('member_status', 'active')");
    expect(client).toContain(".eq('is_touring_member', false)");
    expect(client).toContain(".eq('profiles.is_active', true)");
    expect(client).toContain(".is('profiles.deleted_at', null)");
    expect(client).toContain(".is('profiles.died_at', null)");
    expect(client).toContain(".neq('profile_id', currentLeaderId)");
  });

  it("#4007 refuses a selected leader departing before a transfer", () => {
    const sql = fn("leave_band_atomic");
    expect(sql).toContain("v_profile uuid:=public.current_profile_id()");
    expect(sql).toContain("IF v_band.leader_id=v_profile THEN");
    expect(sql).toContain("TRANSFER_LEADERSHIP_FIRST");
    expect(sql).not.toContain("IF v_band.leader_id=v_user");
  });

  it("#4008 deletes only selected character membership and preserves sibling-occupied ownership", () => {
    const sql = fn("leave_band_atomic");
    expect(sql).toContain("bm.profile_id=v_profile");
    expect(sql).toContain("bm.user_id=v_user");
    expect(sql).toContain("IF NOT EXISTS (");
    expect(sql).toContain("WHERE bm.band_id=p_band_id AND bm.user_id=v_user");
    expect(sql).toContain("UPDATE public.band_song_ownership");
    expect(sql).not.toContain("DELETE FROM public.band_members WHERE band_id=p_band_id AND user_id=v_user");
  });

  it("#4009 wraps status changes and disband history in one authenticated RPC", () => {
    const sql = fn("disband_band_atomic");
    expect(sql).toContain("v_actor uuid:=public.current_profile_id()");
    expect(sql).toContain("v_band.leader_id IS DISTINCT FROM v_actor");
    expect(sql).toContain("FROM public.bands WHERE id=p_band_id FOR UPDATE");
    expect(sql).toContain("UPDATE public.bands SET status='disbanded'");
    expect(sql).toContain("INSERT INTO public.band_history");
    expect(client).toContain("rpc('disband_band_atomic'");
    expect(client).not.toContain(".update({ \n        status: 'disbanded'");
  });

  it("#4014 blocks direct user role/self-promotion and membership reassignment", () => {
    const sql = fn("guard_band_membership_direct_changes");
    expect(sql).toContain("SECURITY INVOKER");
    for (const field of ["band_id","user_id","profile_id","role","member_status",
      "is_touring_member","can_be_leader","leadership_votes","salary"]) {
      expect(sql).toContain(`NEW.${field} IS DISTINCT FROM OLD.${field}`);
    }
    expect(migration).toContain("BEFORE UPDATE ON public.band_members");
  });

  it("#4015 restricts protected leader/founder deletes, even via permissive RLS", () => {
    const sql = fn("guard_protected_band_member_delete");
    expect(sql).toContain("lower(COALESCE(OLD.role,'')) IN ('leader','founder')");
    expect(sql).toContain("b.leader_id=OLD.profile_id");
    expect(migration).toContain("BEFORE DELETE ON public.band_members");
    expect(migration).toContain("lower(COALESCE(role,'')) NOT IN ('founder','leader')");
    expect(migration).toContain("REVOKE UPDATE,DELETE ON public.band_members FROM PUBLIC,anon");
  });
});
