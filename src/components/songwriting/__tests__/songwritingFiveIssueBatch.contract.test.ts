import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const hook = read("src/hooks/useSongwritingData.tsx");
const card = read("src/components/songwriting/SimplifiedProjectCard.tsx");

describe("songwriting completion and active-character data safety", () => {
  it("#4043 consistently includes instrument quality when finishing or skipping final polish", () => {
    expect(card).toContain('"complete_songwriting_project_with_instruments"');
    expect(card).toContain('"skip_and_complete_songwriting_project_with_instruments"');
    expect(card).not.toContain('"complete_songwriting_project",');
    expect(hook).toContain("rpc('complete_songwriting_project_with_instruments'");
  });

  it("#4044 refuses an edit without a character and requires a matching row", () => {
    const edit = hook.split("// Update project")[1]?.split("// Delete project")[0] ?? "";
    expect(edit).toContain('if (!profileId) throw new Error("Select an active character');
    expect(edit).toContain(".update(updates)");
    expect(edit).toContain(".eq('profile_id', profileId)");
    expect(edit).toContain(".select('id')");
    expect(edit).toContain(".maybeSingle()");
    expect(edit).toContain("if (!data) throw new Error");
  });

  it("#4045 refuses cross-character or zero-row deletion instead of reporting success", () => {
    const deletion = hook.split("// Delete project")[1]?.split("// Start session")[0] ?? "";
    expect(deletion).toContain('if (!profileId) throw new Error("Select an active character');
    expect(deletion).toContain(".delete()");
    expect(deletion).toContain(".eq('profile_id', profileId)");
    expect(deletion).toContain(".maybeSingle()");
    expect(deletion).toContain("if (!data) throw new Error");
  });

  it("#4046 never clears an active polish/writing session from a read-only query", () => {
    const loader = hook.split("// Fetch projects with sessions")[1]?.split("// Create project")[0] ?? "";
    expect(loader).toContain("refetchInterval:");
    expect(loader).toContain("item.is_locked");
    expect(loader).not.toContain(".update({ is_locked: false, locked_until: null })");
    expect(loader).not.toContain("needsUnlock.map");
  });

  it("#4047 renders finite, bounded percentages for both music and lyrics", () => {
    expect(card).toContain("songwritingProgressPercent(project.music_progress)");
    expect(card).toContain("songwritingProgressPercent(project.lyrics_progress)");
    expect(card).not.toContain("Math.round((project.music_progress / 2000) * 100)");
    expect(card).not.toContain("Math.round((project.lyrics_progress / 2000) * 100)");
  });
});
