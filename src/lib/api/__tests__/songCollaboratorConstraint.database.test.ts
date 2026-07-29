import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20250917104500_add_song_collaborators.sql",
  ),
  "utf8",
);
const forwardMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243420_repair_song_collaborator_constraints.sql",
  ),
  "utf8",
);

describe("song collaborator split constraints", () => {
  it("moves array aggregation out of the check expression", () => {
    expect(historicalMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.song_collaborator_splits_valid",
    );
    expect(historicalMigration).toContain("IMMUTABLE");
    expect(historicalMigration).toContain(
      "CHECK (public.song_collaborator_splits_valid(co_writers, split_percentages))",
    );
    expect(historicalMigration).not.toContain(
      "CHECK (\n        COALESCE((SELECT SUM",
    );
  });

  it("requires aligned arrays and safe percentage values", () => {
    expect(historicalMigration).toContain(
      "cardinality(p_co_writers) = cardinality(p_split_percentages)",
    );
    expect(historicalMigration).toContain(
      "WHERE split.value < 0 OR split.value > 100",
    );
    expect(historicalMigration).toContain(
      "FROM unnest(p_split_percentages) AS split(value)",
    );
    expect(historicalMigration).toContain("), 0) <= 100");
  });

  it("removes both invalid legacy constraints", () => {
    expect(historicalMigration).toContain(
      "DROP CONSTRAINT IF EXISTS songs_collaborator_splits_match",
    );
    expect(historicalMigration).toContain(
      "DROP CONSTRAINT IF EXISTS songs_split_percentages_total",
    );
  });

  it("repairs deployed databases without rewriting collaborator data", () => {
    expect(forwardMigration).toContain("NOT VALID");
    expect(forwardMigration).toContain(
      "Existing legacy rows remain unvalidated until reviewed",
    );
    expect(forwardMigration).not.toContain("UPDATE public.songs");
    expect(forwardMigration).not.toContain("DELETE FROM public.songs");
  });
});
