import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20250920135913_6eb1b596-a672-4450-a6b9-557068e5b641.sql",
  ),
  "utf8",
);
const forwardMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243430_reconcile_social_skill_compatibility.sql",
  ),
  "utf8",
);

describe("social compatibility migration", () => {
  it("creates legacy enums safely", () => {
    expect(historicalMigration).toContain(
      "CREATE TYPE public.friendship_status AS ENUM",
    );
    expect(historicalMigration).toContain(
      "CREATE TYPE public.chat_participant_status AS ENUM",
    );
    expect(historicalMigration.match(/WHEN duplicate_object THEN NULL/g)).toHaveLength(2);
  });

  it("extends the authoritative player skills table", () => {
    expect(historicalMigration).not.toContain(
      "CREATE TABLE IF NOT EXISTS public.player_skills",
    );
    expect(historicalMigration).toContain("ALTER TABLE public.player_skills");
    for (const column of [
      "creativity",
      "technical",
      "business",
      "marketing",
      "composition",
    ]) {
      expect(historicalMigration).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
      expect(forwardMigration).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
  });

  it("recreates named policies and triggers idempotently", () => {
    expect(historicalMigration).toContain(
      'DROP POLICY IF EXISTS "Users can view their own friendships"',
    );
    expect(historicalMigration).toContain(
      "DROP TRIGGER IF EXISTS update_friendships_updated_at",
    );
    expect(historicalMigration).toContain(
      "DROP TRIGGER IF EXISTS update_chat_participants_updated_at",
    );
    expect(historicalMigration).toContain(
      "DROP TRIGGER IF EXISTS update_player_skills_updated_at",
    );
  });

  it("keeps the forward repair away from obsolete friendship columns", () => {
    expect(forwardMigration).toContain("ALTER TABLE public.player_skills");
    expect(forwardMigration).toContain("ALTER TABLE public.profiles");
    expect(forwardMigration).not.toContain("friend_user_id");
    expect(forwardMigration).not.toContain("user_profile_id");
    expect(forwardMigration).not.toContain("CREATE POLICY");
  });
});
