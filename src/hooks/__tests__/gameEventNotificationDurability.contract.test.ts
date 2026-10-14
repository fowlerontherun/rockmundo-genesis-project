import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20261014113000_durable_deduped_game_notifications.sql");
const hook = read("src/hooks/useGameEventNotifications.ts");
const helper = read("src/lib/notify.ts");

describe("game event notification delivery and recipient security", () => {
  it("#4036 rejects recipient spoofing and cross-account profile notification requests", () => {
    expect(migration).toContain("auth.uid()<>p_user_id");
    expect(migration).toContain("NOTIFICATION_RECIPIENT_NOT_AUTHORISED");
    expect(migration).toContain("p.user_id=p_user_id AND p.deleted_at IS NULL");
    expect(migration).toContain("NOTIFICATION_PROFILE_NOT_AUTHORISED");
    expect(migration).toContain("NOTIFICATION_METADATA_INVALID");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.create_notification");
    expect(migration).toContain("TO authenticated,service_role");
  });

  it("#3993 uses stable per-character event identifiers and a database unique constraint", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_once_per_character");
    expect(migration).toContain("ON CONFLICT DO NOTHING");
    expect(migration).toContain("(coalesce(profile_id::text,''))");
    expect(helper).toContain("...(args.eventKey ? { event_key: args.eventKey } : {})");
    for (const key of [
      "achievement:", "gig_outcome:", "recording_completed:", "band_invite:",
      "rehearsal_completed:", "songwriting_completed:", "vip_activation:",
      "twaater_notification:", "audio_generated:", "audio_failed:", "chart_entry:",
    ]) {
      expect(hook).toContain(key);
    }
  });

  it("#3991 handles realtime failures and re-subscribes after a delayed, cleaned-up retry", () => {
    for (const status of ["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]) {
      expect(hook).toContain(status);
    }
    expect(hook).toContain("setSubscriptionGeneration((current) => current + 1)");
    expect(hook).toContain('window.addEventListener("online", reconnect)');
    expect(hook).toContain('document.addEventListener("visibilitychange", resume)');
    expect(hook).toContain("if (retryHandle) clearTimeout(retryHandle)");
    expect(hook).toContain("channels.forEach(channel => void supabase.removeChannel(channel))");
    expect((hook.match(/\.subscribe\(retrySubscription\)/g) ?? []).length).toBeGreaterThanOrEqual(15);
    expect(hook).toContain('.rpc("reconcile_my_game_notifications"');
  });

  it("#3986 stores game events in DB triggers without requiring a live browser tab", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.persist_game_event_on_change()");
    for (const table of [
      "gig_outcomes", "recording_sessions", "player_achievements",
      "band_invitations", "band_rehearsals", "releases", "songs",
      "songwriting_projects", "gig_offers", "band_sponsorships",
      "festival_participants", "artist_label_contracts",
      "vip_subscriptions", "twaater_notifications", "chart_entries",
    ]) {
      expect(migration).toContain("('" + table + "','");
    }
    expect(migration).toContain("FOR EACH ROW EXECUTE FUNCTION public.persist_game_event_on_change()");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.persist_game_event_on_change()");
    expect(migration).toContain("NOTIFICATION_RECONCILIATION_FORBIDDEN");
    expect(migration).toContain("pa.unlocked_at>=now()-interval '72 hours'");
  });

  it("#4037 writes VIP activation to a user-scoped inbox, not every active character", () => {
    expect(hook).toContain("eventKey: `vip_activation:${sub.id}`,\n              accountWide: true");
    expect(hook).toContain("profileId: args.accountWide ? null");
    expect(migration).toContain("v_kind IN ('vip_activation','band_invite')");
    expect(migration).toContain("VALUES(v_user,NULL,v_category");
    expect(migration).toContain("('vip_subscriptions','INSERT OR UPDATE')");
    expect(migration).toContain("prior->>'status'='active'");
  });
});
