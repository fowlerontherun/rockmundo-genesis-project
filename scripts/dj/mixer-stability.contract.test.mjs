import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const mixer = readFileSync(
  fileURLToPath(new URL("../../src/features/nightclub-dj/DjMixingStudio.tsx", import.meta.url)),
  "utf8",
);

describe("DJ mixer source lifecycle and live auto-sync contract", () => {
  it("only reloads playable audio when the source or retry changes", () => {
    assert.match(mixer, /const audioSourceKey = deckAudioSourceKey\(track\)/);
    assert.match(mixer, /getDjPlaybackUrl\(playableTrack\)/);
    assert.match(mixer, /\[audioSourceKey, retryNonce\]/);
    assert.doesNotMatch(mixer, /\[track, retryNonce\]/);
  });

  it("passes real Deck B sync adjustments to the verified live tempo action", () => {
    assert.match(mixer, /changedDjTempoPercent\(rateB, rate\)/);
    assert.match(mixer, /if \(changedPercent !== null\)/);
    assert.match(mixer, /sendLiveEvent\(\{ kind: "tempo", deck: "B", value: changedPercent \}\)/);
    assert.match(mixer, /if \(!liveBookingId\) return;/);
  });
});
