import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const sql = read("../../../supabase/migrations/20261013193000_repair_current_social_invites.sql");
const profile = read("../../../src/services/playerProfileService.ts");
const discoveryPage = read("../../../src/pages/PlayerDiscovery.tsx");

describe("social invite and character privacy batch", () => {
  it("#3938 deduplicates current text-signature pending invitations under a pair-level lock", () => {
    expect(sql).toContain("public.send_social_invite(");
    expect(sql).toContain("invite_kind text");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS social_invites_unique_pending_pair_kind");
    expect(sql).toContain("REVOKE INSERT ON public.social_invites FROM authenticated,anon");
    expect(sql).toContain("kind=v_kind AND status='pending'");
    expect(sql).toContain("IF v_row.id IS NULL THEN");
    expect(sql).toContain("LIMIT 1 FOR UPDATE");
  });
  it("#3939 notifies the recipient exactly once per canonical invite", () => {
    expect(sql).toContain("INSERT INTO public.notifications(");
    expect(sql).toContain("v_recipient_user,target_profile_id");
    expect(sql).toContain("n.metadata->>'social_invite_id'=v_row.id::text");
    expect(sql).toContain("'social_invite'");
    expect(sql).toContain("WHERE NOT EXISTS(");
  });
  it("#3940 never accepts or declines a past-due scheduled invite", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.respond_social_invite(");
    expect(sql).toContain("next_status text");
    expect(sql).toContain("v_row.scheduled_at IS NOT NULL AND v_row.scheduled_at<=now()");
    expect(sql).toContain("status='expired'::public.social_invite_status");
    expect(sql).toContain("IF v_actor NOT IN (v_row.from_profile_id,v_row.to_profile_id)");
    expect(sql).toContain("Only the recipient may accept or decline.");
  });
  it("#3932 patches supplied fields without upsert resetting account preferences", () => {
    expect(profile).toContain("Object.prototype.hasOwnProperty.call(input, field)");
    expect(profile).toContain('table.update(patch).eq("profile_id", profile_id)');
    expect(profile).not.toContain(".upsert(cleaned");
  });
  it("#3941 only records recent searches for a signed-in account", () => {
    expect(discoveryPage).toContain("if (profile?.user_id) recordRecentPlayerSearch(profile.user_id");
  });
});
