import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

const baseSchema = read(
  "supabase/migrations/20250916075501_1adc3330-58fe-4fde-85d0-b13e1e788c85.sql",
);
const compatibilityMigration = read(
  "supabase/migrations/20250916114856_899eb480-3462-41e8-b937-a367711419a9.sql",
);
const retiredRebuild = read(
  "supabase/migrations/20250916114927_73d634ec-2e82-4c77-8cee-e8eb53e13f4d.sql",
);

describe("song schema migration safety", () => {
  it("keeps the base artist-owned song contract", () => {
    expect(baseSchema).toContain("artist_id uuid NOT NULL REFERENCES auth.users(id)");
    expect(baseSchema).toContain("Songs are viewable by everyone");
    expect(baseSchema).toContain("Artists can manage their songs");
    expect(baseSchema).toContain("auth.uid() = artist_id");
  });

  it("extends songs without adding an incompatible user owner", () => {
    expect(compatibilityMigration).toContain("canonical_song_artist_id_missing");
    expect(compatibilityMigration).toContain("ADD COLUMN IF NOT EXISTS lyrics");
    expect(compatibilityMigration).toContain("ADD COLUMN IF NOT EXISTS streams");
    expect(compatibilityMigration).toContain("ADD COLUMN IF NOT EXISTS revenue");
    expect(compatibilityMigration).toContain("ADD COLUMN IF NOT EXISTS chart_position");
    expect(compatibilityMigration).not.toContain("user_id UUID NOT NULL");
    expect(compatibilityMigration).not.toContain("auth.uid() = user_id");
  });

  it("does not replace the base song policy or updated-at trigger", () => {
    expect(compatibilityMigration).not.toContain('CREATE POLICY "Users can view their own songs"');
    expect(compatibilityMigration).not.toContain("CREATE TRIGGER update_songs_updated_at");
    expect(compatibilityMigration).not.toContain("CREATE OR REPLACE FUNCTION public.update_songs_updated_at");
  });

  it("uses the real character table for the legacy fans field", () => {
    expect(compatibilityMigration).toContain("ALTER TABLE public.profiles");
    expect(compatibilityMigration).toContain("ADD COLUMN IF NOT EXISTS fans");
    expect(compatibilityMigration).not.toContain("ALTER TABLE public.player_profiles");
  });

  it("retires the migration that dropped songs and dependencies", () => {
    expect(retiredRebuild).toContain("Destructive duplicate song rebuild intentionally skipped");
    expect(retiredRebuild).not.toContain("DROP TABLE IF EXISTS public.songs");
    expect(retiredRebuild).not.toContain("CREATE TABLE public.songs");
    expect(retiredRebuild).not.toContain("CASCADE");
  });
});