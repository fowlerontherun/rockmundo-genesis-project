import { it } from "vitest";
import { getGenerationBlock, type SongAudioState } from "./songRegenerationPolicy.ts";

const completed: SongAudioState = {
  audio_url: "https://example.test/old-song.mp3",
  audio_generation_status: "completed",
  audio_generation_started_at: null,
};

it("previously completed audio needs explicit confirmation", () => {
  if (getGenerationBlock(completed, false) !== "confirmation_required") {
    throw new Error("Automatic generation may overwrite completed audio");
  }
  if (getGenerationBlock(completed, true) !== null) {
    throw new Error("Explicit regeneration was blocked");
  }
});

it("active regeneration cannot be started twice, even with old audio", () => {
  const now = Date.parse("2026-10-14T19:00:00Z");
  const generating = {
    ...completed,
    audio_generation_status: "generating",
    audio_generation_started_at: "2026-10-14T18:59:00Z",
  };
  if (getGenerationBlock(generating, true, now) !== "already_generating") {
    throw new Error("Allowed overlapping regeneration");
  }
  if (getGenerationBlock({ ...generating, audio_generation_started_at: null }, true, now) !== "already_generating") {
    throw new Error("Missing timestamp bypasses provider lock");
  }
});

it("expired attempt and failed initial song may be retried", () => {
  const now = Date.parse("2026-10-14T19:00:00Z");
  const stuck = { ...completed, audio_generation_status: "generating", audio_generation_started_at: "2026-10-14T18:30:00Z" };
  if (getGenerationBlock(stuck, true, now) !== null) throw new Error("Blocked recovery of expired attempt");
  if (getGenerationBlock({ audio_url: null, audio_generation_status: "failed", audio_generation_started_at: null }, false, now) !== null) {
    throw new Error("Blocked first valid retry");
  }
});

it("failed replacement keeps explicit replacement requirement", () => {
  const state = { ...completed, audio_generation_status: "failed" };
  if (getGenerationBlock(state, false) !== "confirmation_required") {
    throw new Error("Failed replacement bypassed confirmation");
  }
  if (getGenerationBlock(state, true) !== null) throw new Error("Explicit retry was blocked");
});
