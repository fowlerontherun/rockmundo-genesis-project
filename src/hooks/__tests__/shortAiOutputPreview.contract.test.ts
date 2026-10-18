import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const webhook = source("supabase/functions/replicate-webhook/index.ts");
const ui = source("src/components/recording/SongGenerationStatus.tsx");

describe("short paid AI outputs are saved without becoming full songs", () => {
  it("archives usable under-60s MP3s and leaves the generation attempt failed", () => {
    expect(webhook).toContain("if (actualSeconds < minSeconds)");
    expect(webhook).toContain("actualSeconds >= 20");
    expect(webhook).toContain('const previewPath = "short-previews/" + songId');
    expect(webhook).toContain("Preview stored:");
    expect(webhook.indexOf("if (actualSeconds < minSeconds)")).toBeLessThan(
      webhook.indexOf("const acceptedAudioBytes"));
    expect(webhook).toContain("manual retry only.");
  });
  it("offers a safely scoped listen-only preview instead of presenting it as completed", () => {
    expect(ui).toContain("shortPreviewPath");
    expect(ui).toContain('includes("/" + songId + "/")');
    expect(ui).toContain("shortPreviewUrl");
    expect(ui).toContain("<audio controls preload=\"none\"");
    expect(ui).toContain("It is a preview only");
  });
});
