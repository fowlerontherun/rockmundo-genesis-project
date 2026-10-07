import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261007145500_songwriting_completion_polish.sql",
  "utf8",
);
const dialog = readFileSync(
  "src/components/songwriting/CompleteSongDialog.tsx",
  "utf8",
);
const card = readFileSync(
  "src/components/songwriting/SimplifiedProjectCard.tsx",
  "utf8",
);
const hook = readFileSync("src/hooks/useSongwritingData.tsx", "utf8");
const loader = readFileSync("src/lib/songwritingResilientLoader.ts", "utf8");
const cleanup = readFileSync(
  "supabase/functions/cleanup-songwriting/index.ts",
  "utf8",
);

describe("songwriting completion and final polish", () => {
  it("stores one random polish chance and sends a completion inbox snapshot", () => {
    expect(migration).toContain("polish_success_chance");
    expect(migration).toContain("25 + floor(random() * 51)");
    expect(migration).toContain("songwriting_completion");
    expect(migration).toContain("time_breakdown");
    expect(migration).toContain("writing_quality_score");
    expect(migration).toContain("player_inbox");
  });

  it("offers exactly one server-authoritative final polish session", () => {
    expect(migration).toContain("start_songwriting_polish_session");
    expect(migration).toContain("project_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("polish_attempted = true");
    expect(migration).toContain("skip_songwriting_polish");
    expect(migration).toContain(
      "Choose the final polish session or keep the song as-is first",
    );
    expect(hook).toContain("start_songwriting_polish_session");
    expect(hook).toContain("skip_songwriting_polish");
  });

  it("resolves timed polish sessions through cleanup", () => {
    expect(migration).toContain("auto_complete_songwriting_polish_sessions");
    expect(cleanup).toContain("auto_complete_songwriting_polish_sessions");
    expect(cleanup).toContain("completedPolishSessions");
    expect(cleanup).toContain("autoRow.completed_sessions ?? autoRow.completed");
  });

  it("shows quality, real session time, and the stored chance in the UI", () => {
    expect(dialog).toContain("Songwriting complete");
    expect(dialog).toContain("Song quality");
    expect(dialog).toContain("Writing time");
    expect(dialog).toContain("Final polish");
    expect(dialog).not.toContain('.from("songs").insert');
    expect(card).toContain("Review completion");
    expect(card).toContain("start_songwriting_polish_session");
    expect(loader).toContain("COMPLETION_PROJECT_COLUMNS");
    expect(loader).toContain("writing_quality_score");
  });
});
