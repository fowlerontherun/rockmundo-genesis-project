// MiniMax Music 1.5 accepts a separate style prompt (10–300 characters) and lyrics.
// Never forward a previous "Style: ...\n\nLyrics: ..." audit prompt as the style input.
export const MINIMAX_STYLE_MIN_LENGTH = 10;
export const MINIMAX_STYLE_MAX_LENGTH = 300;
export const MINIMAX_MUSIC_26_STYLE_MAX_LENGTH = 2000;

export function normalizeMiniMaxStylePrompt(value: unknown, fallbackGenre: string, maxLength = MINIMAX_STYLE_MAX_LENGTH) {
  if (maxLength !== MINIMAX_STYLE_MAX_LENGTH && maxLength !== MINIMAX_MUSIC_26_STYLE_MAX_LENGTH) {
    throw new Error("Unsupported MiniMax style prompt limit");
  }
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
  if (prompt.length > maxLength) {
    const excerpt = prompt.slice(0, maxLength);
    const boundary = excerpt.lastIndexOf(" ");
    prompt = (boundary >= maxLength - 60 ? excerpt.slice(0, boundary) : excerpt).trimEnd();
  }
  if (prompt.length < MINIMAX_STYLE_MIN_LENGTH || prompt.length > maxLength) {
    throw new Error(`Invalid MiniMax style prompt length (${prompt.length}); expected 10–${maxLength} characters`);
  }

  return {
    prompt,
    originalLength,
    finalLength: prompt.length,
    removedEmbeddedLyrics: lyricsBoundary >= 0,
    wasTruncated: prompt.length < originalLength,
  };
}
