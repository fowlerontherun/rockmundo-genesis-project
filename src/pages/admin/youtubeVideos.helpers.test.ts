import { describe, expect, it } from "vitest";
import {
  defaultResourceFormValues,
  mapResourceFormToPayload,
  youtubeResourceSchema,
} from "./youtubeVideos.helpers";

describe("fictional PooTube admin form", () => {
  it("creates an in-game lesson without requiring an external YouTube URL", () => {
    const form = youtubeResourceSchema.parse({
      ...defaultResourceFormValues,
      title: "Singing: Breath Control",
      description: "Follow a short Rockmundo practice session.",
      skillSlug: "basic_singing",
      category: "PooTube Originals",
      channelName: "Rockmundo Academy",
    });
    const payload = mapResourceFormToPayload(form);
    expect(payload.title).toBe("Singing: Breath Control");
    expect(payload.skill_slug).toBe("basic_singing");
    expect(payload.category).toBe("pootube_originals");
    expect("video_url" in payload).toBe(false);
  });

  it("rejects lessons without a skill rather than issuing arbitrary XP", () => {
    expect(() => youtubeResourceSchema.parse({
      ...defaultResourceFormValues,
      title: "Mystery Episode",
      category: "general",
      skillSlug: "",
    })).toThrow();
  });
});
