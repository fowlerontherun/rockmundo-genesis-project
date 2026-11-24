import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildMusicVideoPrompts,
  normalizeMusicVideoBrief,
  VIDEO_CAMERA_MOVEMENTS,
  VIDEO_THEMES,
} from "../../../../supabase/functions/_shared/musicVideoPrompt";

describe("AI music-video creative direction", () => {
  it("builds a complete one-shot visual from basic song and theme input", () => {
    const result = buildMusicVideoPrompts({
      songTitle: "Skyline Signal",
      songGenre: "rock",
      brief: { visual_theme: "neon_cyberpunk" },
    });
    expect(result.brief.art_style).toBe("realistic");
    expect(result.brief.shot_concept).toContain("rain-slick neon city");
    expect(result.imagePrompt).toContain("16:9 establishing frame");
    expect(result.imagePrompt).toContain("rock genre");
    expect(result.videoPrompt).toContain("Single continuous short music-video shot");
    expect(result.videoPrompt).toContain("neon city");
  });

  it("puts each advanced control in the provider's supported text prompt", () => {
    const result = buildMusicVideoPrompts({
      songTitle: "Skyline Signal",
      brief: {
        visual_theme: "performance_stage",
        shot_concept: "A drummer strikes the final cymbal beneath falling confetti",
        art_style: "comic_book",
        mood: "mysterious",
        camera_movement: "orbit",
        lighting: "neon",
        colour_palette: "cool",
        subject_motion: "intense",
      },
    });
    for (const expected of ["drummer strikes", "comic-book", "mysterious", "neon", "blue and teal"]) {
      expect(result.imagePrompt).toContain(expected);
      expect(result.videoPrompt).toContain(expected);
    }
    expect(result.videoPrompt).toContain("orbiting camera");
    expect(result.videoPrompt).toContain("rapid expressive subject movement");
    expect(result.imagePrompt).not.toContain("orbiting camera");
  });

  it("rejects unsupported enum values and clamps free text", () => {
    const brief = normalizeMusicVideoBrief({
      visual_theme: "__custom_injection__",
      art_style: "unrecognised",
      camera_movement: "lens_999",
      shot_concept: "A".repeat(2000),
    });
    expect(brief.visual_theme).toBe("cinematic");
    expect(brief.art_style).toBe("realistic");
    expect(brief.camera_movement).toBe("auto");
    expect(brief.shot_concept).toHaveLength(240);
    expect(VIDEO_THEMES.map((option) => option.value)).toContain(brief.visual_theme);
    expect(VIDEO_CAMERA_MOVEMENTS.map((option) => option.value)).toContain(brief.camera_movement);
  });

  it("keeps an older reserved video's first scene as a single shot", () => {
    const brief = normalizeMusicVideoBrief({
      scene_descriptions: ["Singer beneath falling snow", "An unrelated second location"],
    });
    expect(brief.shot_concept).toBe("Singer beneath falling snow");
    const result = buildMusicVideoPrompts({ songTitle: "Snow", brief });
    expect(result.videoPrompt).not.toContain("unrelated second location");
  });

  it("binds paid generation to the stored brief and retains atomic settlement", () => {
    const generator = readFileSync("supabase/functions/generate-music-video/index.ts", "utf8");
    const dialog = readFileSync("src/components/music-video/VipVideoCreationDialog.tsx", "utf8");
    expect(generator).toContain('video.description || "{}"');
    expect(generator).toContain("buildMusicVideoPrompts({");
    expect(generator).toContain('"claim_music_video_generation"');
    expect(generator).toContain('"register_music_video_prediction"');
    expect(generator).toContain('model: "minimax/video-01-live"');
    expect(generator).toContain("first_frame_image: firstFrameUrl");
    expect(generator).toContain("prompt: videoPrompt");
    expect(dialog).toContain('mode === "advanced"');
    expect(dialog).toContain('body: { videoId: reservation.video_id }');
    expect(dialog).not.toContain("sceneDescriptions.filter");
  });
});
