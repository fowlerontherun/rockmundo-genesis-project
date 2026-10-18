import { describe, expect, it } from "vitest";
import { isDirectYouTubeLesson, videoTutorialSearchUrl } from "./educationVideoLinks";

describe("Education YouTube links", () => {
  it("accepts specific video IDs from real YouTube hosts", () => {
    expect(isDirectYouTubeLesson("https://www.youtube.com/watch?v=1XHXezdnL0A")).toBe(true);
    expect(isDirectYouTubeLesson("https://youtu.be/XeVLe4dX9V8")).toBe(true);
    expect(isDirectYouTubeLesson("https://youtube.com/shorts/ondTlJEmPYA")).toBe(true);
  });
  it("does not turn searches or historical placeholder IDs into rewarded lessons", () => {
    expect(isDirectYouTubeLesson("https://www.youtube.com/results?search_query=guitar")).toBe(false);
    expect(isDirectYouTubeLesson("https://youtube.com/watch?v=politics-gov-101")).toBe(false);
    expect(isDirectYouTubeLesson("https://www.youtube.com/watch?v=invalid")).toBe(false);
    expect(isDirectYouTubeLesson("https://evil.example/watch?v=1XHXezdnL0A")).toBe(false);
    expect(isDirectYouTubeLesson("javascript:alert(1)")).toBe(false);
  });
  it("creates useful, escaped searches for uncovered skills", () => {
    expect(videoTutorialSearchUrl("genres_basic_afrobeats_amapiano")).toContain("afrobeats%20amapiano");
    expect(videoTutorialSearchUrl("basic_singing", "safe warmups")).toContain("safe%20warmups");
    expect(videoTutorialSearchUrl("basic_brass")).toContain("brass");
  });
});
