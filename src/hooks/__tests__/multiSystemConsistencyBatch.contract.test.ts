import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const load = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const approvals = load("supabase/migrations/20300106180000_correct_recruitment_approvals_and_departures.sql");
const notifySchema = load("supabase/migrations/20300106181000_character_scoped_notification_archive.sql");
const chartSchema = load("supabase/migrations/20300106182000_atomic_chart_entry_notifications.sql");
const feed = load("src/hooks/useNotificationsFeed.ts");
const unified = load("src/hooks/useUnifiedInbox.ts");
const events = load("src/hooks/useGameEventNotifications.ts");

describe("five recruitment, notification and chart consistency regressions", () => {
  it("refuses approvals for paused, closed, full and past-deadline vacancies", () => {
    const rpc = approvals.slice(approvals.indexOf("CREATE OR REPLACE FUNCTION public.respond_band_application"), approvals.indexOf("CREATE OR REPLACE FUNCTION public.release_departed_recruitment_slot"));
    expect(rpc).toContain("v_vacancy.status <> 'open'");
    expect(rpc).toContain("v_vacancy.application_deadline <= now()");
    expect(rpc).toContain("v_vacancy.positions_filled >= v_vacancy.positions_available");
    expect(rpc).toContain("NOT COALESCE(v_band.is_recruiting, false)");
    expect(rpc).toContain("NOT COALESCE(v_band.allow_applications,true)");
  });

  it("releases precisely the recruited member's vacancy seat after a departure", () => {
    expect(approvals).toContain("ADD COLUMN IF NOT EXISTS recruitment_application_id uuid");
    expect(approvals).toContain("SET recruitment_application_id = v_application.id");
    expect(approvals).toContain("OLD.recruitment_application_id");
    expect(approvals).toContain("GREATEST(v.positions_filled-1,0)");
    expect(approvals).toContain("WHEN v.status<>'filled' THEN v.status");
    expect(approvals).toContain("band_member_recruitment_slot_departure");
    expect(approvals).toContain("AFTER DELETE OR UPDATE OF band_id, profile_id, member_status, is_touring_member");
  });

  it("uses per-character notification archive/read/delete states, never row deletion", () => {
    expect(notifySchema).toContain("PRIMARY KEY (notification_id,profile_id)");
    expect(notifySchema).toContain("n.user_id=auth.uid()");
    expect(notifySchema).toContain("n.profile_id=p_profile_id");
    expect(notifySchema).toContain("n.metadata->>'profile_id'=p_profile_id::text");
    expect(feed).not.toContain(".delete()");
    expect(feed).toContain('p_action: action');
    expect(feed).toContain('mutationFn: (id: string) => setState(eligible([id]), "delete")');
    expect(feed).toContain("archivedNotifications");
    expect(feed).toContain('notification_profile_states');
  });

  it("archives without deleting and keeps archived counterparts in deduplication", () => {
    const archive = unified.split("const archiveMessage = (id: string) => {")[1]?.split("const deleteMessage")[0];
    expect(archive).toContain("notifications.archive(notificationId)");
    expect(archive).not.toContain("notifications.dismiss(notificationId)");
    expect(unified).toContain("notifications.archivedNotifications");
    expect(unified).toContain("archivedNotificationMessages");
    const deletion = unified.split("const deleteMessage = (id: string) => {")[1];
    expect(deletion).toContain("notifications.dismiss(notificationId)");
  });

  it("atomically claims chart cooldown and inserts alert in the same DB transaction", () => {
    expect(chartSchema).toContain("UNIQUE (profile_id,song_id,chart_type)");
    expect(chartSchema).toContain("ON CONFLICT (profile_id,song_id,chart_type) DO UPDATE");
    expect(chartSchema).toContain("last_notified_at <= now()-INTERVAL '12 hours'");
    expect(chartSchema).toContain("INSERT INTO public.notifications");
    expect(chartSchema).toContain("auth.uid()");
    expect(events).toContain("rpc('create_chart_entry_notification'");
    expect(events).not.toContain(".from('chart_notification_cooldowns'");
  });
});
