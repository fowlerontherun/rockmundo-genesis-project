// MiniMax Music 1.5 accepts a separate style prompt (10–300 characters) and lyrics.
// Never forward a previous "Style: ...\n\nLyrics: ..." audit prompt as the style input.
export const MINIMAX_STYLE_MIN_LENGTH = 10;
export const MINIMAX_STYLE_MAX_LENGTH = 300;

export function normalizeMiniMaxStylePrompt(value: unknown, fallbackGenre: string) {
  const original = typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";
  const lyricsBoundary = original.search(/(?:^|\n)\s*(?:Lyrics|Song Lyrics)\s*:/i);
  const styleOnly = (lyricsBoundary >= 0 ? original.slice(0, lyricsBoundary) : original)
    .replace(/^\s*Style\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  let prompt = styleOnly;
  if (prompt.length < MINIMAX_STYLE_MIN_LENGTH) {
    const genre = String(fallbackGenre || "rock").replace(/\s+/g, " ").trim() || "rock";
    prompt = `${genre} vocal performance`;
  }
  const originalLength = prompt.length;
  if (prompt.length > MINIMAX_STYLE_MAX_LENGTH) {
    const excerpt = prompt.slice(0, MINIMAX_STYLE_MAX_LENGTH);
    const boundary = excerpt.lastIndexOf(" ");
    prompt = (boundary >= 240 ? excerpt.slice(0, boundary) : excerpt).trimEnd();
  }
  if (prompt.length < MINIMAX_STYLE_MIN_LENGTH || prompt.length > MINIMAX_STYLE_MAX_LENGTH) {
    throw new Error(`Invalid MiniMax style prompt length (${prompt.length}); expected 10–300 characters`);
  }

  return {
    prompt,
    originalLength,
    finalLength: prompt.length,
    removedEmbeddedLyrics: lyricsBoundary >= 0,
    wasTruncated: prompt.length < originalLength,
  };
}
