import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("multi-character travel and notification isolation", () => {
  const notificationsSource = readFileSync(
    resolve(process.cwd(), "src/hooks/useNotificationsFeed.ts"),
    "utf8",
  );
  const unifiedInboxSource = readFileSync(
    resolve(process.cwd(), "src/hooks/useUnifiedInbox.ts"),
    "utf8",
  );
  const inboxSource = readFileSync(
    resolve(process.cwd(), "src/hooks/useInbox.ts"),
    "utf8",
  );
  const gameDataSource = readFileSync(
    resolve(process.cwd(), "src/hooks/useGameData.tsx"),
    "utf8",
  );
  const migrationSource = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20260829202311_fix_multi_character_travel_location_scope.sql",
    ),
    "utf8",
  );

  it("queries and mutates notifications for the active character only", () => {
    expect(notificationsSource).toContain('queryKey: [...QUERY_KEY, userId, profileId]');
    expect(notificationsSource).toContain('.eq("profile_id", profileId)');
    expect(notificationsSource).toContain('enabled: !!userId && !!profileId');
  });

  it("does not treat an unscoped notification as belonging to every character", () => {
    expect(unifiedInboxSource).toContain("notification.profile_id === profileId");
    expect(unifiedInboxSource).not.toContain("!notification.profile_id || !profileId");
  });

  it("does not relabel account or sibling activity rows as the active character", () => {
    expect(gameDataSource).toContain('.eq("profile_id", effectiveProfile.id)');
    expect(gameDataSource).toContain("record.profile_id !== fallbackProfileId");
    expect(gameDataSource).not.toContain("fetchActivitiesWithFallback");
    expect(gameDataSource).not.toContain("delete fallbackPayload.profile_id");
  });

  it("shows only tagged character inbox rows or explicit account-wide messages", () => {
    expect(inboxSource).toContain("targetProfileId === profileId");
    expect(inboxSource).toContain('message.metadata?.scope === "account"');
    expect(inboxSource).not.toContain("return !msgProfileId || msgProfileId === profileId");
  });

  it("moves only the profile that owns a completed travel record", () => {
    expect(migrationSource).toContain("WHERE id = NEW.profile_id");
    expect(migrationSource).toContain("AND user_id = NEW.user_id");
    expect(migrationSource).not.toContain("WHERE user_id = NEW.user_id;");
  });

  it("stamps travel inbox records with their owning profile", () => {
    expect(migrationSource).toContain("scope_player_inbox_character_context");
    expect(migrationSource).toContain("jsonb_build_object('profile_id', v_profile_id)");
    expect(migrationSource).toContain("related_entity_type = 'travel_timeline_event'");
  });
});
