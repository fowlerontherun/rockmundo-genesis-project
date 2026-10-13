import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (name: string) => readFileSync(resolve(process.cwd(), name), "utf8");
const sql = read("supabase/migrations/20300106160000_enforce_social_contact_consent_and_request_cooldowns.sql");
const permissions = read("src/features/direct-messages/services/messagingPermissions.ts");
const ui = read("src/pages/PlayerProfile.tsx");
const discovery = read("src/features/player-discovery/components/PlayerDiscoveryCard.tsx");
const connection = read("src/integrations/supabase/playerConnections.ts");

describe("social-contact consent and lifecycle SQL contracts", () => {
  it("enforces recipient messaging consent at all direct-message insert paths", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.can_profile_receive_dm(");
    expect(sql).toContain("IF v_preference = 'none' THEN RETURN false;");
    expect(sql).toContain("v_preference = 'friends_and_band'");
    expect(sql).toContain("v_preference = 'existing_conversations'");
    expect(sql).toContain("mine.member_status = 'active' AND theirs.member_status = 'active'");
    expect(sql).toContain("JOIN public.conversation_participants theirs");
    expect(sql).toContain("IF NOT public.can_profile_receive_dm(NEW.sender_profile_id, NEW.recipient_profile_id)");
    expect(sql).toContain("BEFORE INSERT OR UPDATE OF sender_profile_id, recipient_profile_id, conversation_id");
    expect(sql).toContain("RAISE EXCEPTION 'active_profile_required'");
  });

  it("rejects requests when the target disabled friend requests", () => {
    expect(sql).toContain("COALESCE(v_mode, 'everyone') = 'none'");
    expect(sql).toContain("RAISE EXCEPTION 'This player is not available for friend requests.'");
  });

  it("serializes friend-request renewal and enforces 24h cooldown for terminal states", () => {
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended(v_pair, 0))");
    expect(sql).toContain("'friend_request_declined', 'friend_request_cancelled', 'friend_removed'");
    expect(sql).toContain("COALESCE(v_row.declined_at,v_row.responded_at,v_row.updated_at)");
    expect(sql).toContain("COALESCE(v_row.cancelled_at,v_row.responded_at,v_row.updated_at)");
    expect(sql).toContain("COALESCE(v_row.removed_at,v_row.responded_at,v_row.updated_at)");
    expect(sql).toContain("v_recent_action > now() - INTERVAL '24 hours'");
    expect(sql).toContain("USING ERRCODE='42901'");
  });

  it("exposes cooldown state instead of fabricating not-connected while locked", () => {
    expect(sql).toContain("RETURN 'request_cooldown'");
    expect(connection).toContain('"request_cooldown"');
    expect(ui).toContain('connection.data === "request_cooldown"');
    expect(discovery).toContain('connection.data === "request_cooldown"');
    expect(ui).toContain('"declined", "cancelled", "removed", "expired"');
  });

  it("does not allow company links or prior threads to override recipient preferences", () => {
    expect(permissions).not.toContain("relationshipAllowed");
    expect(permissions).not.toContain("existingAllowed");
    expect(permissions).toContain('case "none": return false;');
    expect(permissions).toContain('case "friends": return Boolean(context.areFriends);');
    expect(permissions).toContain('case "friends_and_band": return Boolean(context.areFriends || context.shareBand);');
  });
});
