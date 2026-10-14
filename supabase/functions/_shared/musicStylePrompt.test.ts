import { normalizeMiniMaxStylePrompt } from "./musicStylePrompt.ts";

Deno.test("strips stored lyrics and Style heading from the admin style field", () => {
  const result = normalizeMiniMaxStylePrompt("Style: Punk Rock, high energy\n\nLyrics:\n[Chorus]\nTHIS IS THE CAPITAL!", "Punk Rock");
  if (result.prompt !== "Punk Rock, high energy" || !result.removedEmbeddedLyrics) {
    throw new Error(`Unexpected style: ${JSON.stringify(result)}`);
  }
});

Deno.test("limits long custom descriptions to the MiniMax 300-character maximum", () => {
  const result = normalizeMiniMaxStylePrompt("An energetic punk rock anthem, ".repeat(40), "Punk Rock");
  if (result.prompt.length > 300 || !result.wasTruncated) throw new Error("Long prompt was not truncated");
});

Deno.test("substitutes a valid style when empty or malformed", () => {
  const result = normalizeMiniMaxStylePrompt("Lyrics:\nSome lyrics", "Punk Rock");
  if (result.prompt.length < 10 || result.prompt.length > 300) throw new Error("Invalid fallback");
});

Deno.test("preserves a valid direct style prompt", () => {
  const result = normalizeMiniMaxStylePrompt("Raw punk rock with driving drums", "Punk Rock");
  if (result.prompt !== "Raw punk rock with driving drums") throw new Error("Modified a valid style");
});
