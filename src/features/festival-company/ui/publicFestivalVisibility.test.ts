import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public Festival visibility", () => {
  const directory = source("src/features/festival-company/ui/PublicFestivalDirectory.tsx");
  const publicPage = source("src/features/festival-company/ui/PublicFestivalPage.tsx");
  const scheduleBridge = source(
    "supabase/migrations/20260907082308_repair_festival_attendee_stage_schedule_bridge.sql",
  );

  it("previews announced artist names in the world Festival directory", () => {
    expect(directory).toContain("Announced line-up");
    expect(directory).toContain("entry.artistName");
    expect(directory).toContain("announcedArtists.length");
  });

  it("keeps a dedicated public line-up view on the Festival page", () => {
    expect(publicPage).toContain('value="lineup"');
    expect(publicPage).toContain("x.artistName");
  });

  it("projects confirmed simplified bookings into the public schedule bridge", () => {
    expect(scheduleBridge).toContain("festival_artist_bookings");
    expect(scheduleBridge).toContain("Confirmed act");
    expect(scheduleBridge).toContain("b.status NOT IN ('cancelled','withdrawn','artist_withdrawn','festival_cancelled')");
  });
});
