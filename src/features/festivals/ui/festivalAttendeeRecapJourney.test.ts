import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/features/festival-company/ui/PublicFestivalDirectory.tsx"),
  "utf8",
);

const rewards = readFileSync(
  resolve(process.cwd(), "src/features/festival-company/attendance/FestivalModeRewards.tsx"),
  "utf8",
);

describe("Festival attendee recap journey", () => {
  it("keeps completed and early-ended attendances visible in My Festivals", () => {
    expect(source).toContain('case "completed"');
    expect(source).toContain('case "left_early"');
    expect(source).toContain('const hasFestivalStory = (status: string) => ["completed", "left_early"].includes(status)');
    expect(source).toContain("My Festivals");
  });

  it("makes the authoritative reward recap reachable after Festival Mode ends", () => {
    expect(source).toContain('import { FestivalModeRewards }');
    expect(source).toContain("View my Festival story");
    expect(source).toContain("<FestivalModeRewards attendance={storyAttendance} />");
    expect(rewards).toContain("Your Festival story");
    expect(rewards).toContain("Festival recap");
  });

  it("does not invent a second reward or attendance system", () => {
    expect(source).toContain("useMyFestivalAttendance");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("insert(");
    expect(source).not.toContain("awardXp");
  });
});
